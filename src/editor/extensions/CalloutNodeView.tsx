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

  const colorMap: { [key: string]: string } = {
    info: '#2196f3',
    warning: '#ff9800',
    error: '#f44336',
    success: '#4caf50',
  }

  const getIcon = (calloutType: string) => {
    const iconColor = colorMap[calloutType] || colorMap.info
    let IconComponent
    switch (calloutType) {
      case 'warning':
        IconComponent = WarningIcon
        break
      case 'error':
        IconComponent = ErrorIcon
        break
      case 'success':
        IconComponent = CheckCircleIcon
        break
      case 'info':
      default:
        IconComponent = InfoIcon
        break
    }
    return <IconComponent fontSize="small" sx={{ color: iconColor }} />
  }

  const handleTypeChange = (newType: string) => {
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.setNodeSelection(pos)
    editor.commands.updateAttributes('callout', { type: newType })
  }

  return (
    <NodeViewWrapper
      className={`callout-block callout-${type}`}
      style={{
        height: '100px',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start'
      }}
    >
      <Box className="callout-icon">
        {getIcon(type)}
      </Box>
      <NodeViewContent className="callout-content" />
      <Box className="callout-controls">
        <Box className="callout-type-selector">
          <Tooltip title="Info">
            <IconButton size="small" onClick={() => handleTypeChange('info')} color={type === 'info' ? 'primary' : 'inherit'}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Warning">
            <IconButton size="small" onClick={() => handleTypeChange('warning')} color={type === 'warning' ? 'warning' : 'inherit'}>
              <WarningIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Error">
            <IconButton size="small" onClick={() => handleTypeChange('error')} color={type === 'error' ? 'error' : 'inherit'}>
              <ErrorIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Success">
            <IconButton size="small" onClick={() => handleTypeChange('success')} color={type === 'success' ? 'success' : 'inherit'}>
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
    </NodeViewWrapper>
  )
}

export default CalloutNodeView
