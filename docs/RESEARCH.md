# Research and development queue

Read [foundations](FOUNDATIONS.md), [current delivery](../NEXT.md) and Git status
before choosing work. These IDs stay stable as questions are resolved. Pick the
first actionable item, record its evidence and update NEXT.md; do not work around
missing physical participation or duplicate another agent's work.

| ID / state | Observed question | Next bounded action | Completion evidence |
| --- | --- | --- | --- |
| Q-01 · completed 2026-10-30 | Can a look survive a save/open/share round trip? | Save palette and Open palette JSON now complete this path. Opening validates all 81 illuminated keys and mirrored pairs; imported metadata cannot confer acceptance. | The actual browser-saved file reopened at a fresh local origin with all 81 colors equal. After its local draft was removed, a URL-only tab reconstructed the same colors. Missing/duplicate keys and native-shaped files failed visibly without changing the preview; 26 tests and the build passed. |
| Q-03 · prepared; needs physical trial | Can punctuation landmarks help without fragmenting the green writing field? | Three [preview studies](PUNCTUATION-STUDIES.md) are prepared. The owner can choose one to trial; keep controls and F banks fixed. | Owner identifies a useful distinction from typing distance, or retain the keeper and close the study. A preview alone cannot resolve physical usefulness. |
| Q-02 · needs recipient | Can another owner use a look while preserving their own setup? | Walk through one recipient's fresh same-slot export privately. Check supported format before preparing; record only a generic compatibility result. | Fresh readback preserves unrelated fields; recipient confirms legibility and behavior. Until then, do not claim second-keyboard or Mac acceptance. |
| Q-04 · completed 2026-10-30 | What remains usable if the workstation or network disappears? | Versioned public ZIP, checksums and [recovery guide](RECOVERY.md); Node 22.12+ on the 22 line, no npm or project dependencies for the extracted app. | Clean-directory Node server delivered all 15 assets with exact hashes in a loopback-only namespace with no routes. A fresh-port browser recovered all 81 colors from a public-site saved palette. Eight packaging tests cover integrity, boundaries and recovery failures; 26 app tests remain green. The browser itself was not network-disabled. |
| Q-05 · ready, next | Local copies produce loopback share URLs. Can explicit sharing open the public studio for a recipient? | Separate public sharing/assistant URLs from local address-bar state. Show the generated URL for inspection and manual copying. | Local/offline sharing targets the published subdirectory and reconstructs exact colors without private metadata; local editing stays on its origin. No accounts or remote storage needed. |

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

## Stop and report

Each continuation should leave one reviewable improvement or a precise evidence
gap. Stop widening scope once its completion evidence passes. Wait for genuine
recipient input when required; improve an independent ready item meanwhile.
Keep resolved results compact and link the relevant commit or check. Do not keep
retesting unchanged software, invoke Claude on a schedule alone, or generate
variations merely to fill the queue.
