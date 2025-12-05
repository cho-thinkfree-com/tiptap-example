import { Paper, Popper, IconButton, Tooltip, Divider } from '@mui/material'
import { memo, useEffect, useRef, useState } from 'react'
import { useRichTextEditorContext } from 'mui-tiptap'
import InfoIcon from '@mui/icons-material/Info'
import WarningIcon from '@mui/icons-material/Warning'
import ReportIcon from '@mui/icons-material/Report'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArticleIcon from '@mui/icons-material/Article'
import DeleteIcon from '@mui/icons-material/DeleteOutline'

const CalloutFloatingToolbar = () => {
    const editor = useRichTextEditorContext()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [calloutType, setCalloutType] = useState<string>('info')
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        if (!editor) {
            return
        }

        const updateToolbar = () => {
            if (!editor) {
                return
            }

            const { state, view } = editor
            const { selection } = state
            const { from } = selection

            // Check if selection is inside a callout
            let calloutNode: HTMLElement | null = null
            let type = 'info'

            // Use Tiptap's isActive to check context
            if (editor.isActive('callout')) {
                const resolved = view.domAtPos(from)
                let node: Node | null = resolved.node

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    node = node.parentNode
                }

                calloutNode = (node as HTMLElement | null)?.closest('.callout-block') ?? null

                if (calloutNode) {
                    // Try to get type from attribute
                    type = calloutNode.getAttribute('data-callout-type') || 'info'
                }
            }

            if (calloutNode) {
                setAnchorEl((prev) => (prev === calloutNode ? prev : calloutNode))
                setCalloutType(type)
            } else {
                setAnchorEl((prev) => (prev !== null ? null : prev))
            }
        }

        const scheduleUpdate = () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
            rafRef.current = requestAnimationFrame(updateToolbar)
        }

        editor.on('selectionUpdate', scheduleUpdate)
        editor.on('transaction', scheduleUpdate)
        updateToolbar()

        return () => {
            editor.off('selectionUpdate', scheduleUpdate)
            editor.off('transaction', scheduleUpdate)
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [editor])

    const handleTypeChange = (type: string) => {
        if (editor) {
            editor.chain().focus().setCallout(type as any).run()
        }
    }

    const handleDelete = () => {
        if (editor) {
            editor.chain().focus().unsetCallout().run()
        }
    }

    const open = Boolean(anchorEl) && Boolean(editor?.isEditable)

    return (
        <Popper
            open={open}
            anchorEl={anchorEl}
            placement='top'
            modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
            style={{ zIndex: 10 }} // Ensure it's above other elements
        >
            <Paper elevation={3} sx={{ p: 0.5, display: 'inline-flex', alignItems: 'center', gap: 0.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Tooltip title="Info">
                    <IconButton size="small" onClick={() => handleTypeChange('info')} color={calloutType === 'info' ? 'primary' : 'default'}>
                        <InfoIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Memo">
                    <IconButton size="small" onClick={() => handleTypeChange('memo')} sx={{ color: calloutType === 'memo' ? '#757575' : 'inherit' }}>
                        <ArticleIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Success">
                    <IconButton size="small" onClick={() => handleTypeChange('success')} color={calloutType === 'success' ? 'success' : 'default'}>
                        <CheckCircleIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Warning">
                    <IconButton size="small" onClick={() => handleTypeChange('warning')} color={calloutType === 'warning' ? 'warning' : 'default'}>
                        <WarningIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Error">
                    <IconButton size="small" onClick={() => handleTypeChange('error')} color={calloutType === 'error' ? 'error' : 'default'}>
                        <ReportIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem variant="middle" sx={{ mx: 0.5 }} />

                <Tooltip title="Delete Callout">
                    <IconButton size="small" onClick={handleDelete} color="error">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Paper>
        </Popper>
    )
}

export default memo(CalloutFloatingToolbar)
