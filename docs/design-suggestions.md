# Town of Vibelm — Designer Audit & Suggestions

## Current State Summary

**Strengths:**
- **Cohesive Dark Theme:** The `--bg` to `--panel` to `--accent` color system is well-balanced and provides a professional, focused atmosphere suitable for a moderator's companion.
- **Consistent Component System:** Buttons, cards, tags, and the flow strip are used consistently across screens, providing a predictable user experience.
- **Strong Mobile Foundation:** Respect for the 44px touch target minimum and use of the bottom bar for primary actions shows good mobile-first thinking.
- **Clear Night Wizard:** The wizard successfully breaks down complex night actions into manageable steps.

**Weaknesses:**
- **Arm's-Length Legibility:** Several key UI elements (flow strip labels, status tags, seat labels) are too small for a moderator glancing at the phone from across a table.
- **Action Weight:** While functional, some buttons and tiles lack the visual weight needed for high-stakes moments like voting or recording deaths.
- **Visual Hierarchy Gaps:** Important prompts (like the Wizard's read-aloud text) don't always stand out enough from secondary information.
- **Brand Identity:** The "Town of Vibelm" identity is currently quite generic; the icon and header could better reflect the social deduction "vibe".

---

## Prioritized Suggestions

### P1 — Must (Ergonomics & Core Legibility)

| # | Suggestion | Where (Screen/File) | Why | Effort |
|---|---|---|---|---|
| 1 | **Increase Wizard Prompt Size:** Bump the `.wizard-prompt` font size from 1.1rem to 1.3rem and increase line-height to 1.6. | Night / `game.css` | The moderator must read this aloud; it is the most critical text on screen during the night. | S |
| 2 | **Bolder Flow Strip:** Increase `.flow-label` size to .82rem and add a bottom-border or box-shadow to the active `.flow-step`. | All Game Screens / `base.css` | The flow strip is the primary orientation tool; it's currently too subtle to see at arm's length. | S |
| 3 | **Larger Status Tags:** Increase `.tag` font size from .62rem to .72rem and add slightly more padding (3px 8px). | Seats / `base.css` | Tags like "JAILED" or "PROTECTED" are vital status indicators that are currently hard to read. | S |
| 4 | **Bottom Bar Contrast:** Add a more opaque background or a subtle top-border to the `.bottom-bar` to separate it from the scrollable content. | Game / `base.css` | Ensures the primary action buttons are always clearly distinguishable from the body. | S |

### P2 — Should (Polish & Feedback)

| # | Suggestion | Where (Screen/File) | Why | Effort |
|---|---|---|---|---|
| 5 | **Tactile Seat Tiles:** Add an `inset box-shadow` or a subtle background shift on `:active` for `.seat-tile` and `.seat-dealt`. | Seats / `seats.css` | Provides better physical feedback when the moderator interacts with the player grid. | S |
| 6 | **Trial Voting Clarity:** Add a "Ghost" icon or a more distinct background color for `.ghost-voter` rows. | Day / `game.css` | Clearly distinguishes ghost votes from living votes during the critical trial phase. | M |
| 7 | **Timer Urgency:** Add a "danger" class to `.timer-count` and `.timer-ring` when under 30 seconds, changing the accent to `--bad`. | Day / `game.css` | Increases the visual pressure of the discussion timer as it nears zero. | S |
| 8 | **Toast Variety:** Implement toast variants (`.toast-success`, `.toast-warn`, `.toast-error`) with corresponding icons or border colors. | Global / `base.css` | Provides immediate, non-text-based feedback for different types of system messages. | M |

### P3 — Could (Micro-interactions & Brand)

| # | Suggestion | Where (Screen/File) | Why | Effort |
|---|---|---|---|---|
| 9 | **Stepper Animation:** Add a brief scale pulse (1.0 -> 1.1 -> 1.0) to `.stepper-num strong` when the count is incremented/decremented. | Setup / `setup.css` | Adds a playful, responsive feel to the setup configuration. | S |
| 10 | **Reference Search Polish:** Style the `.reference-search` with a magnifying glass icon (via CSS `::before`) and a subtle inner shadow. | Reference / `reference.css` | Makes the search bar more intuitive and visually integrated with the dark theme. | S |
| 11 | **Icon Refinement:** Update `icon.svg` to include a more thematic "Town Hall" or "Clocktower" silhouette rather than the current abstract shapes. | Global / `icon.svg` | Strengthens the "Town of Vibelm" brand identity. | M |
| 12 | **Seat Layout Transitions:** Add a subtle `opacity` and `transform` transition to seat tiles when switching between naming and dealt modes. | Seats / `seats.css` | Makes the transition between setup and game feel more fluid. | S |
