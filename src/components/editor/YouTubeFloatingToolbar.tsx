import { memo, useEffect, useRef, useState } from 'react'
import { Paper, Popper, IconButton, Tooltip, Divider, ToggleButtonGroup, ToggleButton, Button, ButtonGroup } from '@mui/material'
import { useRichTextEditorContext } from 'mui-tiptap'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlayDisabledIcon from '@mui/icons-material/PlayDisabled'
import SecurityIcon from '@mui/icons-material/Security'
import { useFloatingToolbarBoundary } from '../../hooks/useFloatingToolbarVisibility'

const DEFAULT_WIDTH = 640

const YouTubeFloatingToolbar = () => {
    const editor = useRichTextEditorContext()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [currentAlign, setCurrentAlign] = useState<string>('center')
    const [currentWidth, setCurrentWidth] = useState<number>(DEFAULT_WIDTH)
    const [controls, setControls] = useState<boolean>(true)
    const [nocookie, setNocookie] = useState<boolean>(false)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        if (!editor) return

        const updateToolbar = () => {
            if (!editor) return

            const isYoutubeActive = editor.isActive('youtube')

            if (isYoutubeActive) {
                const selectedNode = document.querySelector('.ProseMirror-selectednode')

                if (selectedNode) {
                    setAnchorEl(selectedNode as HTMLElement)

                    const attrs = editor.getAttributes('youtube')
                    setCurrentAlign(attrs.textAlign || 'center')
                    setCurrentWidth(attrs.width || DEFAULT_WIDTH)
                    setControls(attrs.controls !== false)
                    setNocookie(attrs.nocookie === true)
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

    const refreshAnchor = () => {
        requestAnimationFrame(() => {
            const selectedNode = document.querySelector('.ProseMirror-selectednode')
            if (selectedNode && document.body.contains(selectedNode)) {
                setAnchorEl(selectedNode as HTMLElement)
            }
        })
    }

    const handleAlignChange = (_event: React.MouseEvent<HTMLElement>, newAlign: string | null) => {
        if (!editor || !newAlign) return
        editor.commands.updateAttributes('youtube', { textAlign: newAlign })
        setCurrentAlign(newAlign)
        refreshAnchor()
    }

    const handleWidthChange = (percent: number) => {
        if (!editor) return
        const newWidth = Math.floor((DEFAULT_WIDTH * percent) / 100)
        editor.commands.updateAttributes('youtube', { width: newWidth })
        setCurrentWidth(newWidth)
        refreshAnchor()
    }

    const handleControlsToggle = () => {
        if (!editor) return
        const newControls = !controls
        editor.commands.updateAttributes('youtube', { controls: newControls })
        setControls(newControls)
        refreshAnchor()
    }

    const handleNocookieToggle = () => {
        if (!editor) return
        const newNocookie = !nocookie
        editor.commands.updateAttributes('youtube', { nocookie: newNocookie })
        setNocookie(newNocookie)
        refreshAnchor()
    }

    const handleDelete = () => {
        if (!editor) return
        editor.commands.deleteSelection()
    }

    const isValidAnchor = Boolean(anchorEl && document.body.contains(anchorEl))
    const { boundaryEl, isInViewport } = useFloatingToolbarBoundary(anchorEl)
    const open = isValidAnchor && isInViewport && Boolean(editor?.isEditable)

    const widthPresets = [50, 100, 150]

    const getCurrentPercent = (): number => {
        if (typeof currentWidth === 'number') {
            return Math.floor((currentWidth / DEFAULT_WIDTH) * 100)
        }
        return 100
    }

    const currentPercent = getCurrentPercent()

    const isPresetSelected = (preset: number): boolean => {
        return Math.abs(currentPercent - preset) <= 2
    }

    return (
        <Popper
            open={open}
            anchorEl={isValidAnchor ? anchorEl : null}
            placement="top"
            modifiers={[
                { name: 'offset', options: { offset: [0, 8] } },
                { name: 'flip', enabled: true, options: { boundary: boundaryEl || 'clippingParents' } },
                { name: 'preventOverflow', enabled: true, options: { boundary: boundaryEl || 'clippingParents', padding: 8 } },
            ]}
            sx={{ zIndex: 1300 }}
        >
            <Paper elevation={3} sx={{ p: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5, border: '1px solid', borderColor: 'divider' }}>
                {/* Width presets */}
                <ButtonGroup size="small" variant="outlined" sx={{ '& .MuiButton-root': { minWidth: 36, px: 1, py: 0.5, fontSize: '0.75rem' } }}>
                    {widthPresets.map((percent) => (
                        <Tooltip key={percent} title={`너비 ${percent}%`}>
                            <Button
                                onClick={() => handleWidthChange(percent)}
                                variant={isPresetSelected(percent) ? 'contained' : 'outlined'}
                                sx={{ fontWeight: isPresetSelected(percent) ? 'bold' : 'normal' }}
                            >
                                {percent}%
                            </Button>
                        </Tooltip>
                    ))}
                </ButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

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

                {/* YouTube Options */}
                <Tooltip title={controls ? '컨트롤 표시됨' : '컨트롤 숨김'}>
                    <IconButton
                        size="small"
                        onClick={handleControlsToggle}
                        color={controls ? 'primary' : 'default'}
                    >
                        {controls ? <PlayArrowIcon fontSize="small" /> : <PlayDisabledIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
                <Tooltip title={nocookie ? '개인정보 보호 모드' : '일반 모드'}>
                    <IconButton
                        size="small"
                        onClick={handleNocookieToggle}
                        color={nocookie ? 'primary' : 'default'}
                    >
                        <SecurityIcon fontSize="small" />
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

export default memo(YouTubeFloatingToolbar)
