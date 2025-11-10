import { Extension } from '@tiptap/core'
import { headingSlashCommandDefinitions } from '../slashCommands'

const aliasMap = new Map(headingSlashCommandDefinitions.map((command) => [command.alias.toLowerCase(), command]))

export const SlashHeadingExtension = Extension.create({
  name: 'slash-heading',

  addKeyboardShortcuts() {
    const applyHeadingCommand = () => {
      const { state } = this.editor
      const { selection } = state

      if (!selection.empty) {
        return false
      }

      const { $from } = selection
      const parent = $from.parent

      if (parent.type.name !== 'paragraph') {
        return false
      }

      const textBeforeCaret = parent.textBetween(0, $from.parentOffset, '\0', '\0')
      const match = textBeforeCaret.match(/\/(h[1-6])$/i)

      if (!match) {
        return false
      }

      const alias = match[1].toLowerCase()
      const command = aliasMap.get(alias)

      if (!command) {
        return false
      }

      const matchText = match[0]
      const parentStart = $from.start()
      const end = parentStart + $from.parentOffset
      const start = end - matchText.length

      this.editor
        .chain()
        .focus()
        .deleteRange({ from: start, to: end })
        .setHeading({ level: command.level })
        .run()

      return true
    }

    return {
      Enter: () => applyHeadingCommand(),
      ' ': () => applyHeadingCommand(),
      Space: () => applyHeadingCommand(),
    }
  },
})
