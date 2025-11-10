# Title toolbar decoupling
- **Owner:** AI
- **Status:** Done
- **Related Docs:** `src/components/layout/EditorLayout.tsx`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/EditorHeader.tsx`, `src/lib/i18n/index.tsx`

## Context
- Decouple the standalone title input from the TipTap document and prevent toolbar controls from activating while the caret is in the title field.
- Simplify formatting controls by removing font-size/family selectors and exposing individual alignment toggles.
- Prep the editor shell for localization by centralizing strings and wiring a lightweight i18n provider.

## Checklist
- [x] Remove syncing logic between the title input and the document heading.
- [x] Gate toolbar context when the title input owns focus so formatting buttons stay inactive.
- [x] Drop font family/size selectors and keep built-in typography.
- [x] Replace the alignment dropdown with explicit left/center/right/justify buttons.
- [x] Support keyboard hand-off between title input and editor body.
- [x] Centralize editor strings into translatable resources.
- [x] Add a `/?` command + shortcuts help modal (dimmed backdrop, close via ESC / X / 버튼).
- [x] Spread slash command vs. toolbar shortcut coverage and ensure slash commands surface their primary shortcut.
- [x] Ensure the editor body flex-fills available height so empty space clicks place the caret at the last paragraph.
- [ ] Register heading/paragraph shortcuts (`Ctrl+Alt+0~6`) in the TipTap keymap.
- [ ] Surface a locale switcher UI that toggles the new i18n context.

## Notes
- Added focus tracking that ignores blur events which move focus into toolbar buttons, preserving the “title focused” state.
- Toolbar reconnects to the editor once the TipTap view regains focus, ensuring normal behavior resumes after typing in the document.
- Focus state transitions now run inside `startTransition` so caret placement updates immediately while toolbar re-rendering happens in the background.
- Title ↔︎ body navigation shortcuts: `Enter`/`ArrowDown` in the title moves the caret to the top of the editor, and `ArrowUp` in the editor returns focus to the title.
- Introduced `I18nProvider`/`useI18n`, replaced hard-coded placeholders/tooltips, and generated locale-aware slash command metadata for future menus.
- `/` help modal now displays slash commands & shortcuts via searchable two-column layout.
- Editor body flex-fills available height so clicking below content moves focus to the last paragraph.
