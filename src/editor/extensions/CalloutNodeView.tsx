import React from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { Box, IconButton, Tooltip } from '@mui/material'
import InfoIcon from '@mui/icons-material/InfoOutlined'
import WarningIcon from '@mui/icons-material/WarningAmberOutlined'
import ErrorIcon from '@mui/icons-material/ErrorOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline'
import CloseIcon from '@mui/icons-material/Close'

const CalloutNodeView: React.FC<NodeViewProps> = ({ node, getPos, deleteNode, editor }) => {
  const type = node.attrs.type || 'info'

  const getIcon = (calloutType: string) => {
    switch (calloutType) {
      case 'warning':
        return <WarningIcon fontSize="small" />
      case 'error':
        return <ErrorIcon fontSize="small" />
      case 'success':
        return <CheckCircleIcon fontSize="small" />
      case 'info':
      default:
        return <InfoIcon fontSize="small" />
    }
  }

  const handleTypeChange = (newType: string) => {
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.setNodeSelection(pos)
    editor.commands.updateAttributes('callout', { type: newType })
  }

  return (
    <NodeViewWrapper className={`callout-block callout-${type}`} style={{ height: '100px' }}>
      <Box className="callout-header">
        <Box className="callout-icon">
          {getIcon(type)}
        </Box>
        <Box className="callout-type-selector">
          <Tooltip title="Info">
            <IconButton size="small" onClick={() => handleTypeChange('info')} color={type === 'info' ? 'primary' : 'default'}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Warning">
            <IconButton size="small" onClick={() => handleTypeChange('warning')} color={type === 'warning' ? 'warning' : 'default'}>
              <WarningIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Error">
            <IconButton size="small" onClick={() => handleTypeChange('error')} color={type === 'error' ? 'error' : 'default'}>
              <ErrorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Success">
            <IconButton size="small" onClick={() => handleTypeChange('success')} color={type === 'success' ? 'success' : 'default'}>
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Tooltip title="Remove callout">
          <IconButton size="small" onClick={deleteNode} className="callout-delete-button">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  )
}

export default CalloutNodeView
