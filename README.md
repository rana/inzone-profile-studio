# INZONE Profile Studio

A small, unofficial studio for the Sony INZONE KBD-H75 US 81-key keyboard:
keep a look you love, compare alternatives, and prepare it for another keyboard
without replacing that keyboard's mappings or performance settings.

The collection opens on **Amber Hinge + Rose**: a green writing field, amber Win/Fn
and rose Shift keys. Plain Amber Hinge is the simpler accepted alternative.
Each palette explains its main landmarks and whether it is an accepted look,
an experiment or a retained reference.

[Foundations and principles](docs/FOUNDATIONS.md) explain what we protect.
[The research and open questions queue](docs/RESEARCH.md) gives the hourly
continuation bounded goals. [Punctuation studies](docs/PUNCTUATION-STUDIES.md)
offer three proposed variations to compare with the keeper.

## Use it

Open [INZONE Profile Studio](https://rana.github.io/inzone-profile-studio/)
in your browser. The public app needs no account or local installation. Share a
palette link with someone who has the same supported keyboard; each person uses
their own fresh Sony export when preparing an import.

Open **Explore punctuation refinements** for three named studies of the keeper.
Each choice compares its exact changed keys against Amber Hinge + Rose. Studies
remain untested on hardware. Browsing, editing and refreshing a trial preserve
your saved variation; **Leave preview** returns to it. Save or share a trial to
keep it independently. Study names are recognized only while every color matches
the proposal, and downloads use distinct study filenames.

Choose a palette to relight the on-screen board. Inspect a key, share the selected
look, or open the secondary comparison and draft tools. Previewing never writes
the keyboard. A downloaded palette is a design file, not a Sony native import.

Use **Save palette** to keep a design JSON, then **Open palette JSON** to recover
it later. Opening validates all 81 illuminated keys and matched modifier pairs.
Changed colors become a local variation with a comparison to the published
original; a matching file shows the existing original. File metadata never adds
physical acceptance. Share links carry the colors without requiring the saved
file or another browser's local storage. Sony native exports use the separate
**Use on my keyboard** workflow.

**Copy share link** and **Copy assistant request** use the public studio even
when you are running a local or offline copy. The visible **Public share link**
field can be selected manually, and **Open shared preview** checks the recipient's
view. The link carries all 81 colors so later reference-color edits do not alter
the look. It uses a published comparison palette ID; that ID must remain in the
public collection. Opening the public preview needs internet. Local edits stay
on the local page, and no native export or file metadata is included.

To use a look on your own keyboard:

1. Open [Sony Hub](https://inzone-hub-for-web.sony.net/), identify the intended
   hardware slot, and export that slot. Keep the original as your rollback.
2. Choose the same slot number in the studio and open your fresh native export.
   Review the proposed lighting changes before downloading the prepared file.
3. Apply it to that same slot in Sony Hub and Save. The existing profile name,
   key mappings, performance, macros and other unrelated settings are preserved.
4. Export again and use the readback comparison. Every field is compared. Verify
   before optionally renaming the profile; a name change is a real difference.

Files are processed locally in browser memory and are not uploaded. The adapter
supports the inspected Sony Web 1.2.1.0 US81 export shapes. Other versions and
layouts are refused rather than guessed. A file does not contain an authoritative
hardware-slot number: the source-slot association is recorded by you.

## Run locally

Node 22.12 or later on the Node 22 line is suitable for the locked dependencies.

```sh
npm ci
npm run dev
```

Open the printed local HTTP URL. For a production build:

```sh
python3 scripts/check_public_data.py
npm test
npm run build
npm start
```

The local app opens at `http://127.0.0.1:4173/`. The read-only local server serves
only the built `dist/` directory; it has no upload endpoint. Use the built app
through HTTP rather than opening source HTML as a local file. Stop it with
Ctrl+C, or restart it later with `npm start`. `npm run preview` remains available
for development checks. The build supports a GitHub Pages project subdirectory.

## Durable source and public hosting

Keep the [offline ZIP](https://github.com/rana/inzone-profile-studio/releases/latest/download/inzone-profile-studio-offline.zip)
and its [checksum](https://github.com/rana/inzone-profile-studio/releases/latest/download/inzone-profile-studio-offline.zip.sha256)
somewhere separate from the workstation. The [recovery guide](docs/RECOVERY.md)
explains verification, Node requirements and launch without npm or network.
It includes the public collection; save your own variations as palette JSONs
separately. Browser favorites, drafts and private native backups are not bundled.

Git retains the application, palette assignments, layout and checks. The workflow
builds and publishes `dist/` to GitHub Pages on main after the checks pass. The
repository is public, the repository variable `ENABLE_GITHUB_PAGES` is `true`,
and Pages uses GitHub Actions. The local app remains available independently.

Private native exports, local photographs, raw feedback and workstation recovery
archives are deliberately outside this shareable repository. Backing up this repo
does not by itself back up those private files. Keep a separate private backup of
your native exports and actual slot associations.

The original library's internal-template entry-point failure is fixed separately:
its generated `index.html` and legacy `page-template.html` now both contain working
data. This app has one build entry point and reports loading errors visibly.

## Maintain the collection

`public/data/catalog.json` is the curated public index. Palette files contain exact
81-key assignments. `scripts/import_library.py --source /path/to/Profile-Library`
imports only shareable assignments and generic descriptions, never private native
exports or transcripts. Keep palette hashes in `public/data/provenance.json` current.

The hourly continuation should make bounded improvements guided by NEXT.md and
real feedback. It must preserve the daily hardware settings during unattended work.

To build a recovery release from reviewed, committed source (Node 22 and Python
3.9+ available), run `npm run bundle:offline`. It rebuilds first and writes the
ZIP and checksum to `.local/releases/vVERSION/`. A dirty checkout is refused;
`--allow-dirty` on the Python packager is for local previews only. Packaging alone
cannot prove that preexisting JavaScript was rebuilt, so use the wrapper for real
releases. CI checks packaging and integrity scenarios as well as the app tests.

Deployment references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
and [Vite static deployment](https://vite.dev/guide/static-deploy.html#github-pages).

This project is independent of Sony. Product names identify compatibility;
screen colors are design assignments, not measured physical LED output.
