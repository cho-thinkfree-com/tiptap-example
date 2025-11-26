import { Box } from '@mui/material'
import { LinkBubbleMenu, RichTextField, TableBubbleMenu } from 'mui-tiptap'
import BlockDragHandle from './BlockDragHandle'
import TableFloatingToolbar from './TableFloatingToolbar'

interface EditorWorkspaceProps {
  readOnly?: boolean
}

const EditorWorkspace = ({ readOnly }: EditorWorkspaceProps) => {
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
        backgroundColor: readOnly ? '#f5f5f5' : 'transparent',
      }}
    >
      <RichTextField
        variant='standard'
        RichTextContentProps={{
          sx: readOnly ? {
            flex: 1,
            minHeight: 0,
            height: '100%',
            overflowY: 'auto',
            typography: 'body1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            '& .ProseMirror': {
              width: '100%',
              maxWidth: '816px',
              minHeight: 'calc(100% - 64px)',
              margin: '32px 0',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
              padding: '48px',
              boxSizing: 'border-box',
              outline: 'none',
            },
          } : {
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
