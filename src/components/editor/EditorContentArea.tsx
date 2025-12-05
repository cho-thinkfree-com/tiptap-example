import { Box } from '@mui/material'
import { RichTextField, useRichTextEditorContext } from 'mui-tiptap'
import BlockDragHandle from './BlockDragHandle'
import TableFloatingToolbar from './TableFloatingToolbar'
import ImageFloatingToolbar from './ImageFloatingToolbar'
import CalloutFloatingToolbar from './CalloutFloatingToolbar'
import { memo, useEffect, useState } from 'react'
import type { ViewerTemplate } from '../../lib/viewerTemplates'
import { getTemplateStyles } from '../../lib/viewerTemplates'
import { baseDocumentStyles } from '../../lib/baseDocumentStyles'

interface EditorContentAreaProps {
  readOnly?: boolean
  initialWidth?: string
  overrideWidth?: string
  viewerTemplate?: ViewerTemplate
}

const EditorContentArea = ({ readOnly, initialWidth = '950px', overrideWidth, viewerTemplate }: EditorContentAreaProps) => {
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
        backgroundColor: '#fcfcfc', // Very subtle gray
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
            display: 'block !important', // Enforce block layout to allow natural height growth
            '& .ProseMirror': {
              width: '100%',
              maxWidth: layoutWidth === '100%' ? 'none' : layoutWidth,
              minHeight: '100%',
              height: 'auto !important', // Force height to grow with content
              padding: '48px 48px 50vh 48px', // Large bottom padding for overscroll
              boxSizing: 'border-box',
              margin: '32px auto 0',
              transition: 'max-width 0.3s ease-in-out',
              // Ensure white background for the content area
              backgroundColor: 'white',
              border: '1px solid rgba(0, 0, 0, 0.05)', // Subtle border
              // Image alignment based on data-text-align attribute
              '& img[data-text-align="left"]': {
                display: 'block',
                marginLeft: 0,
                marginRight: 'auto',
              },
              '& img[data-text-align="center"]': {
                display: 'block',
                marginLeft: 'auto',
                marginRight: 'auto',
              },
              '& img[data-text-align="right"]': {
                display: 'block',
                marginLeft: 'auto',
                marginRight: 0,
              },
              // Apply base document styles
              ...baseDocumentStyles,
              // Apply template styles in viewer mode (overrides base styles)
              ...(readOnly && viewerTemplate ? getTemplateStyles(viewerTemplate) : {}),
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
          <TableFloatingToolbar />
          <ImageFloatingToolbar />
          <CalloutFloatingToolbar />
        </>
      )}
    </Box>
  )
}

// Memoize to prevent re-renders when parent state changes (e.g., saveStatus)
// This prevents floating toolbars and popovers from jumping during save operations
export default memo(EditorContentArea)
