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
import { FontSize, LinkBubbleMenuHandler, ResizableImage, TableImproved } from 'mui-tiptap'
import type { AppStrings } from '../../lib/i18n'
import { SlashHeadingExtension } from './slashHeading'
import { SlashHelpExtension, type SlashHelpOptions } from './slashHelp'

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
  slashHelp?: SlashHelpOptions
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
    ResizableImage,
    TableImproved.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    Dropcursor.configure({
      color: '#1976d2',
    }),
    Gapcursor,
    LinkBubbleMenuHandler,
    SlashHeadingExtension,
    SlashHelpExtension.configure(options?.slashHelp ?? {}),
  ] as Extension[]
}
