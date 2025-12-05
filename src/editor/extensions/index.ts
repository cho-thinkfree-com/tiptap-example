import { createLowlight } from 'lowlight'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
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
lowlight.registerAlias({
  javascript: ['js'],
  typescript: ['ts'],
  xml: ['html'],
})

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

export type BaseExtensionOptions = {
}

export const createBaseExtensions = (strings: AppStrings, _options?: BaseExtensionOptions): Extension[] => {
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
    }),
    Image.extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          'data-odocs-url': {
            default: null,
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

    CalloutExtension,
    SlashCommand.configure({
      suggestion: {
        char: '/',
      }
    }),
    DocumentLayout,
  ] as Extension[]
}
