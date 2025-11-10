import { Paper, Popper } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { TableMenuControls, useRichTextEditorContext } from 'mui-tiptap'

const TableFloatingToolbar = () => {
  const editor = useRichTextEditorContext()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) {
      return
    }

    const updateToolbar = () => {
      if (!editor) {
        return
      }

      const { state, view } = editor
      const { from } = state.selection
      const resolved = view.domAtPos(from)
      let node: Node | null = resolved.node

      if (node.nodeType !== Node.ELEMENT_NODE) {
        node = node.parentNode
      }

      const cellElement = (node as HTMLElement | null)?.closest('td, th, table')
      const tableElement = cellElement?.closest('table') ?? null

      if (tableElement && editor.isActive('table')) {
        setAnchorEl((prev) => (prev === tableElement ? prev : tableElement))
      } else {
        setAnchorEl((prev) => (prev !== null ? null : prev))
      }
    }

    const scheduleUpdate = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(updateToolbar)
    }

    editor.on('selectionUpdate', scheduleUpdate)
    editor.on('transaction', scheduleUpdate)
    updateToolbar()

    return () => {
      editor.off('selectionUpdate', scheduleUpdate)
      editor.off('transaction', scheduleUpdate)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [editor])

  const open = Boolean(anchorEl) && Boolean(editor?.isEditable)

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement='top'
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
    >
      <Paper elevation={2} sx={{ p: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <TableMenuControls />
      </Paper>
    </Popper>
  )
}

export default TableFloatingToolbar
