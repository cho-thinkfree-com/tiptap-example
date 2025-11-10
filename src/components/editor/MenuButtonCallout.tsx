import React, { useCallback, useState } from 'react'
import { IconButton, Popover, Tooltip, Box } from '@mui/material'
import InfoIcon from '@mui/icons-material/InfoOutlined'
import WarningIcon from '@mui/icons-material/WarningAmberOutlined'
import ErrorIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline'
import CloseIcon from '@mui/icons-material/Close'
import { useRichTextEditorContext } from 'mui-tiptap'
import { useI18n } from '../../lib/i18n'

type CalloutType = 'info' | 'warning' | 'error' | 'success'

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
        <Box sx={{ display: 'flex', flexDirection: 'row', p: 1 }}>
          <Tooltip title={toolbarStrings.calloutInfo}>
            <IconButton size='small' onClick={() => handleSetCallout('info')}>
              <InfoIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title={toolbarStrings.calloutWarning}>
            <IconButton size='small' onClick={() => handleSetCallout('warning')}>
              <WarningIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title={toolbarStrings.calloutError}>
            <IconButton size='small' onClick={() => handleSetCallout('error')}>
              <ErrorIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title={toolbarStrings.calloutSuccess}>
            <IconButton size='small' onClick={() => handleSetCallout('success')}>
              <CheckCircleIcon fontSize='small' />
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
