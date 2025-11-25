import { Box, IconButton, LinearProgress, Paper, Typography } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import type { UploadItem as UploadItemType } from '../../context/UploadContext';

interface UploadItemProps {
    item: UploadItemType;
    onRemove: (id: string) => void;
}

const UploadItem = ({ item, onRemove }: UploadItemProps) => {
    const isError = item.status === 'error';
    const isSuccess = item.status === 'success';
    const isUploading = item.status === 'uploading';

    return (
        <Paper
            elevation={0}
            sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                mb: 1,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Progress Background for Uploading state */}
            {isUploading && (
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                    }}
                >
                    <LinearProgress variant="determinate" value={item.progress} />
                </Box>
            )}

            <InsertDriveFileIcon color="action" sx={{ mr: 2 }} />

            <Box sx={{ flexGrow: 1, minWidth: 0, mr: 2 }}>
                <Typography variant="body2" noWrap title={item.file.name} fontWeight={500}>
                    {item.file.name}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        {(item.file.size / 1024).toFixed(1)} KB
                    </Typography>
                    {isError && (
                        <Typography variant="caption" color="error.main" noWrap title={item.error}>
                            • {item.error}
                        </Typography>
                    )}
                </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {isSuccess && <CheckCircleIcon color="success" fontSize="small" sx={{ mr: 1 }} />}
                {isError && <ErrorIcon color="error" fontSize="small" sx={{ mr: 1 }} />}

                <IconButton size="small" onClick={() => onRemove(item.id)}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
        </Paper>
    );
};

export default UploadItem;
