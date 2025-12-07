
import '@tiptap/core'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tableCommands: {
            addRowBeforeWithAttrs: () => ReturnType
            addRowAfterWithAttrs: () => ReturnType
            addColumnBeforeWithAttrs: () => ReturnType
            addColumnAfterWithAttrs: () => ReturnType
        }
    }
}
