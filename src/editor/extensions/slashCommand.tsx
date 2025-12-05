import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light.css'
import SlashCommandList from '../../components/editor/SlashCommandList'
import type { CommandItem } from '../../components/editor/SlashCommandList'
import { createHeadingSlashCommands } from '../slashCommands'
import { getStringsForLocale } from '../../lib/i18n'
import {
    TextFields,
    LooksOne,
    LooksTwo,
    Looks3,
    Looks4,
    Looks5,
    Looks6,
    FormatListBulleted,
    FormatListNumbered,
    Checklist,
    FormatQuote,
    Code,
    HorizontalRule,
    Info,
    TableChart,
} from '@mui/icons-material'

export const SlashCommand = Extension.create({
    name: 'slashCommand',

    addOptions() {
        return {
            suggestion: {
                char: '/',
                command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
                    props.command({ editor, range })
                },
                allow: ({ state, range }: { state: any; range: any }) => {
                    const $from = state.doc.resolve(range.from)

                    // Allow in paragraph, or if it's a textblock and we are at the start (optional, but good for slash commands)
                    // For now, let's just check if it's a textblock to be safe, or specifically paragraph.
                    // The previous check failed because it checked if paragraph can be inside paragraph.

                    return $from.parent.isTextblock
                },
            },
        }
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
                items: ({ query }) => getSuggestionItems(query),
                render: renderSuggestion,
            }),
        ]
    },
})

export const getSuggestionItems = (query: string): CommandItem[] => {
    if (query.startsWith('?')) {
        return []
    }

    const strings = getStringsForLocale()
    const headingCommands = createHeadingSlashCommands(strings)

    const headingIcons = {
        1: <LooksOne />,
        2: <LooksTwo />,
        3: <Looks3 />,
        4: <Looks4 />,
        5: <Looks5 />,
        6: <Looks6 />,
    }

    const dynamicHeadings: CommandItem[] = headingCommands.map(cmd => ({
        title: cmd.title,
        description: cmd.description,
        aliases: cmd.aliases,
        icon: headingIcons[cmd.level as keyof typeof headingIcons],
        command: ({ editor, range }) => {
            editor.chain().focus().deleteRange(range).setNode('heading', { level: cmd.level }).run()
        }
    }))

    const otherCommands: CommandItem[] = [
        {
            title: 'Text',
            description: 'Just start typing with plain text.',
            aliases: ['p', 'paragraph'],
            icon: <TextFields />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setParagraph().run()
            },
        },
        ...dynamicHeadings,
        {
            title: 'Bullet List',
            description: 'Create a simple bulleted list.',
            aliases: ['ul', 'list', 'bullet'],
            icon: <FormatListBulleted />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBulletList().run()
            },
        },
        {
            title: 'Ordered List',
            description: 'Create a list with numbering.',
            aliases: ['ol', 'number', 'ordered'],
            icon: <FormatListNumbered />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleOrderedList().run()
            },
        },
        {
            title: 'Task List',
            description: 'Track tasks with a todo list.',
            aliases: ['todo', 'task', 'check'],
            icon: <Checklist />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleTaskList().run()
            },
        },
        {
            title: 'Blockquote',
            description: 'Capture a quote.',
            aliases: ['quote', 'bq'],
            icon: <FormatQuote />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleBlockquote().run()
            },
        },
        {
            title: 'Code Block',
            description: 'Capture a code snippet.',
            aliases: ['code', 'cb'],
            icon: <Code />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
            },
        },
        {
            title: 'Horizontal Rule',
            description: 'Insert a horizontal divider.',
            aliases: ['hr', 'line', 'divider'],
            icon: <HorizontalRule />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setHorizontalRule().run()
            },
        },
        {
            title: 'Callout',
            description: 'Make writing stand out.',
            aliases: ['callout', 'info', 'note', 'c'],
            icon: <Info />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).setCallout('info').run()
            },
        },
        {
            title: 'Table',
            description: 'Insert a 4x4 table.',
            aliases: ['table', 'grid'],
            icon: <TableChart />,
            command: ({ editor, range }) => {
                editor.chain().focus().deleteRange(range).insertTable({ rows: 5, cols: 4, withHeaderRow: true }).toggleHeaderColumn().run()
            },
        },
    ]

    return otherCommands.filter((item) => {
        const lowerQuery = query.toLowerCase()
        return (
            item.title.toLowerCase().includes(lowerQuery) ||
            (item.aliases && item.aliases.some(alias => alias.toLowerCase().includes(lowerQuery)))
        )
    })
}

export const renderSuggestion = () => {
    let component: ReactRenderer | null = null
    let popup: any | null = null
    let isDestroying = false

    return {
        onStart: (props: any) => {
            // Clean up any existing instances first
            if (popup?.[0]) {
                popup[0].destroy()
                popup = null
            }
            if (component) {
                component.destroy()
                component = null
            }

            isDestroying = false

            component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
            })

            if (!props.clientRect) {
                return
            }

            popup = tippy(document.body, {
                getReferenceClientRect: props.clientRect,
                appendTo: () => props.editor.view.dom.parentNode,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'right-start',
                theme: 'transparent',
                arrow: false,
                popperOptions: {
                    modifiers: [
                        {
                            name: 'flip',
                            enabled: true,
                        },
                        {
                            name: 'preventOverflow',
                            options: {
                                boundary: 'viewport',
                            },
                        },
                    ],
                },
                onHide: () => {
                    // Prevent hiding unless we're actually destroying
                    if (!isDestroying) return false
                },
            })
        },

        onUpdate: (props: any) => {
            if (isDestroying) return

            component?.updateProps(props)

            if (!props.clientRect) {
                return
            }

            popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect,
            })
        },

        onKeyDown: (props: any) => {
            if (isDestroying) return false

            if (props.event.key === 'Escape') {
                isDestroying = true
                popup?.[0]?.hide()
                return true
            }

            return (component?.ref as any)?.onKeyDown(props)
        },

        onExit: () => {
            isDestroying = true

            if (popup?.[0]) {
                popup[0].destroy()
                popup = null
            }
            if (component) {
                component.destroy()
                component = null
            }
        },
    }
}
