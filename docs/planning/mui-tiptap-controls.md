# mui-tiptap Controls Audit

`mui-tiptap@1.28.1` exports the following controls and helper extensions. This checklist tracks which Tiptap packages we must include alongside `StarterKit` to light up the full toolbar.

## Required Tiptap Packages

- Core/peer requirements: `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/extension-heading`, `@tiptap/extension-image`, `@tiptap/extension-table`
- Inline formatting: `@tiptap/extension-underline`, `@tiptap/extension-highlight`, `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-font-family`
- Structural formatting: `@tiptap/extension-text-align`, `@tiptap/extension-horizontal-rule`
- Advanced marks/nodes: `@tiptap/extension-subscript`, `@tiptap/extension-superscript`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-link`
- Cursor helpers: `@tiptap/extension-dropcursor`, `@tiptap/extension-gapcursor`

> StarterKit already bundles blockquote, bold, bullet/ordered lists, code/code block, history, italic, list item, paragraph, strike, and undo/redo support—those power the matching `MenuButton*` controls out of the box.

## mui-tiptap Controls ↔︎ Extension Matrix

| Control(s) | Backing extension(s) |
| --- | --- |
| `MenuSelectHeading` | `HeadingWithAnchor` (mui-tiptap) or Tiptap `Heading` |
| `MenuSelectFontFamily` | `@tiptap/extension-font-family`, `@tiptap/extension-text-style` |
| `MenuSelectFontSize` | `FontSize` (mui-tiptap), `@tiptap/extension-text-style` |
| `MenuSelectTextAlign`, `MenuButtonAlign*` | `@tiptap/extension-text-align` |
| `MenuButtonBold`, `MenuButtonItalic`, `MenuButtonCode`, `MenuButtonCodeBlock`, `MenuButtonStrikethrough`, `MenuButtonBlockquote` | `StarterKit` |
| `MenuButtonUnderline` | `@tiptap/extension-underline` |
| `MenuButtonHighlightToggle`, `MenuButtonHighlightColor` | `@tiptap/extension-highlight` |
| `MenuButtonTextColor`, `MenuButtonColorPicker` | `@tiptap/extension-color`, `@tiptap/extension-text-style` |
| `MenuButtonSubscript`, `MenuButtonSuperscript` | `@tiptap/extension-subscript`, `@tiptap/extension-superscript` |
| `MenuButtonBulletedList`, `MenuButtonOrderedList`, `MenuButtonIndent`, `MenuButtonUnindent` | `StarterKit` lists (`BulletList`, `OrderedList`, `ListItem`) |
| `MenuButtonTaskList` | `@tiptap/extension-task-list`, `@tiptap/extension-task-item` |
| `MenuButtonHorizontalRule` | `@tiptap/extension-horizontal-rule` |
| `MenuButtonAddTable`, `TableMenuControls`, `TableBubbleMenu` | `TableImproved` (mui-tiptap), plus Tiptap table extensions (`@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`) |
| `MenuButtonAddImage`, `MenuButtonImageUpload`, `ResizableImage` | `ResizableImage` (mui-tiptap), `@tiptap/extension-image` |
| `MenuButtonEditLink`, `LinkBubbleMenu` | `@tiptap/extension-link`, `LinkBubbleMenuHandler` (mui-tiptap) |
| `MenuButtonUndo`, `MenuButtonRedo`, `MenuButtonRemoveFormatting` | `StarterKit` (`History`, `ClearNodes`, `UnsetAllMarks`) |

## Next Steps

- [x] Install all required packages (`npm install …`) so peer dependency warnings are resolved.
- [ ] Wire these extensions into the editor schema (`src/editor/extensions/*`).
- [ ] Compose toolbar groups in `MenuControlsContainer` using the audited components.
