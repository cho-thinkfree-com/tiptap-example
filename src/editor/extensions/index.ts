import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import yaml from 'highlight.js/lib/languages/yaml'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import type { Extension } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import Dropcursor from '@tiptap/extension-dropcursor'
import FontFamily from '@tiptap/extension-font-family'
import Gapcursor from '@tiptap/extension-gapcursor'
import Heading from '@tiptap/extension-heading'
import Highlight from '@tiptap/extension-highlight'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import Code from '@tiptap/extension-code'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { FontSize, TableImproved } from 'mui-tiptap'
import Image from '@tiptap/extension-image'
import type { AppStrings } from '../../lib/i18n'
import { CalloutExtension } from './callout'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CalloutNodeView from './CalloutNodeView.tsx'
import ResizableImageView from './ResizableImageView'
import { SlashCommand } from './slashCommand'
import { DocumentLayout } from './DocumentLayout'
import { BlockLimit } from './BlockLimit'
import Youtube from '@tiptap/extension-youtube'
import ResizableYouTubeView from './ResizableYouTubeView'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import {
  addRowBeforeWithAttrs,
  addRowAfterWithAttrs,
  addColumnBeforeWithAttrs,
  addColumnAfterWithAttrs
} from './tableCommands'

const lowlight = createLowlight()
lowlight.register('javascript', javascript)
lowlight.register('typescript', typescript)
lowlight.register('css', css)
lowlight.register('json', json)
lowlight.register('xml', xml)
lowlight.register('markdown', markdown)
lowlight.register('python', python)
lowlight.register('java', java)
lowlight.register('c', c)
lowlight.register('cpp', cpp)
lowlight.register('csharp', csharp)
lowlight.register('go', go)
lowlight.register('rust', rust)
lowlight.register('sql', sql)
lowlight.register('bash', bash)
lowlight.register('yaml', yaml)
lowlight.register('dockerfile', dockerfile)
lowlight.registerAlias({
  javascript: ['js'],
  typescript: ['ts'],
  xml: ['html'],
  bash: ['shell'],
})

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export type BaseExtensionOptions = {
  onBlockLimitReached?: () => void
}

export const createBaseExtensions = (strings: AppStrings, options?: BaseExtensionOptions): Extension[] => {
  const ExclusiveSubscript = Subscript.extend({
    addCommands() {
      const parent = this.parent?.()
      return {
        ...parent,
        setSubscript:
          () =>
            ({ commands }) => {
              commands.unsetSuperscript?.()
              return commands.setMark(this.name)
            },
        toggleSubscript:
          () =>
            ({ commands }) => {
              commands.unsetSuperscript?.()
              return commands.toggleMark(this.name)
            },
      }
    },
  })

  const ExclusiveSuperscript = Superscript.extend({
    addCommands() {
      const parent = this.parent?.()
      return {
        ...parent,
        setSuperscript:
          () =>
            ({ commands }) => {
              commands.unsetSubscript?.()
              return commands.setMark(this.name)
            },
        toggleSuperscript:
          () =>
            ({ commands }) => {
              commands.unsetSubscript?.()
              return commands.toggleMark(this.name)
            },
      }
    },
  })

  return [
    StarterKit.configure({
      heading: false,
      dropcursor: false,
      gapcursor: false,
      horizontalRule: false,
      link: false,
      codeBlock: false,
      code: false,
    }),
    // Custom Code mark with backtick shortcut for wrapping selection
    Code.extend({
      addKeyboardShortcuts() {
        return {
          ...this.parent?.(),
          '`': () => {
            const { empty } = this.editor.state.selection
            if (!empty) {
              // If there's a selection, toggle code mark
              return this.editor.commands.toggleCode()
            }
            return false
          },
        }
      },
    }),
    Heading.configure({
      levels: [...HEADING_LEVELS],
    }),
    TextStyle,
    Color.configure({
      types: ['textStyle'],
    }),
    FontFamily.configure({
      types: ['textStyle'],
    }),
    FontSize.configure({
      types: ['textStyle'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Placeholder.configure({
      placeholder: strings.editor.content.placeholder,
      showOnlyWhenEditable: true,
      includeChildren: true,
    }),
    Link.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
    }),
    ExclusiveSubscript,
    ExclusiveSuperscript,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    HorizontalRule,
    CodeBlockLowlight.configure({
      lowlight,
    }).extend({
      addKeyboardShortcuts() {
        return {
          ...this.parent?.(),
          Tab: () => {
            if (this.editor.isActive('codeBlock')) {
              const { state } = this.editor.view
              const { from } = state.selection
              const $from = state.doc.resolve(from)

              // Get the entire code block content
              const blockStart = $from.start()
              const blockText = state.doc.textBetween(blockStart, from)

              // Find the start of the current line (after the last newline)
              const lastNewline = blockText.lastIndexOf('\n')
              const columnPosition = lastNewline === -1 ? (from - blockStart) : (from - blockStart - lastNewline - 1)

              // Calculate spaces needed to reach next tab stop (multiple of 4)
              const spacesToInsert = 4 - (columnPosition % 4)

              return this.editor.commands.insertContent(' '.repeat(spacesToInsert))
            }
            return false
          },
          'Shift-Tab': () => {
            console.log('[Shift-Tab] Handler called')
            console.log('[Shift-Tab] isActive codeBlock:', this.editor.isActive('codeBlock'))

            if (this.editor.isActive('codeBlock')) {
              const { state, dispatch } = this.editor.view
              const { from } = state.selection
              const $from = state.doc.resolve(from)

              // Get the entire code block content
              const blockStart = $from.start()
              const blockText = state.doc.textBetween(blockStart, from)

              // Find the start of the current line (after the last newline)
              const lastNewline = blockText.lastIndexOf('\n')
              const lineStart = lastNewline === -1 ? blockStart : blockStart + lastNewline + 1

              // Get the text from line start to cursor
              const lineTextBeforeCursor = state.doc.textBetween(lineStart, from)

              console.log('[Shift-Tab] from:', from)
              console.log('[Shift-Tab] blockStart:', blockStart)
              console.log('[Shift-Tab] lineStart:', lineStart)
              console.log('[Shift-Tab] lineTextBeforeCursor:', JSON.stringify(lineTextBeforeCursor))

              // Check how many leading spaces (up to 4)
              const leadingSpaces = lineTextBeforeCursor.match(/^ {1,4}/)?.[0]?.length || 0
              console.log('[Shift-Tab] leadingSpaces:', leadingSpaces)

              if (leadingSpaces > 0) {
                console.log('[Shift-Tab] Deleting', leadingSpaces, 'spaces from position', lineStart)
                const tr = state.tr.delete(lineStart, lineStart + leadingSpaces)
                dispatch(tr)
              }
              // Always return true to prevent focus from leaving the code block
              console.log('[Shift-Tab] Returning true')
              return true
            }
            console.log('[Shift-Tab] Not in codeBlock, returning false')
            return false
          },
        }
      },
    }),
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          'data-odocs-url': {
            default: null,
          },
          naturalWidth: {
            default: null,
            parseHTML: element => parseInt(element.getAttribute('data-natural-width') || '') || null,
            renderHTML: attributes => {
              if (!attributes.naturalWidth) return {}
              return { 'data-natural-width': attributes.naturalWidth }
            },
          },
          naturalHeight: {
            default: null,
            parseHTML: element => parseInt(element.getAttribute('data-natural-height') || '') || null,
            renderHTML: attributes => {
              if (!attributes.naturalHeight) return {}
              return { 'data-natural-height': attributes.naturalHeight }
            },
          },
          width: {
            default: null,
            parseHTML: element => element.getAttribute('width') || element.style.width || null,
            renderHTML: attributes => {
              if (!attributes.width) return {}
              return {
                width: attributes.width,
                style: `width: ${attributes.width}`,
              }
            },
          },
          textAlign: {
            default: 'center',
            parseHTML: element => element.getAttribute('data-text-align') || 'center',
            renderHTML: attributes => {
              if (!attributes.textAlign) return {}
              return { 'data-text-align': attributes.textAlign }
            },
          },
          border: {
            default: 'none',
            parseHTML: element => element.getAttribute('data-border') || 'none',
            renderHTML: attributes => {
              if (!attributes.border || attributes.border === 'none') return {}
              return { 'data-border': attributes.border }
            },
          },
          borderRadius: {
            default: 'none',
            parseHTML: element => element.getAttribute('data-border-radius') || 'none',
            renderHTML: attributes => {
              if (!attributes.borderRadius || attributes.borderRadius === 'none') return {}
              return { 'data-border-radius': attributes.borderRadius }
            },
          },
        }
      },
      addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView)
      },
    }),
    TableImproved.configure({
      resizable: true,
    }).extend({
      addCommands() {
        return {
          ...this.parent?.(),
          addRowBeforeWithAttrs: () => ({ state, dispatch }: { state: any, dispatch: any }) =>
            addRowBeforeWithAttrs(state, dispatch),
          addRowAfterWithAttrs: () => ({ state, dispatch }: { state: any, dispatch: any }) =>
            addRowAfterWithAttrs(state, dispatch),
          addColumnBeforeWithAttrs: () => ({ state, dispatch }: { state: any, dispatch: any }) =>
            addColumnBeforeWithAttrs(state, dispatch),
          addColumnAfterWithAttrs: () => ({ state, dispatch }: { state: any, dispatch: any }) =>
            addColumnAfterWithAttrs(state, dispatch),
        }
      }
    }),
    TableRow,
    TableHeader,
    TableCell.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          backgroundColor: {
            default: null,
            parseHTML: element => element.style.backgroundColor || null,
            renderHTML: attributes => {
              if (!attributes.backgroundColor) {
                return {}
              }
              return {
                style: `background-color: ${attributes.backgroundColor}`
              }
            },
          },
        }
      },
    }),
    Dropcursor.configure({
      color: '#1976d2',
    }),
    Gapcursor,

    // YouTube extension with custom NodeView and paste handler
    Youtube.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          width: {
            default: 640,
          },
          textAlign: {
            default: 'center',
            parseHTML: element => element.getAttribute('data-text-align') || 'center',
            renderHTML: attributes => {
              if (!attributes.textAlign) return {}
              return { 'data-text-align': attributes.textAlign }
            },
          },
          controls: {
            default: true,
          },
          nocookie: {
            default: false,
          },
        }
      },
      addNodeView() {
        return ReactNodeViewRenderer(ResizableYouTubeView)
      },
      addProseMirrorPlugins() {
        const parentPlugins = this.parent?.() || []

        // YouTube URL paste handler plugin
        const youtubeUrlRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^\s]*)?/

        const pastePlugin = new Plugin({
          key: new PluginKey('youtube-paste-handler'),
          props: {
            handlePaste: (view, event) => {
              const clipboardData = event.clipboardData
              if (!clipboardData) return false

              const text = clipboardData.getData('text/plain')
              if (!text) return false

              const match = text.match(youtubeUrlRegex)
              if (!match) return false

              const videoId = match[1]
              if (!videoId) return false

              // Prevent default paste
              event.preventDefault()

              // Insert YouTube node
              const { state, dispatch } = view
              const { tr, schema } = state
              const youtubeType = schema.nodes.youtube

              if (!youtubeType) return false

              const youtubeNode = youtubeType.create({
                src: `https://www.youtube.com/embed/${videoId}`,
                width: 640,
              })

              dispatch(tr.replaceSelectionWith(youtubeNode))
              return true
            },
          },
        })

        return [...parentPlugins, pastePlugin]
      },
    }).configure({
      controls: true,
      nocookie: false,
    }),

    CalloutExtension,
    SlashCommand.configure({
      suggestion: {
        char: '/',
      }
    }),
    DocumentLayout,
    BlockLimit.configure({
      maxBlocks: 1000,
      onLimitReached: options?.onBlockLimitReached,
    }),
  ] as Extension[]
}
