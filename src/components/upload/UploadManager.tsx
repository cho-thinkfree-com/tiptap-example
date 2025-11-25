import { Box, Card, CardContent, CardHeader, Collapse, IconButton, Typography } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUpload } from '../../context/UploadContext';
import UploadItem from './UploadItem';

const UploadManager = () => {
    const { uploads, isExpanded, toggleExpanded, removeUpload, clearCompleted, clearFailed } = useUpload();

    if (uploads.length === 0) return null;

    const uploadingCount = uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length;
    const errorCount = uploads.filter(u => u.status === 'error').length;
    const successCount = uploads.filter(u => u.status === 'success').length;

    const getTitle = () => {
        if (uploadingCount > 0) return `Uploading ${uploadingCount} item${uploadingCount !== 1 ? 's' : ''}...`;
        if (errorCount > 0) return `${errorCount} upload${errorCount !== 1 ? 's' : ''} failed`;
        return 'Upload complete';
    };

    return (
        <Card
            sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                width: 360,
                maxHeight: 500,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1300,
                boxShadow: 6,
                borderRadius: 2,
            }}
        >
            <CardHeader
                sx={{
                    bgcolor: errorCount > 0 ? 'warning.main' : 'primary.main',
                    color: '#fff',
                    py: 1.5,
                    px: 2,
                    cursor: 'pointer',
                    '& .MuiCardHeader-action': { m: 0, alignSelf: 'center' },
                    '& .MuiTypography-root': { color: '#fff' }
                }}
                onClick={toggleExpanded}
                title={
                    <Typography variant="subtitle2" fontWeight={600}>
                        {getTitle()}
                    </Typography>
                }
                action={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {successCount > 0 ? (
                            <IconButton
                                size="small"
                                color="inherit"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearCompleted();
                                }}
                                title="Clear completed"
                                sx={{ mr: 1 }}
                            >
                                <DoneAllIcon fontSize="small" />
                            </IconButton>
                        ) : errorCount > 0 ? (
                            <IconButton
                                size="small"
                                color="inherit"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    clearFailed();
                                }}
                                title="Clear all failed"
                                sx={{ mr: 1 }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        ) : null}
                        <IconButton size="small" color="inherit">
                            {isExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
                        </IconButton>
                    </Box>
                }
            />
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <CardContent sx={{ p: 2, maxHeight: 400, overflowY: 'auto', bgcolor: 'background.paper' }}>
                    {uploads.map((item) => (
                        <UploadItem
                            key={item.id}
                            item={item}
                            onRemove={removeUpload}
                        />
                    ))}
                </CardContent>
            </Collapse>
        </Card>
    );
};

export default UploadManager;
