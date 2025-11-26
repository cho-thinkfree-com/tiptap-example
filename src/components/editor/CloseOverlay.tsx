import { Backdrop, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useI18n } from '../../lib/i18n';

type CloseOverlayState = 'saving' | 'success' | 'error';

interface CloseOverlayProps {
    open: boolean;
    state: CloseOverlayState;
    onCloseNow?: () => void;
    onDismiss?: () => void;
}

const CloseOverlay = ({ open, state, onCloseNow, onDismiss }: CloseOverlayProps) => {
    const { strings } = useI18n();

    const getIcon = () => {
        switch (state) {
            case 'saving':
                return <CircularProgress size={60} sx={{ color: 'primary.main' }} />;
            case 'success':
                return <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main' }} />;
            case 'error':
                return <WarningIcon sx={{ fontSize: 60, color: 'warning.main' }} />;
        }
    };

    const getMessage = () => {
        switch (state) {
            case 'saving':
                return strings.editor.close.saving || 'Saving changes... Please wait.';
            case 'success':
                return strings.editor.close.saveComplete || 'Save complete!';
            case 'error':
                return strings.editor.close.saveError || 'Failed to save changes.';
        }
    };

    const getButton = () => {
        if (state === 'success' && onCloseNow) {
            return (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={onCloseNow}
                    sx={{ mt: 3 }}
                >
                    {strings.editor.close.closeNow || 'Close Now'}
                </Button>
            );
        }
        if (state === 'error' && onDismiss) {
            return (
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={onDismiss}
                    sx={{ mt: 3 }}
                >
                    {strings.workspace.cancel || 'Cancel'}
                </Button>
            );
        }
        return null;
    };

    return (
        <Backdrop
            open={open}
            sx={{
                zIndex: (theme) => theme.zIndex.modal + 1,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
        >
            <Paper
                elevation={8}
                sx={{
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    maxWidth: 500,
                    textAlign: 'center',
                }}
            >
                <Box sx={{ mb: 3 }}>
                    {getIcon()}
                </Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                    {getMessage()}
                </Typography>
                {getButton()}
            </Paper>
        </Backdrop>
    );
};

export default CloseOverlay;
