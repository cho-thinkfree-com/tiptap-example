import React, { useCallback, useState } from 'react'
import { IconButton, Popover, Tooltip, Box } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'
import ReportIcon from '@mui/icons-material/Report'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArticleIcon from '@mui/icons-material/Article'
import CloseIcon from '@mui/icons-material/Close'
import { useRichTextEditorContext } from 'mui-tiptap'
import { useI18n } from '../../lib/i18n'

type CalloutType = 'info' | 'warning' | 'error' | 'success' | 'memo'

const MenuButtonCallout: React.FC = () => {
  const { strings } = useI18n()
  const toolbarStrings = strings.editor.toolbar
  const editor = useRichTextEditorContext()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }, [])

  const handleClose = useCallback(() => {
    setAnchorEl(null)
  }, [])

  const handleSetCallout = useCallback(
    (type: CalloutType) => {
      if (editor) {
        editor.commands.setCallout(type)
      }
      handleClose()
    },
    [editor, handleClose],
  )

  const isCalloutActive = editor?.isActive('callout')

  return (
    <>
      <Tooltip title={toolbarStrings.calloutLabel}>
        <span>
          <IconButton
            size='small'
            aria-label={toolbarStrings.calloutLabel}
            onClick={handleOpen}
            color={isCalloutActive ? 'primary' : 'default'}
          >
            <InfoIcon fontSize='small' />
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'row', p: 1, gap: 0.5 }}>
          <Tooltip title="Info">
            <IconButton size='small' onClick={() => handleSetCallout('info')} sx={{ color: '#1565c0' }}>
              <InfoIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title="Memo">
            <IconButton size='small' onClick={() => handleSetCallout('memo')} sx={{ color: '#757575' }}>
              <ArticleIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title="Success">
            <IconButton size='small' onClick={() => handleSetCallout('success')} sx={{ color: '#2e7d32' }}>
              <CheckCircleIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title="Warning">
            <IconButton size='small' onClick={() => handleSetCallout('warning')} sx={{ color: '#f57c00' }}>
              <WarningIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title="Error">
            <IconButton size='small' onClick={() => handleSetCallout('error')} sx={{ color: '#c62828' }}>
              <ReportIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          {isCalloutActive && (
            <Tooltip title={toolbarStrings.removeCallout}>
              <IconButton size='small' onClick={() => { editor?.commands.unsetCallout(); handleClose(); }}>
                <CloseIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Popover>
    </>
  )
}

export default MenuButtonCallout
