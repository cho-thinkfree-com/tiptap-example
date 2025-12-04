import { memo, useEffect, useRef, useState } from 'react'
import { Paper, Popper, IconButton, Tooltip, Divider, ToggleButtonGroup, ToggleButton, SvgIcon } from '@mui/material'
import { useRichTextEditorContext } from 'mui-tiptap'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import RoundedCornerIcon from '@mui/icons-material/RoundedCorner'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'

// Custom border icons
const BorderNoneIcon = (props: any) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
    </SvgIcon>
)

const BorderThinIcon = (props: any) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1" />
    </SvgIcon>
)

const BorderThickIcon = (props: any) => (
    <SvgIcon {...props} viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" />
    </SvgIcon>
)

const ImageFloatingToolbar = () => {
    const editor = useRichTextEditorContext()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [currentBorder, setCurrentBorder] = useState<string>('none')
    const [currentBorderRadius, setCurrentBorderRadius] = useState<string>('none')
    const [currentAlign, setCurrentAlign] = useState<string>('center')
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        if (!editor) return

        const updateToolbar = () => {
            if (!editor) return

            // Check if image is selected
            const isImageActive = editor.isActive('image')

            if (isImageActive) {
                // Find the selected image element
                const selectedNode = document.querySelector('.ProseMirror-selectednode')

                if (selectedNode) {
                    setAnchorEl(selectedNode as HTMLElement)

                    // Get current attributes
                    const attrs = editor.getAttributes('image')
                    setCurrentBorder(attrs.border || 'none')
                    setCurrentBorderRadius(attrs.borderRadius || 'none')
                    setCurrentAlign(attrs.textAlign || 'center')
                } else {
                    setAnchorEl(null)
                }
            } else {
                setAnchorEl(null)
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

    // Helper to refresh anchor after DOM changes
    const refreshAnchor = () => {
        requestAnimationFrame(() => {
            const selectedNode = document.querySelector('.ProseMirror-selectednode')
            if (selectedNode && document.body.contains(selectedNode)) {
                setAnchorEl(selectedNode as HTMLElement)
            }
        })
    }

    const handleBorderChange = (border: string) => {
        if (!editor) return
        editor.commands.updateAttributes('image', { border })
        setCurrentBorder(border)
        refreshAnchor()
    }

    const handleBorderRadiusChange = (borderRadius: string) => {
        if (!editor) return
        editor.commands.updateAttributes('image', { borderRadius })
        setCurrentBorderRadius(borderRadius)
        refreshAnchor()
    }

    const handleAlignChange = (_event: React.MouseEvent<HTMLElement>, newAlign: string | null) => {
        if (!editor || !newAlign) return
        editor.commands.updateAttributes('image', { textAlign: newAlign })
        setCurrentAlign(newAlign)
        refreshAnchor()
    }

    const handleDelete = () => {
        if (!editor) return
        editor.commands.deleteSelection()
    }

    // Validate anchorEl is still in document
    const isValidAnchor = Boolean(anchorEl && document.body.contains(anchorEl))
    const open = isValidAnchor && Boolean(editor?.isEditable)

    return (
        <Popper
            open={open}
            anchorEl={isValidAnchor ? anchorEl : null}
            placement="top"
            modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
            sx={{ zIndex: 1300 }}
        >
            <Paper elevation={3} sx={{ p: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5, border: '1px solid', borderColor: 'divider' }}>
                {/* Alignment */}
                <ToggleButtonGroup
                    value={currentAlign}
                    exclusive
                    onChange={handleAlignChange}
                    size="small"
                    sx={{ '& .MuiToggleButton-root': { border: 'none', p: 0.75 } }}
                >
                    <ToggleButton value="left" aria-label="왼쪽 정렬">
                        <FormatAlignLeftIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="center" aria-label="가운데 정렬">
                        <FormatAlignCenterIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="right" aria-label="오른쪽 정렬">
                        <FormatAlignRightIcon fontSize="small" />
                    </ToggleButton>
                </ToggleButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Border */}
                <Tooltip title="테두리 없음">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderChange('none')}
                        color={currentBorder === 'none' ? 'primary' : 'default'}
                    >
                        <BorderNoneIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="얇은 테두리">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderChange('thin')}
                        color={currentBorder === 'thin' ? 'primary' : 'default'}
                    >
                        <BorderThinIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="굵은 테두리">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderChange('medium')}
                        color={currentBorder === 'medium' ? 'primary' : 'default'}
                    >
                        <BorderThickIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Border Radius */}
                <Tooltip title="직각 모서리">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderRadiusChange('none')}
                        color={currentBorderRadius === 'none' ? 'primary' : 'default'}
                    >
                        <BorderThinIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="둥근 모서리">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderRadiusChange('rounded')}
                        color={currentBorderRadius === 'rounded' ? 'primary' : 'default'}
                    >
                        <RoundedCornerIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="원형">
                    <IconButton
                        size="small"
                        onClick={() => handleBorderRadiusChange('circle')}
                        color={currentBorderRadius === 'circle' ? 'primary' : 'default'}
                    >
                        <CircleOutlinedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

                {/* Delete */}
                <Tooltip title="삭제">
                    <IconButton size="small" onClick={handleDelete} color="error">
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Paper>
        </Popper>
    )
}

// Memoize to prevent re-renders when parent state changes
export default memo(ImageFloatingToolbar)
