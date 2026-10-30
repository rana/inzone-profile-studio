# INZONE Profile Studio

Read README.md, NEXT.md, docs/FOUNDATIONS.md and docs/RESEARCH.md, then inspect Git
status before editing. This repository
owns the shareable app and curated RGB designs. Each user owns their keyboard,
source-slot exports, private feedback and rollback history.

- Keep the primary journey simple: choose a look, preview it, share it, then use
  your own export to prepare a same-slot import. Advanced editing stays secondary.
- Never imply that a preview, file download or saved example setup changed a
  connected keyboard. The app has no direct device-writing capability.
- All 81 physical keys remain lit. Keep paired left/right modifiers consistent.
  Requested RGB values do not establish equal physical brightness or readability.
- Candidate palettes are not Sony imports. Prepare from a real, complete export
  of the actual intended slot; preserve the profile name, Main/Fn mappings,
  actuation, Rapid Trigger, macros, unused effects, reserved entries and metadata.
- Native exports lack an authoritative slot number. Ask the user to identify the
  source slot explicitly; repeat that association in the prepared file name and
  instructions. Do not infer a slot from the profile name.
- Native files stay in browser memory. Refuse unrecognized/malformed formats;
  never upload files or silently expand supported firmware/layout assumptions.
- Verification compares every field. Do not ignore unexpected differences or
  replace user assignments with guessed defaults. Back up before real writes.
- Keep private transcripts, photographs, workstation paths, credentials and raw
  native exports out of Git and public assets. Local state goes in ignored .local/.
- Hardware changes require an actual user-selected trial and a local connection;
  unattended hourly work improves the app or prepares designs without changing
  the daily keyboard or mouse. Physical color acceptance is a separate observation.
- Coordinate concurrent work. Review the actual diff, run meaningful validation,
  and commit completed improvements. Respect the repository's recorded audience.
- Maintain NEXT.md with one next useful task and clear evidence limits. Do not
  generate palette variations or call Claude merely to satisfy a schedule.
- Build offline releases from clean reviewed commits with `npm run bundle:offline`.
  Preserve published tags and assets; bump the version before another release.
  The public recovery payload never includes private backups or browser state.

Checks: `python3 scripts/check_public_data.py`, `npm test`, `npm run test:offline`,
`npm run build`.
Use the supported browser surface for UI testing. Do not work around a blocked
local-file browser action or open unrelated user tabs.
