"""Package a freshly built public app; run through npm run bundle:offline.

Only the explicit recovery payload is copied. Source cleanliness and hashes are
recorded, but the caller's fresh build is the provenance of compiled JavaScript;
filesystem modification times are deliberately not treated as build evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import stat
import subprocess
import sys
import time
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_NAME = "inzone-profile-studio-offline.zip"
ASSET_SUFFIXES = {".js", ".css", ".svg", ".png", ".ico", ".woff", ".woff2"}


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def safe_path(name: str) -> None:
    parts = PurePosixPath(name).parts
    if (not name or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_./-]*", name)
            or "\\" in name or name.endswith("/") or not parts
            or "/".join(parts) != name
            or any(part in {".", ".."} or part.startswith(".") for part in parts)):
        raise ValueError(f"Unsafe bundle path: {name!r}")


def read_regular(relative: str) -> bytes:
    safe_path(relative)
    path = ROOT
    for part in PurePosixPath(relative).parts:
        path /= part
        if path.is_symlink():
            raise ValueError(f"Symlinks are not allowed in the payload: {relative}")
    if not path.is_file():
        raise ValueError(f"Missing regular payload file: {relative}")
    return path.read_bytes()


def payload_files() -> dict[str, bytes]:
    public = {name for name in git("ls-files").splitlines() if name.startswith("public/data/")}
    if not {"public/data/catalog.json", "public/data/layout.json"}.issubset(public):
        raise ValueError("The tracked public palette collection is incomplete")
    copied_data = {"dist/" + name.removeprefix("public/"): read_regular(name) for name in public}
    dist = ROOT / "dist"
    if dist.is_symlink() or not dist.is_dir():
        raise ValueError("Missing regular dist directory. Run npm run bundle:offline")
    payload: dict[str, bytes] = {}
    for path in sorted(dist.rglob("*")):
        relative = path.relative_to(ROOT).as_posix()
        if path.is_symlink():
            raise ValueError(f"Symlinks are not allowed in the payload: {relative}")
        safe_path(relative)
        if path.is_dir():
            continue
        asset = relative.startswith("dist/assets/") and path.suffix.lower() in ASSET_SUFFIXES
        if relative != "dist/index.html" and relative not in copied_data and not asset:
            raise ValueError(f"Unexpected dist file; rebuild before packaging: {relative}")
        payload[relative] = read_regular(relative)
    if "dist/index.html" not in payload or not any(name.endswith(".js") for name in payload if name.startswith("dist/assets/")):
        raise ValueError("dist lacks the built app entry or JavaScript. Run npm run bundle:offline")
    for name, original in copied_data.items():
        if payload.get(name) != original:
            raise ValueError(f"Missing or stale public data: {name}. Run npm run bundle:offline")
    for source, target in {
        "scripts/serve.mjs": "scripts/serve.mjs",
        "scripts/verify_offline.mjs": "verify.mjs",
        "docs/RECOVERY.md": "START-HERE.md",
        "LICENSE": "LICENSE",
    }.items():
        payload[target] = read_regular(source)
    return payload


def create_archive(allow_dirty: bool) -> tuple[str, bytes]:
    package = json.loads(read_regular("package.json"))
    version = package.get("version")
    if package.get("name") != "inzone-profile-studio" or not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", version):
        raise ValueError("Expected the INZONE package with a safe semantic version")
    dirty = bool(git("status", "--porcelain", "--untracked-files=all"))
    if dirty and not allow_dirty:
        raise ValueError("Working tree has tracked or untracked changes. Commit reviewed work first; --allow-dirty creates a preview only")
    source_commit = git("rev-parse", "HEAD")
    if not re.fullmatch(r"[0-9a-f]{40,64}", source_commit):
        raise ValueError("Could not identify the source commit")
    payload = payload_files()
    release = {
        "schema": "inzone-offline-release/v1", "name": package["name"],
        "version": version, "source_commit": source_commit, "dirty": dirty,
        "runtime": {"node": "22.12 or later on the Node 22 line"},
    }
    payload["release.json"] = (json.dumps(release, indent=2) + "\n").encode()
    payload["SHA256SUMS"] = "".join(
        f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(payload.items())
    ).encode()
    top = f"inzone-profile-studio-{version}"
    epoch = max(315532800, int(git("show", "-s", "--format=%ct", "HEAD")))
    timestamp = time.gmtime(epoch)[:6]
    names: dict[str, str] = {}
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(payload.items()):
            safe_path(name)
            parts = PurePosixPath(name).parts
            for count in range(1, len(parts) + 1):
                prefix = "/".join(parts[:count])
                folded = prefix.casefold()
                if folded in names and names[folded] != prefix:
                    raise ValueError("Case-colliding bundle paths")
                names[folded] = prefix
            entry = zipfile.ZipInfo(f"{top}/{name}", date_time=timestamp)
            entry.create_system = 3
            entry.external_attr = (stat.S_IFREG | 0o644) << 16
            entry.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(entry, data, compresslevel=9)
    return version, output.getvalue()


def write_release(output_dir: Path, archive: bytes) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    zip_path = output_dir / ARCHIVE_NAME
    checksum_path = output_dir / f"{ARCHIVE_NAME}.sha256"
    checksum = f"{hashlib.sha256(archive).hexdigest()}  {ARCHIVE_NAME}\n".encode()
    for path, expected in [(zip_path, archive), (checksum_path, checksum)]:
        if path.is_symlink() or (path.exists() and (not path.is_file() or path.read_bytes() != expected)):
            raise ValueError(f"Refusing to overwrite a different existing release: {path}. Choose a new output directory")
    for path, expected in [(zip_path, archive), (checksum_path, checksum)]:
        if not path.exists():
            with path.open("xb") as stream:
                stream.write(expected)
    return zip_path, checksum_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--allow-dirty", action="store_true", help="Create an explicitly dirty preview; not a production release")
    args = parser.parse_args()
    version, archive = create_archive(args.allow_dirty)
    output_dir = args.output_dir if args.output_dir is not None else ROOT / ".local" / "releases" / f"v{version}"
    zip_path, checksum_path = write_release(output_dir, archive)
    print(f"Offline bundle: {zip_path}\nArchive checksum: {checksum_path}")
    if args.allow_dirty:
        print("Preview mode: inspect release.json; do not publish a dirty preview as a release")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        raise SystemExit(1)
