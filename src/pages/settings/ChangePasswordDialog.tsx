import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Box,
    InputAdornment,
    IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { updateAccount } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

interface ChangePasswordDialogProps {
    open: boolean;
    onClose: () => void;
}

export const ChangePasswordDialog = ({ open, onClose }: ChangePasswordDialogProps) => {
    const { tokens } = useAuth();
    const { strings } = useI18n();
    const t = strings.settings.global.changePasswordDialog;
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Visibility state
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleClose = () => {
        // Reset state on close
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setError(null);
        setSuccess(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tokens) return;

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError(t.requiredError);
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t.mismatchError);
            return;
        }

        if (newPassword.length < 8) {
            setError(t.minLengthError);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            await updateAccount(tokens.accessToken, {
                currentPassword,
                newPassword
            });
            setSuccess(t.success);
            setTimeout(() => {
                handleClose();
            }, 1500);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleClickShowPassword = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
        setter((show) => !show);
    };

    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    const getEndAdornment = (show: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>) => (
        <InputAdornment position="end">
            <IconButton
                aria-label="toggle password visibility"
                onClick={() => handleClickShowPassword(setter)}
                onMouseDown={handleMouseDownPassword}
                edge="end"
            >
                {show ? <VisibilityOff /> : <Visibility />}
            </IconButton>
        </InputAdornment>
    );

    return (
        <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t.title}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <TextField
                            label={t.currentPassword}
                            type={showCurrentPassword ? 'text' : 'password'}
                            fullWidth
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={loading || !!success}
                            autoFocus
                            InputProps={{
                                endAdornment: getEndAdornment(showCurrentPassword, setShowCurrentPassword)
                            }}
                        />
                        <TextField
                            label={t.newPassword}
                            type={showNewPassword ? 'text' : 'password'}
                            fullWidth
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading || !!success}
                            helperText={t.helperNewPassword}
                            InputProps={{
                                endAdornment: getEndAdornment(showNewPassword, setShowNewPassword)
                            }}
                        />
                        <TextField
                            label={t.confirmPassword}
                            type={showConfirmPassword ? 'text' : 'password'}
                            fullWidth
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading || !!success}
                            error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                            helperText={confirmPassword.length > 0 && newPassword !== confirmPassword ? t.helperConfirmMismatch : ""}
                            InputProps={{
                                endAdornment: getEndAdornment(showConfirmPassword, setShowConfirmPassword)
                            }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={handleClose} disabled={loading}>
                        {t.cancel}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        disabled={loading || !!success}
                    >
                        {loading ? <CircularProgress size={24} /> : t.submit}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
