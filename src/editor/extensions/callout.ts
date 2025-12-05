import { Node, mergeAttributes, findParentNode } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CalloutNodeView from './CalloutNodeView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: 'info' | 'warning' | 'error' | 'success' | 'memo') => ReturnType,
      toggleCallout: (type: 'info' | 'warning' | 'error' | 'success' | 'memo') => ReturnType,
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

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
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
                    // {
                    //   type: 'text',
                    //   text: '',
                    // },
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
