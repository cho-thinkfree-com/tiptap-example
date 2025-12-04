import { useState, memo } from 'react'
import { IconButton, Popover, Box, Tooltip, Button } from '@mui/material'
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill'
import { HexColorPicker } from 'react-colorful'
import { useRichTextEditorContext } from 'mui-tiptap'

const PRESET_COLORS = [
    '#ffffff', // 흰색
    '#f3f4f6', // 연한 회색
    '#fef3c7', // 연한 노란색
    '#fecaca', // 연한 빨간색
    '#bfdbfe', // 연한 파란색
    '#bbf7d0', // 연한 초록색
    '#e9d5ff', // 연한 보라색
    '#fecdd3', // 연한 분홍색
]

const TableCellColorPicker = () => {
    const editor = useRichTextEditorContext()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [color, setColor] = useState('#ffffff')

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    const handleColorChange = (newColor: string) => {
        setColor(newColor)
        // Don't call focus() to prevent popover from jumping
        editor?.commands.setCellAttribute('backgroundColor', newColor)
    }

    const handleClearColor = () => {
        editor?.commands.setCellAttribute('backgroundColor', null)
        handleClose()
    }

    const open = Boolean(anchorEl)
    const canSetColor = editor?.can().setCellAttribute('backgroundColor', '#000000') ?? false

    return (
        <>
            <Tooltip title="셀 배경색">
                <span>
                    <IconButton
                        size="small"
                        onClick={handleClick}
                        disabled={!canSetColor}
                    >
                        <FormatColorFillIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
            >
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, width: 220 }}>
                    {/* 프리셋 색상 */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        {PRESET_COLORS.map((presetColor) => (
                            <Box
                                key={presetColor}
                                onClick={() => handleColorChange(presetColor)}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: presetColor,
                                    border: '2px solid',
                                    borderColor: color === presetColor ? 'primary.main' : 'divider',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                        transform: 'scale(1.05)',
                                    },
                                }}
                            />
                        ))}
                    </Box>

                    {/* 커스텀 색상 선택 */}
                    <Box>
                        <HexColorPicker color={color} onChange={handleColorChange} style={{ width: '100%' }} />
                    </Box>

                    {/* 색상 제거 버튼 */}
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={handleClearColor}
                        fullWidth
                    >
                        배경색 제거
                    </Button>
                </Box>
            </Popover>
        </>
    )
}

// Memoize to prevent re-renders when parent state changes
export default memo(TableCellColorPicker)
