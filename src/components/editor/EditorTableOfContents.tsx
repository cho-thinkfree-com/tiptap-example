import { Box, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import type { Editor } from '@tiptap/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { slugify, useRichTextEditorContext } from 'mui-tiptap'
import { useI18n } from '../../lib/i18n'

type TocItem = {
  id: string
  level: number
  text: string
  pos: number
}

type TocState = {
  items: TocItem[]
  activeId: string | null
}

type EditorTableOfContentsProps = {
  onNavigate?: () => void
}

const createUniqueId = (baseId: string, index: number, existing: Set<string>) => {
  let candidate = baseId || `heading-${index + 1}`
  let suffix = 2
  while (existing.has(candidate)) {
    candidate = `${baseId || `heading-${index + 1}`}-${suffix}`
    suffix += 1
  }
  existing.add(candidate)
  return candidate
}

const buildTableOfContents = (editor: Editor): TocState => {
  const items: TocItem[] = []
  const existingIds = new Set<string>()
  let activeId: string | null = null
  const { from } = editor.state.selection

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') {
      return true
    }

    const textContent = node.textContent.trim()
    const baseId = slugify(textContent)
    const id = createUniqueId(baseId, items.length, existingIds)
    const level = node.attrs.level ?? 1

    items.push({
      id,
      level,
      text: textContent || `Heading ${items.length + 1}`,
      pos,
    })

    if (from >= pos && from <= pos + node.nodeSize) {
      activeId = id
    }

    return true
  })

  return { items, activeId }
}

const EditorTableOfContents = ({ onNavigate }: EditorTableOfContentsProps) => {
  const editor = useRichTextEditorContext()
  const { strings } = useI18n()
  const [toc, setToc] = useState<TocState>({ items: [], activeId: null })

  useEffect(() => {
    if (!editor) {
      return
    }

    const updateToc = () => setToc(buildTableOfContents(editor))

    updateToc()
    editor.on('transaction', updateToc)
    editor.on('selectionUpdate', updateToc)
    editor.on('update', updateToc)

    return () => {
      editor.off('transaction', updateToc)
      editor.off('selectionUpdate', updateToc)
      editor.off('update', updateToc)
    }
  }, [editor])

  const handleNavigate = useCallback(
    (item: TocItem) => {
      if (!editor) {
        return
      }

      editor
        .chain()
        .focus()
        .setTextSelection({ from: item.pos + 1, to: item.pos + 1 })
        .scrollIntoView()
        .run()
      if (onNavigate) {
        onNavigate()
      }
    },
    [editor, onNavigate],
  )

  const placeholder = strings.editor.toc.emptyPlaceholder

  const content = useMemo(() => {
    if (toc.items.length === 0) {
      return (
        <Typography variant='body2' color='text.secondary' sx={{ py: 1 }}>
          {placeholder}
        </Typography>
      )
    }

    return (
      <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {toc.items.map((item) => (
          <ListItemButton
            key={item.id}
            selected={toc.activeId === item.id}
            onClick={() => handleNavigate(item)}
            sx={{
              pl: 1 + Math.max(0, item.level - 1) * 1.25,
              pr: 1,
              borderRadius: 1,
              minHeight: 28,
              py: 0,
            }}
          >
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{
                variant: 'body2',
                noWrap: true,
                sx: {
                  pl: 1,
                },
              }}
            />
          </ListItemButton>
        ))}
      </List>
    )
  }, [handleNavigate, toc.items, toc.activeId])

  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>{content}</Box>
}

export default EditorTableOfContents
