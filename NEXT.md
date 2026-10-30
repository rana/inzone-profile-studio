# Next useful work

Read [foundations](docs/FOUNDATIONS.md) and the [research/open questions queue](docs/RESEARCH.md)
before choosing work. Q-01 is complete; Q-04 is the next autonomous task. Q-03 has
[three punctuation previews](docs/PUNCTUATION-STUDIES.md) prepared for a chosen
physical trial. A preview is not an installed or accepted design.

The first goal is a working, durable studio whose interactions match their labels.
Preserve the accepted Amber Hinge + Rose design and the simpler Amber Hinge
reference. The palette collection records physical-trial status separately from
any visitor's device state.

## Current delivery

- TypeScript studio: palette preview, shareable selection, secondary comparisons,
  local draft tools and save/open palette recovery; browser-local native
  preparation/readback verification remains separate.
- Nine curated US81 palettes, with private source records kept outside Git.
- CI checks public data, native adapter tests and production build.
- Rana chose a public project and GitHub Pages for sharing with a second keyboard
  owner. The public app is https://rana.github.io/inzone-profile-studio/ and the
  source is https://github.com/rana/inzone-profile-studio. Private native exports,
  photographs and raw feedback remain outside this repository.

## Next priority

The first browser acceptance pass is complete: palette switching, two-key
comparison, paired edits, draft status, share-link restoration after reload,
browser-local preparation and match/mismatch feedback, and desktop layout were
checked. The browser-prepared file from a real local source matched the original
Python converter exactly. This was offline preparation, not a new hardware write.
Twenty-six unit/integration tests and the production build pass, including stale
file-read ownership after clearing/closing/changing source contexts. The source
HTML also provides a visible local-file fallback before module loading.

The **save/open palette round trip (Q-01)** is complete. The actual browser-saved
four-key study reopened at a fresh local origin with all 81 colors equal. After
its local draft was removed, a new URL-only tab reconstructed the same colors.
Missing-key, duplicate-key and native-shaped files failed visibly without
changing the current preview. Known/unknown references and literal text names
were checked. Imported metadata never confers acceptance or device state.

Next, complete **Q-04 offline recovery**: prepare one versioned public build and
palette package with hashes and short restore instructions. Verify it from a
clean directory over local HTTP without network or project dependencies,
including reopening a saved palette. Include the small read-only server and its
supported Node requirement. Keep private native rollback backups separate. Stop
when clean-directory recovery works; do not add a service worker, accounts or
another deployment platform without demonstrated need.

After that, make the daughter/second-keyboard first-use path easier using actual
feedback. The native adapter's supported format is deliberately narrow. Confirm
compatibility from an actual second user's fresh export without publishing it.

## Later opportunities

- Make favorite/profile comparisons easier using demonstrated user needs.
- Improve offline/recovery packaging and versioned palette releases.
- Explore a focused palette idea only when it answers an open design question.
- Investigate documented Sony integration if it becomes available; no invented
  one-click device support or background input capture.

## Evidence limits

Color diagrams are RGB assignments, not calibrated LED simulations. The example
four-slot setup is not a live device connection. Native verification proves the
compared files match; physical behavior, USB power-cycle persistence and actual
macOS behavior require their own tests.

This run verifies desktop palette recovery. The current controller did not apply
the requested narrow viewport, so it establishes no new mobile-width result.
System clipboard inspection returned an older tool value; URL reconstruction
was verified independently through the visible address, not that clipboard read.
