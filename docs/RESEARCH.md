# Research and development queue

Read [foundations](FOUNDATIONS.md), [current priorities](../NEXT.md) and Git
status before choosing work. These IDs remain stable as questions are resolved.
Each continuation advances one bounded software, research or design question.
Missing participant evidence blocks its own trial, not the ready track.

## Ready software and design investigations

| ID / state | Question | Next bounded action | Completion evidence |
| --- | --- | --- | --- |
| Q-07 · next | Can subtle differences be understood without scanning two entire boards? | Investigate in-place A/B comparison; Q-06 already delivered the readable changed-key list with before/after swatches. Keep the actual selected design distinct from the temporarily viewed reference. | Pointer and keyboard journeys identify the changes; preview toggling cannot silently change sharing, saving or native preparation. |
| Q-08 · ready | Can a family member use the essential journey on a smaller screen? | Test actual narrow viewports through choose → compare → save/open → share. Repair observed friction, including lost context or inaccessible controls. | Record actual viewport dimensions, essential actions, overflow and focus results. A requested viewport override alone is insufficient evidence. |
| Q-10 · ready | Can private trial feedback survive the loss of a chat or browser? | Design a small portable observation record: design identity, room context, distinction/readability result and preference. Use synthetic data to test recovery. | Save/open preserves context and design association. Private records are opt-in and remain outside public assets; a record cannot automatically promote a palette to accepted. |
| Q-12 · ready | Can the latest studies be recovered offline as easily as the older release? | Produce a new versioned recovery release from clean reviewed source after the recent study additions; never replace existing published assets. | Clean extraction serves the exact bundled assets, saved palette recovery works, version/source identity and checksums agree, and the release explicitly states its included features. |

An investigation may end with a useful negative result or a narrower question.
Prefer observed friction and unfinished work, but do not require a new issue or
physical test before investigating independent opportunities. When the ready
queue is exhausted, inspect the user journey and relevant primary references to
propose the next small questions. Avoid random palette generation, feature
accumulation and repeated checks of unchanged software.

## Participant and device investigations

| ID / state | Question | Next action | Completion evidence |
| --- | --- | --- | --- |
| Q-09 · requested revision saved | Which white command keys belong in the green field? | White Tab/Enter were liked in the original context; Caps was requested back in violet. The two-key revision was saved through Sony controls and exactly export-verified. | Keep the component preference and requested revision distinct from a separate full-palette verdict. Earlier three-key colors and identity remain preserved. |
| Q-03 · liked; current choice for the moment | Can punctuation landmarks coexist with the green field? | Operator Ice was liked and selected as the current standalone look. Retain it without automatically adding the gate accents. | Physical preference is recorded; no separate all-legends readability or productivity result was supplied. |
| Q-13 · combined comparison paused by current preference | Does one white accent group or two differently colored groups work better? | Glacier Union combined white gates and operators. In that combined context white Tab felt out of place; standalone Operator Ice was chosen. Glacier Syntax keeps white gates and blue operators as an untested online preview. | Union was saved/export-verified, trialled and removed from its temporary slot; the prior reference was restored exactly. Do not schedule another hardware trial merely because Syntax is prepared. |
| Q-02 · needs recipient | Can another owner use a look while preserving their own setup? | Walk through one recipient's fresh same-slot export privately; check supported format before preparing. | Fresh readback preserves unrelated fields; recipient confirms legibility and behavior. Record only generic compatibility findings publicly. |
| Device tests · needs actual hardware | Do behavior and settings persist across reconnects and work correctly on macOS? | Run USB power-cycle and actual Mac acceptance when those devices are available. | Direct physical and OS observations; file equality and Linux results do not substitute for these tests. |

## Completed software questions

| ID / completed | Question and result | Checked evidence and limits |
| --- | --- | --- |
| Gate revisions · 2026-10-31 | Preserve the original Glacier while comparing a two-gate revision and two combinations. | Exact 2/6/6 changes, violet Caps, three full candidate files and the old 3-key color hash/URL are checked. Browser checks cover exact81 maps, folded history/deep-link recovery, saved-draft preservation and exact-map-only feedback labels. Forty-one app tests and eight packaging tests pass. Saved palette files never inherit trial metadata. |
| Q-11 · preview completed 2026-10-31 | What different overall mood can coexist with the green keeper? [Solar Draft](ALTERNATE-PALETTES.md) uses amber writing, a white number/bracket rail, green Win/Fn and a violet–azure–cyan crown. | Exact 61-key patch and full81 candidate agree; 20 keeper colors remain. Thirty-seven app tests and eight packaging tests pass. All catalog/study palettes convert against a synthetic source while preserving protected data. Actual browser checks confirm 61 differences, named save/open from another reference, refresh/leave recovery and all five study identities. No hardware writes or physical acceptance. This tests a whole composition, not the causal effect of one color. |
| Q-09 · first frame phase completed 2026-10-31 | Can one frame relationship be explored without changing the established landmarks? Glacier Gates changes three command keys to white; punctuation studies remain a separate group. | Local checks pass 35 app tests and eight packaging tests. Browser checks confirm exactly three changes, all 81 lit keys, unchanged other landmarks, public sharing and no horizontal overflow at 390px. The selected first-device trial has exact saved-data readback after Hub reload; physical preference remains pending. This is a small frame refinement, not the substantially different alternate palette now assigned to Q-11. |
| Q-06 · 2026-10-31 | Can prepared refinements be discovered without searching project documents? A named study shelf provides keeper comparison, exact before/after colors and safe return to the prior draft. | Browser checks confirmed exact 1/4/8 changes, retained focus, edits invalidating named identity, reload/leave recovering the saved draft, named save/open and full81 sharing. Native preparation still required an own source. A 390px viewport had no overflow. All 34 app tests and eight packaging tests passed at delivery. |
| Q-01 · 2026-10-30 | Can a look survive save/open/share? Save palette and Open palette JSON complete the recovery path. | An actual browser-saved file reopened at a fresh local origin with all 81 colors equal; URL-only recovery also matched. Missing/duplicate keys and native-shaped files failed without changing the preview. Imported metadata cannot confer acceptance. |
| Q-04 · 2026-10-30 | What remains usable if the workstation or network disappears? A versioned public ZIP includes a verifier and [recovery guide](RECOVERY.md). | Clean extraction served all 15 app assets with exact hashes inside a loopback-only namespace without routes. A fresh-port browser recovered all 81 saved colors; that browser itself was not network-disabled. Eight packaging tests covered integrity, boundaries and recovery failures. Node 22.12+ on the Node 22 line is required. |
| Q-05 · 2026-10-30 | Can sharing from a local copy reach a public recipient? Explicit sharing uses a canonical public URL and all 81 colors. | A local five-key variation reconstructed exactly in the live public decoder; assistant sharing used the same URL. Context changes clear stale links. Thirty app tests and eight packaging tests passed at delivery. Full colors resist reference-color drift, but the published comparison ID must still exist. |

## Patterns worth borrowing

Reviewed 30 October 2026. These are product and architecture references, not Sony
protocol implementations or dependencies.

- [WLED presets](https://kno.wled.ge/features/presets/) use named lighting
  configurations, distinguish which state is saved, and document backup/restore.
  Borrow explicit scope and a complete round trip: a reusable look should say
  what it changes and what stays with the recipient. WLED's device commands and
  preset IDs do not map to Sony slots.
- [VIA's keyboard specification](https://www.caniusevia.com/docs/specification/)
  separates layout/configuration definitions from firmware behavior. Exposing a
  control or labeling a key does not implement the function in hardware. Borrow
  the separation of geometry, palette intent, supported adapter and actual device
  evidence. A VIA definition cannot make this Sony keyboard VIA-compatible.

## Completion and handoff

Define the question, a bounded action and completion evidence before expanding
scope. Review the actual diff, run relevant checks and commit useful completed
work. Update NEXT.md with the next ready action, decisions and remaining limits.
Keep research conclusions distinct from checked software behavior and physical
acceptance. Notify for a useful result, material finding or required
participation; unchanged healthy checks do not need repeated announcements.
