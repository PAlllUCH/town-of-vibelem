# Phase C: Locale Toggle + Polish/English Name Routing

## Context
- Role definitions already have `namePl` field (in `js/engine/01-roles.js`)
- Locale helpers already exist: `E.locale`, `E.setLocale(loc)`, `E.roleName(id, locale)`, `E.roleBlurb(id, locale)`
- localStorage key: `tov.locale` (default: `'pl'`)
- User wants: PL default, persist choice, both names inline compact (PL above EN)

## Files to touch
- `js/app/config.js` — initialize locale on APP.init, expose `APP.locale`
- `js/app/persistence.js` — persist locale in the save payload
- `js/app/router.js` or `js/ui/common.js` — locale toggle button (top bar or settings)
- `js/ui/setup.js` — use locale names in deck preview and role picker
- `js/ui/seats.js` — use locale names in seat grid and detail sheet
- `js/ui/wizard.js` — use locale names in night wizard steps
- `js/ui/end.js` — use locale names in end-of-game reveal
- `js/ui/reference.js` — use locale names in reference screen
- `js/ui/day.js` / `js/ui/panels.js` — use locale names in day phase

## Locale toggle button
Add a simple PL | EN toggle button in the top bar or settings area. On tap:
1. Call `E.setLocale(newLocale)`
2. Update `APP.locale`
3. Re-render the current screen

The button should be visually compact, 44px touch target, with the active locale highlighted.

## Name display convention
Throughout the UI, for each role name:
- Active locale name in normal weight
- Other locale name in smaller muted text below or beside it

Use `E.roleName(id, APP.locale)` for primary and `E.roleName(id, otherLocale)` for secondary.

## Output format
Edit each file in-place. Follow existing code style (IIFE wrapping, var E pattern). Do not add comments. Output complete files via [FILE] blocks.
