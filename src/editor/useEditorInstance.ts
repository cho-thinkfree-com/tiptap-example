import type { EditorOptions } from '@tiptap/react'
import { useEditor } from '@tiptap/react'
import { useEffect, useMemo, useRef } from 'react'
import { createBaseExtensions } from './extensions'
import type { BaseExtensionOptions } from './extensions'
import { getStringsForLocale, type AppStrings } from '../lib/i18n'

const defaultContent = '<p></p>'

const baseEditorProps: NonNullable<EditorOptions['editorProps']> = {
  attributes: {
    'data-testid': 'rich-text-editor',
    'aria-label': 'Document content',
  },
}

type UseEditorInstanceOptions = Partial<EditorOptions> & {
  localeStrings?: AppStrings
  extensionOptions?: BaseExtensionOptions
  onError?: (error: Error) => void
  waitForContent?: boolean
  shouldSetInitialContent?: boolean
}

const useEditorInstance = (options?: UseEditorInstanceOptions) => {
  const {
    localeStrings,
    extensionOptions,
    extensions: optionExtensions,
    editorProps: optionEditorProps,
    content,
    onError,
    waitForContent,
    ...editorConfig
  } = options ?? {}

  const strings = localeStrings ?? getStringsForLocale()

  const extensions = useMemo(() => {
    const base = createBaseExtensions(strings, extensionOptions)
    if (!optionExtensions) {
      return base
    }

    return [...base, ...optionExtensions]
  }, [strings, extensionOptions, optionExtensions])

  const editorProps = useMemo(() => {
    const optionProps = optionEditorProps ?? {}
    return {
      ...baseEditorProps,
      ...optionProps,
      attributes: {
        ...baseEditorProps.attributes,
        ...optionProps.attributes,
      },
    }
  }, [optionEditorProps])

  const hasInitialized = useRef(false)

  const editor = useEditor({
    autofocus: editorConfig.autofocus ?? 'start',
    ...editorConfig,
    content: undefined, // Defer content loading to validate first
    extensions,
    editorProps,
  })

  useEffect(() => {
    if (!editor || hasInitialized.current) {
      return
    }

    // If waitForContent is true and content is null, wait for it to be populated
    if (waitForContent && content === null) {
      return
    }

    // New option to skip initial content setting (for collaboration/Yjs)
    const shouldSetContent = options?.shouldSetInitialContent ?? true;

    if (!shouldSetContent) {
      hasInitialized.current = true;
      return;
    }

    const initialContent = content ?? defaultContent

    // Defer content setting to avoid flushSync warning during React render phase
    queueMicrotask(() => {
      if (!editor || hasInitialized.current) {
        return
      }

      try {
        // Validate JSON content against the schema before setting it
        // This prevents the editor from entering an invalid state or logging warnings
        if (typeof initialContent === 'object' && initialContent !== null) {
          editor.schema.nodeFromJSON(initialContent)
        }

        editor.commands.setContent(initialContent, { emitUpdate: false })

        // Explicitly restore doc attributes if they were lost during setContent
        // This fixes an issue where global attributes on the doc node might be stripped
        if (
          typeof initialContent === 'object' &&
          initialContent !== null &&
          'attrs' in initialContent &&
          (initialContent as any).attrs
        ) {
          const attrs = (initialContent as any).attrs;
          if (attrs['x-odocs-layoutWidth']) {
            editor.commands.updateAttributes('doc', {
              'x-odocs-layoutWidth': attrs['x-odocs-layoutWidth']
            });
          }
        }
      } catch (error) {
        console.warn('Editor content validation failed:', error)
        if (onError) {
          onError(error as Error)
        }
      }

      hasInitialized.current = true
    })
  }, [editor, content, onError, waitForContent, options?.shouldSetInitialContent])

  return editor
}

export default useEditorInstance
