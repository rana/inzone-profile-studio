# Research and development queue

Read [foundations](FOUNDATIONS.md), [current priorities](../NEXT.md) and Git
status before choosing work. These IDs remain stable as questions are resolved.
Each continuation advances one bounded software, research or design question.
Missing participant evidence blocks its own trial, not the ready track.

## Ready software and design investigations

| ID / state | Question | Next bounded action | Completion evidence |
| --- | --- | --- | --- |
| Q-11 · next | What substantially different palette and mood could be useful alongside the keeper? | Develop one motivated alternate color family with recognizable functional groupings. Explain its intended atmosphere, visual hierarchy and tradeoffs; compare it with the accepted reference. Consult Claude for the consequential choice and check the resulting assignments. | Exact 81-key assignments, matched modifiers, a useful shareable comparison and an explicit untested label. Preserve the keeper without treating its green writing-field preference as a ban on other colors or claiming a new daily winner. |
| Q-07 · ready | Can subtle differences be understood without scanning two entire boards? | Investigate in-place A/B comparison; Q-06 already delivered the readable changed-key list with before/after swatches. Keep the actual selected design distinct from the temporarily viewed reference. | Pointer and keyboard journeys identify the changes; preview toggling cannot silently change sharing, saving or native preparation. |
| Q-08 · ready | Can a family member use the essential journey on a smaller screen? | Test actual narrow viewports through choose → compare → save/open → share. Repair observed friction, including lost context or inaccessible controls. | Record actual viewport dimensions, essential actions, overflow and focus results. A requested viewport override alone is insufficient evidence. |
| Q-10 · ready | Can private trial feedback survive the loss of a chat or browser? | Design a small portable observation record: design identity, room context, distinction/readability result and preference. Use synthetic data to test recovery. | Save/open preserves context and design association. Private records are opt-in and remain outside public assets; a record cannot automatically promote a palette to accepted. |

An investigation may end with a useful negative result or a narrower question.
Prefer observed friction and unfinished work, but do not require a new issue or
physical test before investigating independent opportunities. When the ready
queue is exhausted, inspect the user journey and relevant primary references to
propose the next small questions. Avoid random palette generation, feature
accumulation and repeated checks of unchanged software.

## Participant and device investigations

| ID / state | Question | Next action | Completion evidence |
| --- | --- | --- | --- |
| Q-09 · first frame phase prepared; physical trial selected | Does a neutral command group add distinction without dominating the green field? | Trial [Glacier Gates](FRAME-STUDIES.md), which changes only Tab, Caps Lock and Enter from violet to white. The owner has selected the trial; use a fresh same-slot backup and strict readback, keeping the accepted reference available. | Physical distinction, legibility and preference from typing distance, recorded separately from software checks. Selection and preview do not establish installation or acceptance. |
| Q-03 · physical trial selected | Can punctuation landmarks help without fragmenting the green writing field? | Trial Operator Ice from the [punctuation studies](PUNCTUATION-STUDIES.md) separately from Glacier Gates. Use a fresh same-slot export and preserve the accepted reference. | The owner identifies a useful distinction from typing distance, or prefers the keeper and closes that study. Preview alone cannot establish usefulness. |
| Q-02 · needs recipient | Can another owner use a look while preserving their own setup? | Walk through one recipient's fresh same-slot export privately; check supported format before preparing. | Fresh readback preserves unrelated fields; recipient confirms legibility and behavior. Record only generic compatibility findings publicly. |
| Device tests · needs actual hardware | Do behavior and settings persist across reconnects and work correctly on macOS? | Run USB power-cycle and actual Mac acceptance when those devices are available. | Direct physical and OS observations; file equality and Linux results do not substitute for these tests. |

## Completed software questions

| ID / completed | Question and result | Checked evidence and limits |
| --- | --- | --- |
| Q-09 · first frame phase completed 2026-10-31 | Can one frame relationship be explored without changing the established landmarks? Glacier Gates changes three command keys to white; punctuation studies remain a separate group. | Local checks pass 35 app tests and eight packaging tests. Browser checks confirm exactly three changes, all 81 lit keys, unchanged other landmarks, public sharing and no horizontal overflow at 390px. Physical trial remains pending; this is a small frame refinement, not the substantially different alternate palette now assigned to Q-11. |
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
