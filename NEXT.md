# Next useful work

The first goal is a working, durable studio whose interactions match their labels.
Preserve the accepted Amber Hinge + Rose design and the simpler Amber Hinge
reference. The palette collection records physical-trial status separately from
any visitor's device state.

## Current delivery

- TypeScript studio: palette preview, shareable selection, secondary comparisons
  and local draft tools, browser-local native preparation/readback verification.
- Nine curated US81 palettes, with private source records kept outside Git.
- CI checks public data, native adapter tests and production build.
- Repository audience and deployment status are recorded in the delivery notes.

## Next priority

The first browser acceptance pass is complete: palette switching, two-key
comparison, paired edits, draft status, share-link restoration after reload,
browser-local preparation and match/mismatch feedback, and 320px layout were
checked. The browser-prepared file from a real local source matched the original
Python converter exactly. This was offline preparation, not a new hardware write.
Nineteen unit/integration tests and the production build pass, including stale
file-read ownership after clearing/closing/changing source contexts. The source
HTML also provides a visible local-file fallback before module loading.

Next, complete the **save/open palette round trip**. The app downloads palette
designs but does not yet reopen them as local drafts. Add a clearly labeled local
palette import with exact 81-key/illuminated/pair validation and no promotion to
curated acceptance. A shared imported look must encode its colors against a
published base ID so a second browser can reconstruct it without private storage.
Keep this secondary to browsing and the existing safe native workflow. Review
current work and user feedback before implementing; don't duplicate completed work.

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
