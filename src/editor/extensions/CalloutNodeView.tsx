import React from 'react'
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'
import { Box, IconButton, Tooltip } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'
import ReportIcon from '@mui/icons-material/Report'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArticleIcon from '@mui/icons-material/Article'
import CloseIcon from '@mui/icons-material/Close'

const CalloutNodeView: React.FC<NodeViewProps> = ({ node, getPos, deleteNode, editor }) => {
  const type = node.attrs.type || 'info'

  const getIcon = (calloutType: string) => {
    switch (calloutType) {
      case 'warning':
        return <WarningIcon fontSize="small" sx={{ color: '#f57c00' }} /> // Darker Orange
      case 'error':
        return <ReportIcon fontSize="small" sx={{ color: '#c62828' }} /> // Darker Red
      case 'success':
        return <CheckCircleIcon fontSize="small" sx={{ color: '#2e7d32' }} /> // Darker Green
      case 'memo':
        return <ArticleIcon fontSize="small" sx={{ color: '#757575' }} /> // Grey 600
      case 'info':
      default:
        return <InfoIcon fontSize="small" sx={{ color: '#1565c0' }} /> // Darker Blue
    }
  }

  const handleTypeChange = (newType: string) => {
    const pos = getPos()
    if (pos === undefined) return
    editor.commands.setNodeSelection(pos)
    editor.commands.updateAttributes('callout', { type: newType })
  }

  return (
    <NodeViewWrapper className={`callout-block callout-${type}`}>
      <Box sx={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <Box className="callout-icon">
          {getIcon(type)}
        </Box>

        <NodeViewContent className="callout-content" />
      </Box>
    </NodeViewWrapper>
  )
}

export default CalloutNodeView