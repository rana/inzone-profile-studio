"""Recovery packaging tests use only a tiny synthetic Git repository and app."""
import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent


class OfflinePackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="inzone-offline-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "source"
        self.root.mkdir()
        for relative in ["scripts/package_offline.py", "scripts/verify_offline.mjs", "scripts/serve.mjs", "LICENSE"]:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(SOURCE / relative, target)
        for name, data in {
            "package.json": '{"name":"inzone-profile-studio","version":"0.1.0"}\n',
            ".gitignore": "dist/\n.local/\nnode_modules/\n.env\n",
            "docs/RECOVERY.md": "Synthetic recovery instructions. No private data.\n",
            "public/data/catalog.json": '{"profiles":[]}\n',
            "public/data/layout.json": '{"keys":[]}\n',
            "src/should-not-ship.ts": "// Synthetic source must not enter recovery payload.\n",
        }.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data)
        self.git("init", "-q")
        self.git("config", "user.name", "Synthetic Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.git("add", ".")
        self.git("commit", "-qm", "Synthetic public fixture")
        dist = self.root / "dist"
        (dist / "assets").mkdir(parents=True)
        (dist / "index.html").write_text('<script type="module" src="./assets/app.js"></script>\n')
        (dist / "assets/app.js").write_text('// Synthetic built public app.\n')
        shutil.copytree(self.root / "public/data", dist / "data")
        self.output = Path(self.temp.name) / "releases"

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.root, text=True).strip()

    def package(self, *args, success=True):
        result = subprocess.run(["python3", str(self.root / "scripts/package_offline.py"), "--output-dir", str(self.output), *args], cwd=self.root, text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def extract(self):
        extracted = Path(self.temp.name) / "extracted"
        with zipfile.ZipFile(self.output / "inzone-profile-studio-offline.zip") as archive:
            # Only our newly generated archive is extracted by this test.
            archive.extractall(extracted)
        return extracted / "inzone-profile-studio-0.1.0"

    def verify(self, bundle, success=True, packaged=False):
        command = ["node", str(bundle / "verify.mjs")] if packaged else ["node", str(self.root / "scripts/verify_offline.mjs"), str(bundle)]
        result = subprocess.run(command, cwd=Path(self.temp.name), capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def test_allowlisted_payload_checksum_and_dependency_free_verifier(self):
        for name in [".local/private.native.json", "node_modules/unused.js", ".env"]:
            target = self.root / name
            target.parent.mkdir(exist_ok=True)
            target.write_text("SYNTHETIC NONPUBLIC SENTINEL; NEVER SHIP\n")
        self.package()
        archive = self.output / "inzone-profile-studio-offline.zip"
        checksum = (self.output / "inzone-profile-studio-offline.zip.sha256").read_text()
        self.assertEqual(checksum, hashlib.sha256(archive.read_bytes()).hexdigest() + "  inzone-profile-studio-offline.zip\n")
        with zipfile.ZipFile(archive) as bundle:
            names = {name.removeprefix("inzone-profile-studio-0.1.0/") for name in bundle.namelist()}
            self.assertEqual(names, {"dist/index.html", "dist/assets/app.js", "dist/data/catalog.json", "dist/data/layout.json", "scripts/serve.mjs", "verify.mjs", "START-HERE.md", "LICENSE", "release.json", "SHA256SUMS"})
            self.assertEqual(len(names), len(bundle.namelist()))
            release = json.loads(bundle.read("inzone-profile-studio-0.1.0/release.json"))
            self.assertEqual(release["source_commit"], self.git("rev-parse", "HEAD"))
            self.assertFalse(release["dirty"])
            self.assertFalse(any(b"NONPUBLIC SENTINEL" in bundle.read(name) for name in bundle.namelist()))
        recovered = self.extract()
        self.verify(recovered)
        self.verify(recovered, packaged=True)

    def test_dirty_source_is_refused_unless_explicit_preview(self):
        (self.root / "not-reviewed.txt").write_text("synthetic untracked work\n")
        result = self.package(success=False)
        self.assertIn("tracked or untracked changes", result.stderr)
        self.package("--allow-dirty")
        release = json.loads((self.extract() / "release.json").read_text())
        self.assertTrue(release["dirty"])

    def test_identical_rerun_is_stable_and_changed_existing_archive_is_refused(self):
        self.package()
        archive = self.output / "inzone-profile-studio-offline.zip"
        before = archive.read_bytes()
        self.package()
        self.assertEqual(archive.read_bytes(), before)
        (self.root / "dist/assets/app.js").write_text("// Different synthetic build.\n")
        self.assertIn("Refusing to overwrite", self.package(success=False).stderr)
        self.assertEqual(archive.read_bytes(), before)

    def test_missing_stale_unexpected_and_symlink_build_inputs_are_refused(self):
        data = self.root / "dist/data/catalog.json"
        original = data.read_bytes()
        data.unlink()
        self.assertIn("Missing or stale public data", self.package(success=False).stderr)
        data.write_text('{"stale":true}')
        self.assertIn("Missing or stale public data", self.package(success=False).stderr)
        data.write_bytes(original)
        extra = self.root / "dist/raw-export.json"
        extra.write_text('{"SYNTHETIC_ONLY":true}')
        self.assertIn("Unexpected dist file", self.package(success=False).stderr)
        extra.unlink()
        (self.root / "dist/assets/link.js").symlink_to(self.root / "src/should-not-ship.ts")
        self.assertIn("Symlinks are not allowed", self.package(success=False).stderr)
        (self.root / "dist/assets/link.js").unlink()
        for name in ["Case/a.js", "case/b.js"]:
            asset = self.root / "dist/assets" / name
            asset.parent.mkdir()
            asset.write_text("// Synthetic case collision.\n")
        self.assertIn("Case-colliding bundle paths", self.package(success=False).stderr)

    def test_corrupt_missing_unlisted_and_symlink_payloads_fail_verification(self):
        self.package()
        recovered = self.extract()
        app = recovered / "dist/assets/app.js"
        original = app.read_bytes()
        app.write_text("// Corrupt synthetic payload.\n")
        self.assertIn("Checksum mismatch", self.verify(recovered, success=False).stderr)
        app.unlink()
        self.assertIn("Missing payload", self.verify(recovered, success=False).stderr)
        app.write_bytes(original)
        extra = recovered / "extra.txt"
        extra.write_text("unlisted\n")
        self.assertIn("Unlisted file", self.verify(recovered, success=False).stderr)
        extra.unlink()
        app.unlink()
        app.symlink_to(self.root / "dist/assets/app.js")
        self.assertIn("Symlinks are not allowed", self.verify(recovered, success=False).stderr)

    def test_unsafe_and_duplicate_manifest_paths_are_refused(self):
        self.package()
        recovered = self.extract()
        sums = recovered / "SHA256SUMS"
        original = sums.read_text()
        sums.write_text(original + original.splitlines()[0] + "\n")
        self.assertIn("Duplicate or invalid checksum", self.verify(recovered, success=False).stderr)
        sums.write_text(original + "0" * 64 + "  ../escape.txt\n")
        self.assertIn("Unsafe payload path", self.verify(recovered, success=False).stderr)
        sums.write_text(original + "0" * 64 + "  /absolute.txt\n")
        self.assertIn("Unsafe payload path", self.verify(recovered, success=False).stderr)

    def test_regular_file_manager_metadata_is_ignored_but_symlinks_are_refused(self):
        self.package()
        recovered = self.extract()
        names = [".DS_Store", "dist/Thumbs.db", "dist/assets/desktop.ini"]
        for name in names:
            (recovered / name).write_text("Synthetic file-manager metadata.\n")
        self.verify(recovered)
        for name in names:
            metadata = recovered / name
            metadata.unlink()
            metadata.symlink_to(self.root / "dist/assets/app.js")
            self.assertIn("Symlinks are not allowed", self.verify(recovered, success=False).stderr)
            metadata.unlink()
            metadata.write_text("Synthetic file-manager metadata.\n")
        sums = recovered / "SHA256SUMS"
        original = sums.read_text()
        thumbs = recovered / "dist/Thumbs.db"
        sums.write_text(original + hashlib.sha256(thumbs.read_bytes()).hexdigest() + "  dist/Thumbs.db\n")
        self.verify(recovered)
        thumbs.write_text("Changed listed metadata.\n")
        self.assertIn("Checksum mismatch", self.verify(recovered, success=False).stderr)
        sums.write_text(original + "0" * 64 + "  .DS_Store\n")
        self.assertIn("Unsafe payload path", self.verify(recovered, success=False).stderr)

    def test_unsupported_node_line_has_a_readable_error_without_stack(self):
        script = (self.root / "scripts/verify_offline.mjs").as_uri()
        code = "Object.defineProperty(process.versions, 'node', {value: '24.0.0'}); await import(" + json.dumps(script) + ");"
        result = subprocess.run(["node", "--input-type=module", "-e", code], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stderr.strip(), "Verification failed: Use Node.js 22.12 or later on the Node 22 line.")


if __name__ == "__main__":
    unittest.main()
