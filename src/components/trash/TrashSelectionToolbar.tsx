import { Box, Paper, IconButton, Divider } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import RestoreIcon from '@mui/icons-material/Restore';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SelectAllIcon from '@mui/icons-material/SelectAll';

interface TrashSelectionToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onRestoreAll: () => void;
    onPermanentDeleteAll: () => void;
    onSelectAll: () => void;
}

const TrashSelectionToolbar = ({
    selectedCount,
    onClearSelection,
    onRestoreAll,
    onPermanentDeleteAll,
    onSelectAll,
}: TrashSelectionToolbarProps) => {
    if (selectedCount === 0) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
            }}
        >
            <IconButton
                size="small"
                onClick={onClearSelection}
                title="Clear selection"
            >
                <ClearIcon fontSize="small" />
            </IconButton>

            <Box sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>
                {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </Box>

            <IconButton
                size="small"
                onClick={onSelectAll}
                title="Select all"
                sx={{ ml: 0.5 }}
            >
                <SelectAllIcon fontSize="small" />
            </IconButton>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <IconButton
                size="small"
                onClick={onRestoreAll}
                color="primary"
                title="Restore all selected items"
            >
                <RestoreIcon fontSize="small" />
            </IconButton>

            <IconButton
                size="small"
                onClick={onPermanentDeleteAll}
                color="error"
                title="Permanently delete all selected items"
            >
                <DeleteForeverIcon fontSize="small" />
            </IconButton>
        </Paper>
    );
};

export default TrashSelectionToolbar;
