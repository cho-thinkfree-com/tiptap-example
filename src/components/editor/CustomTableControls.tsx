import { IconButton, Tooltip, Divider, Box } from '@mui/material'
import { useRichTextEditorContext } from 'mui-tiptap'
import { useState, useEffect, memo } from 'react'
import {
    DeleteColumn,
    DeleteRow,
    InsertColumnLeft,
    InsertColumnRight,
    InsertRowBottom,
    InsertRowTop,
    MergeCellsHorizontal,
    SplitCellsHorizontal,
} from 'mui-tiptap/icons'
import GridOffIcon from '@mui/icons-material/GridOff'
import TableCellColorPicker from './TableCellColorPicker'

const CustomTableControls = () => {
    const editor = useRichTextEditorContext()
    const [canMerge, setCanMerge] = useState(false)
    const [canSplit, setCanSplit] = useState(false)
    const [canAddColumn, setCanAddColumn] = useState(false)
    const [canAddRow, setCanAddRow] = useState(false)
    const [canDeleteColumn, setCanDeleteColumn] = useState(false)
    const [canDeleteRow, setCanDeleteRow] = useState(false)
    const [canDeleteTable, setCanDeleteTable] = useState(false)

    useEffect(() => {
        if (!editor) {
            return
        }

        const updateButtonStates = () => {
            if (!editor) {
                return
            }

            // Update all button states based on current editor state
            setCanMerge(editor.can().mergeCells())
            setCanSplit(editor.can().splitCell())
            setCanAddColumn(editor.can().addColumnBefore())
            setCanAddRow(editor.can().addRowBefore())
            setCanDeleteColumn(editor.can().deleteColumn())
            setCanDeleteRow(editor.can().deleteRow())
            setCanDeleteTable(editor.can().deleteTable())

            // Debug logging
            console.log('[CustomTableControls] Button states updated:', {
                canMerge: editor.can().mergeCells(),
                canSplit: editor.can().splitCell(),
                selection: editor.state.selection.constructor.name,
            })
        }

        // Update on selection change and transactions
        editor.on('selectionUpdate', updateButtonStates)
        editor.on('transaction', updateButtonStates)
        updateButtonStates()

        return () => {
            editor.off('selectionUpdate', updateButtonStates)
            editor.off('transaction', updateButtonStates)
        }
    }, [editor])

    if (!editor) {
        return null
    }

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Column controls */}
            <Tooltip title="열 앞에 삽입">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canAddColumn}
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                    >
                        <InsertColumnLeft fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="열 뒤에 삽입">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canAddColumn}
                        onClick={() => editor.chain().focus().addColumnAfter().run()}
                    >
                        <InsertColumnRight fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="열 삭제">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canDeleteColumn}
                        onClick={() => editor.chain().focus().deleteColumn().run()}
                    >
                        <DeleteColumn fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Row controls */}
            <Tooltip title="행 위에 삽입">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canAddRow}
                        onClick={() => editor.chain().focus().addRowBefore().run()}
                    >
                        <InsertRowTop fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="행 아래에 삽입">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canAddRow}
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                    >
                        <InsertRowBottom fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="행 삭제">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canDeleteRow}
                        onClick={() => editor.chain().focus().deleteRow().run()}
                    >
                        <DeleteRow fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Cell background color */}
            <TableCellColorPicker />

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Merge/Split controls */}
            <Tooltip title="셀 병합">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canMerge}
                        onClick={() => {
                            editor.chain().focus().mergeCells().run()
                            console.log('[CustomTableControls] Merge cells executed')
                        }}
                    >
                        <MergeCellsHorizontal fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
            <Tooltip title="셀 분리">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canSplit}
                        onClick={() => {
                            editor.chain().focus().splitCell().run()
                            console.log('[CustomTableControls] Split cell executed')
                        }}
                    >
                        <SplitCellsHorizontal fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Table controls */}
            <Tooltip title="테이블 삭제">
                <span>
                    <IconButton
                        size="small"
                        disabled={!canDeleteTable}
                        onClick={() => editor.chain().focus().deleteTable().run()}
                    >
                        <GridOffIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        </Box>
    )
}

// Memoize to prevent re-renders when parent state changes
export default memo(CustomTableControls)
