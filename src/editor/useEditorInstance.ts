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
}

const useEditorInstance = (options?: UseEditorInstanceOptions) => {
  const {
    localeStrings,
    extensionOptions,
    extensions: optionExtensions,
    editorProps: optionEditorProps,
    content,
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
    autofocus: editorConfig.autofocus ?? 'end',
    ...editorConfig,
    content,
    extensions,
    editorProps,
  })

  useEffect(() => {
    if (!editor || hasInitialized.current) {
      return
    }

    const initialContent = content ?? defaultContent
    editor.commands.setContent(initialContent, { emitUpdate: false })
    hasInitialized.current = true
  }, [editor, content])

  return editor
}

export default useEditorInstance

