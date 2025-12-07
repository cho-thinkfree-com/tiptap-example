import { Box, Paper, IconButton, Divider } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import PublicIcon from '@mui/icons-material/Public';

interface SelectionToolbarProps {
    selectedCount: number;
    hasDocuments: boolean;
    onDelete: () => void;
    onClearSelection: () => void;
    onStar: () => void;
    onSelectAll: () => void;
    showStar?: boolean;
    showDelete?: boolean;
    hasPublicLinks?: boolean;
    onPublish?: () => void;
}

const SelectionToolbar = ({
    selectedCount,

    onDelete,
    onClearSelection,
    onStar,
    onSelectAll,
    showStar = true,
    showDelete = true,
    hasPublicLinks,
    onPublish,
}: SelectionToolbarProps) => {
    if (selectedCount === 0) return null;

    return (
        <Paper
            elevation={0}
            sx={{
                width: '100%',
                px: 2,
                py: 0.5,
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

            {hasPublicLinks && onPublish && (
                <IconButton
                    size="small"
                    onClick={onPublish}
                    title="Copy share links"
                >
                    <PublicIcon fontSize="small" />
                </IconButton>
            )}

            {showStar && (
                <IconButton
                    size="small"
                    onClick={onStar}
                    title="Mark as important"
                >
                    <StarBorderIcon fontSize="small" />
                </IconButton>
            )}

            {showDelete && (
                <IconButton
                    size="small"
                    onClick={onDelete}
                    color="error"
                    title="Delete selected items"
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            )}
        </Paper>
    );
};

export default SelectionToolbar;
