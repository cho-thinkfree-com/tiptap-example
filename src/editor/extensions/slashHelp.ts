import { Extension } from '@tiptap/core'

export type SlashHelpOptions = {
  onShowHelp?: () => void
}

export const SlashHelpExtension = Extension.create<SlashHelpOptions>({
  name: 'slash-help',

  addOptions() {
    return {
      onShowHelp: undefined,
    }
  },

  addKeyboardShortcuts() {
    const triggerHelp = () => {
      const { state } = this.editor
      const { selection } = state

      if (!selection.empty) {
        return false
      }

      const { $from } = selection
      const parent = $from.parent

      if (!parent.isTextblock) {
        return false
      }

      if ($from.parentOffset === 0) {
        return false
      }

      const charBefore = state.doc.textBetween($from.pos - 1, $from.pos, '\0', '\0')
      if (charBefore !== '/') {
        return false
      }

      const textBeforeSlash = parent.textBetween(0, $from.parentOffset - 1, '\0', '\0')
      if (textBeforeSlash.trim().length > 0) {
        return false
      }

      this.editor
        .chain()
        .focus()
        .deleteRange({ from: $from.pos - 1, to: $from.pos })
        .run()

      this.options.onShowHelp?.()

      return true
    }

    return {
      'Shift-Slash': () => triggerHelp(),
      'Shift-/': () => triggerHelp(),
      '?': () => triggerHelp(),
    }
  },
})
