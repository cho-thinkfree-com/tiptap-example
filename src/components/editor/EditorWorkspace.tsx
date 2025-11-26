import { Box } from '@mui/material'
import { LinkBubbleMenu, RichTextField, TableBubbleMenu, useRichTextEditorContext } from 'mui-tiptap'
import BlockDragHandle from './BlockDragHandle'
import TableFloatingToolbar from './TableFloatingToolbar'
import { useEffect, useState } from 'react'

interface EditorWorkspaceProps {
  readOnly?: boolean
  initialWidth?: string
  overrideWidth?: string
}

const EditorWorkspace = ({ readOnly, initialWidth = '950px', overrideWidth }: EditorWorkspaceProps) => {
  const editor = useRichTextEditorContext()
  const [layoutWidth, setLayoutWidth] = useState(initialWidth)

  useEffect(() => {
    if (overrideWidth) {
      setLayoutWidth(overrideWidth)
      return
    }

    if (!editor) return

    const updateWidth = () => {
      const attrs = editor.state.doc.attrs;
      const width = attrs['x-odocs-layoutWidth'];
      // Fallback to initialWidth if attribute is missing (e.g. during initialization)
      setLayoutWidth(width || initialWidth)
    }

    updateWidth()
    editor.on('transaction', updateWidth)
    editor.on('update', updateWidth)

    return () => {
      editor.off('transaction', updateWidth)
      editor.off('update', updateWidth)
    }
  }, [editor, initialWidth, overrideWidth])

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#fafafa', // Very subtle gray
      }}
    >
      <RichTextField
        variant='standard'
        RichTextContentProps={{
          sx: {
            flex: 1,
            minHeight: 0,
            height: '100%',
            overflowY: 'auto',
            typography: 'body1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            // Add spacing via pseudo-element to guarantee scroll space
            '&::after': {
              content: '""',
              display: 'block',
              minHeight: '30vh',
              width: '100%',
              maxWidth: layoutWidth === '100%' ? 'none' : layoutWidth, // Match paper width
              backgroundColor: 'white', // Match paper color
              flexShrink: 0,
              border: '1px solid rgba(0, 0, 0, 0.05)', // Subtle border
              borderTop: 'none', // Merge with content
              boxSizing: 'border-box',
            },
            '& .ProseMirror': {
              width: '100%',
              maxWidth: layoutWidth === '100%' ? 'none' : layoutWidth,
              minHeight: '100%',
              padding: '48px',
              boxSizing: 'border-box',
              margin: '32px auto 0',
              transition: 'max-width 0.3s ease-in-out',
              // Ensure white background for the content area
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.05)', // Subtle border
              borderBottom: 'none', // Merge with spacer
            },
            // Custom scrollbar styling for "floating" look
            '&::-webkit-scrollbar': {
              width: '8px',
              backgroundColor: 'transparent', // Transparent track
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)', // Subtle thumb
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            },
          },
        }}
        sx={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          px: 0,
          '& .MuiTiptap-RichTextField-content': {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            overflowY: 'auto',
            px: 0,
            py: 0,
          },
          '& .MuiTiptap-RichTextField-paper': {
            px: 0,
          },
          '& .MuiTiptap-MenuBar-root': {
            display: 'none',
          },
        }}
      />
      {!readOnly && (
        <>
          <BlockDragHandle />
          <LinkBubbleMenu />
          <TableBubbleMenu />
          <TableFloatingToolbar />
        </>
      )}
    </Box>
  )
}

export default EditorWorkspace
