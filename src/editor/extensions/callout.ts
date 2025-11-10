import { Node, mergeAttributes, findParentNode } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: 'info' | 'warning' | 'error' | 'success') => ReturnType,
      toggleCallout: (type: 'info' | 'warning' | 'error' | 'success') => ReturnType,
      unsetCallout: () => ReturnType,
    }
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  draggable: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || 'info',
        renderHTML: attributes => {
          return {
            'data-callout-type': attributes.type,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
        getAttrs: element => {
          return { type: element.getAttribute('data-callout-type') || 'info' }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout-block' }), 0]
  },

  addCommands() {
    return {
      setCallout:
        (type) =>
        ({ commands, state }) => {
          const { selection } = state
          const parent = findParentNode(node => node.type.name === this.name)(selection)

          if (parent) {
            return commands.updateAttributes(this.name, { type })
          }

          return commands.insertContent({
            type: this.name,
            attrs: { type },
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ' ', // Placeholder text
                  },
                ],
              },
            ],
          })
        },
      toggleCallout:
        (type) =>
        ({ commands }) => {
          return commands.toggleNode(this.name, 'paragraph', { type })
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name)
        },
    }
  },
})
