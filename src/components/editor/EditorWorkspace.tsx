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
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <RichTextField
        variant='standard'
        RichTextContentProps={{
          sx: {
            flex: 1,
            minHeight: 0,
            typography: 'body1',
            '& .ProseMirror': {
              minHeight: '100%',
              paddingLeft: '48px',
              paddingBottom: '32px',
              boxSizing: 'border-box',
            },
          },
        }}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          px: 0,
          '& .MuiTiptap-RichTextField-content': {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            px: 0,
            py: 0,
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
