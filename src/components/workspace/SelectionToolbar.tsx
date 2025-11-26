import { Box, Paper, IconButton, Divider } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PublicIcon from '@mui/icons-material/Public';
import SelectAllIcon from '@mui/icons-material/SelectAll';

interface SelectionToolbarProps {
    selectedCount: number;
    hasDocuments: boolean;
    hasPublicLinks: boolean;
    onDelete: () => void;
    onClearSelection: () => void;
    onStar: () => void;
    onPublish: () => void;
    onSelectAll: () => void;
    showStar?: boolean;
    showPublish?: boolean;
    showDelete?: boolean;
}

const SelectionToolbar = ({
    selectedCount,
    hasDocuments,
    hasPublicLinks,
    onDelete,
    onClearSelection,
    onStar,
    onPublish,
    onSelectAll,
    showStar = true,
    showPublish = true,
    showDelete = true,
}: SelectionToolbarProps) => {
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

            {showStar && (
                <IconButton
                    size="small"
                    onClick={onStar}
                    title="Mark as important"
                >
                    <StarBorderIcon fontSize="small" />
                </IconButton>
            )}

            {showPublish && (
                <IconButton
                    size="small"
                    onClick={onPublish}
                    disabled={!hasDocuments || !hasPublicLinks}
                    title={
                        !hasDocuments
                            ? "Only documents can be published"
                            : !hasPublicLinks
                                ? "Selected items must have public links"
                                : "Copy public link"
                    }
                >
                    <PublicIcon fontSize="small" />
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
