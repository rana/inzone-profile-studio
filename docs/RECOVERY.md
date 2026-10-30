# Keep the studio available offline

The offline package keeps the built app and public palette collection usable
without this workstation, GitHub or a package installation. It does not restore
private keyboard backups or another browser’s saved state.

The nine public palettes are included. **Your own drafts and favorites are not**:
use Save palette to keep important variations as JSON files while the browser is
still available, and back up those files separately.

## Keep a recovery copy

While online, download the [offline ZIP](https://github.com/rana/inzone-profile-studio/releases/latest/download/inzone-profile-studio-offline.zip)
and its [ZIP checksum](https://github.com/rana/inzone-profile-studio/releases/latest/download/inzone-profile-studio-offline.zip.sha256).
Keep both somewhere separate from the workstation. The
[latest release](https://github.com/rana/inzone-profile-studio/releases/latest)
also identifies the published version and source.

Node is required but is **not bundled**. The tested requirement is Node 22.12 or
later on the Node 22 line. Have that runtime available before relying on offline
recovery; check it with `node --version`.

Before extraction, Ubuntu users can check the separately downloaded ZIP from the
folder containing both downloads:

```sh
sha256sum -c inzone-profile-studio-offline.zip.sha256
```

Checksums detect missing or changed bytes. They do not establish authenticity if
both a file and its checksum were replaced; retain the release source and your
trusted copy together.

Extract the ZIP into a **new directory**, preserving any existing library or
installation. It contains one top-level folder named for the release version
(for example, `inzone-profile-studio-0.1.0`), with:

- `dist/`: the built app, keyboard layout and public palettes.
- `scripts/serve.mjs`: the small read-only local server.
- `verify.mjs`, `SHA256SUMS` and `release.json`: integrity checks and release identity.
- `LICENSE` and `START-HERE.md`: the license and this guide.

## Verify and open it

In a terminal, enter the extracted top-level folder and run:

```sh
node verify.mjs
node scripts/serve.mjs
```

If verification reports a missing or changed file, stop and extract a clean copy
of the archive. Regular operating-system folder metadata is ignored; every
listed payload file is checked.

Open `http://127.0.0.1:4173/` in your browser. Open the HTTP address rather than
an HTML file directly. Once Node and the package are available, the core app
needs no `npm`, dependency installation or network connection.

Keep the terminal running; press **Ctrl+C** to stop. If port 4173 is busy, close
the previous studio server first, then start this copy again.

## Recover a saved look

Use **Save palette** to keep a portable design JSON outside the browser. In a
fresh copy of the studio, choose **Open palette JSON**, select that saved file,
and compare its colors with the published original. All 81 keys must be present,
illuminated, and consistent across paired modifiers. A changed design remains a
local variation; file metadata cannot confer physical acceptance.

The package includes the public collection and its recorded evidence, including
the Amber Hinge + Rose keeper. It does not contain your browser’s favorites or
local drafts. Browser storage belongs to its browser profile and origin, so save
important variations as palette files in your own backup location.

## What still needs your own backup or connection

Previewing, editing, opening palettes, preparing a native file and comparing a
readback work locally. Sony Hub and GitHub links need an internet connection.
Nothing in the studio directly writes a keyboard.

Keep private native exports, actual source-slot records, rollback files,
photographs and workstation backups separately. They are not in the public ZIP
or repository. Native files opened in the studio are not uploaded.

A palette is portable design intent; a complete native export is not portable
across devices or slots. Prepare from your own fresh export of the intended
physical slot, preserve the original, apply through Sony Hub, Save, then verify
every field in a fresh same-slot readback. The supported format remains the
inspected KBD-H75 US81 Sony Web 1.2.1.0 shape. Offline recovery establishes neither
physical legibility, hardware persistence nor actual Mac acceptance.
