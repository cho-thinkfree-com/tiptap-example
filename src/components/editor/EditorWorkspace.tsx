import { Box } from '@mui/material'
import { LinkBubbleMenu, RichTextField, TableBubbleMenu } from 'mui-tiptap'
import BlockDragHandle from './BlockDragHandle'
import TableFloatingToolbar from './TableFloatingToolbar'

const EditorWorkspace = () => {
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
            '& .ProseMirror': {
              minHeight: '100%',
              paddingLeft: '48px',
              paddingBottom: '24px',
              paddingRight: '16px',
              boxSizing: 'border-box',
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
      <BlockDragHandle />
      <LinkBubbleMenu />
      <TableBubbleMenu />
      <TableFloatingToolbar />
    </Box>
  )
}

export default EditorWorkspace
