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
import { nodeInputRule } from '@tiptap/core'
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
import { filesToImageAttributes } from '../../lib/imageUpload'
import { DOMSerializer } from '@tiptap/pm/model'

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
  uploadContext?: {
    workspaceId: string
    documentId: string
  }
  history?: boolean
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
      history: options?.history ?? true,
      undoRedo: options?.history ?? true,
    } as any),
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
      types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    HorizontalRule.extend({
      addInputRules() {
        return [
          nodeInputRule({
            find: /^(?:---|—-|___|\*\*\*|\/-+|\/_+|\/\*+)$/,
            type: this.type,
          }),
        ]
      },
    }),
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
      addProseMirrorPlugins() {
        const uploadContext = options?.uploadContext

        return [
          new Plugin({
            key: new PluginKey('image-handler'),
            props: {
              handleDOMEvents: {
                copy: (view, event) => {
                  const selection = view.state.selection
                  if (selection.empty) return false

                  // Check if there are any images in the selection
                  let hasImages = false
                  view.state.doc.nodesBetween(selection.from, selection.to, (node) => {
                    if (node.type.name === 'image') {
                      hasImages = true
                      return false // Stop descending
                    }
                    return true
                  })

                  if (!hasImages) return false

                  event.preventDefault()

                  // Map to store base64 data for each image source
                  const imageBase64Map = new Map<string, string>()
                  const promises: Promise<void>[] = []

                  // Iterate through selected nodes to find images and convert them
                  view.state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
                    if (node.type.name === 'image') {
                      const src = node.attrs.src
                      promises.push(new Promise<void>((resolve) => {
                        // Find the rendered DOM node for this image
                        const domNode = view.nodeDOM(pos) as HTMLElement
                        if (!domNode) {
                          resolve()
                          return
                        }

                        // The DOM node is likely the NodeViewWrapper, so find the img inside
                        const imgElement = domNode.querySelector('img')

                        if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                          try {
                            const canvas = document.createElement('canvas')
                            canvas.width = imgElement.naturalWidth
                            canvas.height = imgElement.naturalHeight
                            const ctx = canvas.getContext('2d')
                            if (ctx) {
                              // Draw the images using the rendered element (which has the resolved URL)
                              ctx.drawImage(imgElement, 0, 0)

                              // Check for transparency
                              let isTransparent = false
                              try {
                                // Optimization: Check corners and center first, or small sample?
                                // Robust way: check all pixels (can be slow for huge images but safe for copy)
                                // Let's check a small version 50x50 to speed up? No, transparency might be small.
                                // For copy operation, we can afford some ms.
                                // However, we can just check the image data.
                                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                                const data = imageData.data
                                for (let i = 3; i < data.length; i += 4) {
                                  if (data[i] < 255) {
                                    isTransparent = true
                                    break
                                  }
                                }
                              } catch (e) {
                                console.warn('Could not check transparency, defaulting to PNG', e)
                                isTransparent = true // Default to PNG if we can't read pixels (e.g. some CORS edge case)
                              }

                              const base64 = canvas.toDataURL(isTransparent ? 'image/png' : 'image/jpeg')
                              imageBase64Map.set(src, base64)
                            }
                          } catch (e) {
                            console.error('Failed to convert image to base64', e)
                          }
                        }
                        resolve()
                      }))
                      return false
                    }
                    return true
                  })

                  Promise.all(promises).then(() => {
                    // Serialize the selection to HTML
                    const slice = selection.content()
                    const serializer = view.someProp('clipboardSerializer') || DOMSerializer.fromSchema(view.state.schema)

                    // @ts-ignore
                    const fragment = serializer.serializeFragment(slice.content)
                    const div = document.createElement('div')
                    div.appendChild(fragment)

                    // Replace src with base64 in the serialized DOM
                    const images = div.querySelectorAll('img')
                    images.forEach(img => {
                      const originalSrc = img.getAttribute('src') // getAttribute to avoid browser resolving/erroring
                      if (originalSrc && imageBase64Map.has(originalSrc)) {
                        const base64 = imageBase64Map.get(originalSrc)
                        if (base64) {
                          img.src = base64
                          img.removeAttribute('data-odocs-url')
                        }
                      }
                    })

                    if (event.clipboardData) {
                      event.clipboardData.setData('text/html', div.innerHTML)
                      // Also set text representation
                      event.clipboardData.setData('text/plain', div.textContent || '')
                    }
                  })

                  return true
                }
              },
              handlePaste: (view, event) => {
                const files = Array.from(event.clipboardData?.files || [])
                const imageFiles = files.filter(file => file.type.startsWith('image/'))

                // Case 1: Direct file paste (already handled)
                if (imageFiles.length > 0) {
                  if (!uploadContext) {
                    console.warn('Image paste detected but no upload context provided')
                    return false
                  }
                  event.preventDefault()
                  filesToImageAttributes(imageFiles, uploadContext).then(attributesList => {
                    const { state, dispatch } = view
                    if (attributesList.length === 0) return

                    const nodes = attributesList.map(attrs =>
                      state.schema.nodes.image.create(attrs)
                    )

                    const tr = state.tr
                    const { selection } = state
                    tr.replaceSelectionWith(nodes[0])
                    for (let i = 1; i < nodes.length; i++) {
                      tr.insert(tr.mapping.map(selection.to) + i, nodes[i])
                    }
                    dispatch(tr)
                  })
                  return true
                }

                // Case 2: HTML paste containing Base64 images
                const html = event.clipboardData?.getData('text/html')
                if (html && html.includes('data:image/')) {
                  if (!uploadContext) return false // Let default handler take over if we can't upload, or maybe block?

                  // We want to process this.
                  // 1. Let default parser parse HTML to Slice
                  // 2. Walk Slice, find images with data: src
                  // 3. Convert data: to File
                  // 4. Upload
                  // 5. Replace in Slice
                  // 6. Insert Slice

                  // Actually, implementing custom HTML parse and replace is complex. 
                  // An easier way: intercept transformPasted? Or just handle here.

                  // Let's parse manually.
                  const parser = new DOMParser()
                  const doc = parser.parseFromString(html, 'text/html')
                  const images = Array.from(doc.querySelectorAll('img'))
                  const base64Images = images.filter(img => img.src.startsWith('data:image/'))

                  if (base64Images.length === 0) return false

                  event.preventDefault()

                  const replaceMap = new Map<string, string>()

                  const uploadPromises = base64Images.map(async (img) => {
                    try {
                      const response = await fetch(img.src)
                      const blob = await response.blob()
                      const extension = blob.type.split('/')[1] || 'png'
                      const filename = `pasted-image-${Date.now()}.${extension}`
                      const file = new File([blob], filename, { type: blob.type })

                      const [attrs] = await filesToImageAttributes([file], uploadContext)
                      const imageAttrs = attrs as any // Cast to any to access custom attributes safely
                      if (imageAttrs && imageAttrs['data-odocs-url']) {
                        replaceMap.set(img.src, imageAttrs['data-odocs-url'])
                        img.src = imageAttrs['data-odocs-url']
                        img.setAttribute('data-odocs-url', imageAttrs['data-odocs-url'])
                      }
                    } catch (e) {
                      console.error('Failed to upload pasted base64 image', e)
                    }
                  })

                  Promise.all(uploadPromises).then(() => {
                    // Now insert the modified HTML
                    const modifiedHtml = doc.body.innerHTML
                    view.pasteHTML(modifiedHtml)
                  })

                  return true
                }

                return false
              }
            }
          })
        ]
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
