import { Extension } from '@tiptap/core'

export interface DocumentLayoutOptions {
    defaultWidth: string
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        documentLayout: {
            /**
             * Set the layout width of the document
             */
            setLayoutWidth: (width: string) => ReturnType
        }
    }
}

export const DocumentLayout = Extension.create<DocumentLayoutOptions>({
    name: 'documentLayout',

    addOptions() {
        return {
            defaultWidth: '950px',
        }
    },

    addGlobalAttributes() {
        return [
            {
                types: ['doc'],
                attributes: {
                    'x-odocs-layoutWidth': {
                        default: null,
                        parseHTML: element => element.getAttribute('x-odocs-layoutWidth'),
                        renderHTML: attributes => {
                            if (!attributes['x-odocs-layoutWidth']) {
                                return {}
                            }
                            return {
                                'x-odocs-layoutWidth': attributes['x-odocs-layoutWidth'],
                                style: `max-width: ${attributes['x-odocs-layoutWidth'] === '100%' ? 'none' : attributes['x-odocs-layoutWidth']}; margin: 0 auto;`,
                            }
                        },
                    },
                },
            },
        ]
    },

    addCommands() {
        return {
            setLayoutWidth:
                (width: string) =>
                    () => {
                        // Deprecated: Use setContent to update doc attributes safely
                        return true
                    },
        }
    },
})
