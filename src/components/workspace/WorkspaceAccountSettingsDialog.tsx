import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    Typography,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    CircularProgress,
    Alert,
    useTheme,
    Avatar,
    Grid,
    Link
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';
import {
    getWorkspace,
    getWorkspaceMemberProfile,
    updateWorkspaceMemberProfile,
    type WorkspaceSummary,
    type MembershipSummary
} from '../../lib/api';

interface WorkspaceAccountSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    workspaceId: string;
}

const WorkspaceAccountSettingsDialog = ({ open, onClose, workspaceId }: WorkspaceAccountSettingsDialogProps) => {
    const { isAuthenticated } = useAuth();
    const { strings, setLocale } = useI18n();
    const theme = useTheme();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [profileSaved, setProfileSaved] = useState(false);

    // Data
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [member, setMember] = useState<MembershipSummary | null>(null);

    // Form States
    const [displayName, setDisplayName] = useState('');
    const [profileLocale, setProfileLocale] = useState<Locale>('en-US');
    const [profileTimezone, setProfileTimezone] = useState('');

    // Options
    const languageOptions = strings.settings.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '한국어 (한국어)',
        'ja-JP': '日本語 (日본語)',
    };

    const timezoneOptions = [
        'UTC',
        // Asia
        'Asia/Seoul',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Hong_Kong',
        'Asia/Taipei',
        'Asia/Singapore',
        'Asia/Bangkok',
        'Asia/Kolkata',
        'Asia/Dubai',
        'Asia/Kuala_Lumpur',
        'Asia/Jakarta',
        'Asia/Manila',
        // Europe
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Europe/Madrid',
        'Europe/Rome',
        'Europe/Amsterdam',
        'Europe/Stockholm',
        'Europe/Istanbul',
        'Europe/Moscow',
        'Europe/Warsaw',
        'Europe/Zurich',
        // Americas
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'America/Toronto',
        'America/Vancouver',
        'America/Mexico_City',
        'America/Bogota',
        'America/Lima',
        'America/Sao_Paulo',
        'America/Argentina/Buenos_Aires',
        // Oceania
        'Australia/Sydney',
        'Australia/Melbourne',
        'Pacific/Auckland',
    ];

    const formatTzLabel = (tz: string) => {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset',
            }).formatToParts(new Date());
            const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
            return `${tz} (${offset})`;
        } catch {
            return tz;
        }
    };

    const timezoneOptionsWithLabel = timezoneOptions
        .map((tz) => ({ value: tz, label: formatTzLabel(tz) }))
        .sort((a, b) => a.label.localeCompare(b.label));

    useEffect(() => {
        if (open && isAuthenticated && workspaceId) {
            setLoading(true);
            setError(null);
            Promise.all([
                getWorkspace(workspaceId),
                getWorkspaceMemberProfile(workspaceId)
            ])
                .then(([wsData, memberData]) => {
                    setWorkspace(wsData);
                    setMember(memberData);

                    // Init Profile Form
                    setDisplayName(memberData.displayName || '');
                    setProfileLocale((memberData.preferredLocale as Locale) || 'en-US');
                    setProfileTimezone(memberData.timezone || 'UTC');
                })
                .catch((err) => {
                    setError((err as Error).message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, isAuthenticated, workspaceId]);

    // Show success message after locale change
    useEffect(() => {
        if (profileSaved) {
            setSuccessMessage(strings.settings.workspaceProfile?.updateSuccess || 'Profile updated successfully');
            setProfileSaved(false);
        }
    }, [strings, profileSaved]);

    const handleSave = async () => {
        if (!isAuthenticated || !workspaceId) return;
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            if (!displayName.trim()) {
                setError(strings.settings.workspaceProfile?.displayNameRequired || 'Display name is required');
                setLoading(false);
                return;
            }
            await updateWorkspaceMemberProfile(workspaceId, {
                displayName: displayName.trim(),
                timezone: profileTimezone,
                preferredLocale: profileLocale
            });

            // Apply the new locale immediately after saving
            setLocale(profileLocale);

            // Set flag to show success message after locale changes
            setProfileSaved(true);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const dialogTitle = strings.settings.workspaceProfile?.title?.replace('{workspaceName}', workspace?.name || '') || 'Workspace Profile';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 3, py: 2 }}>
                {dialogTitle}
            </DialogTitle>
            <DialogContent sx={{ p: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

                {loading && !workspace ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                {strings.settings.workspaceProfile?.workspaceSpecific || 'Workspace-only settings.'}{' '}
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => {
                                        onClose();
                                        // Navigate to global settings
                                        navigate('/settings');
                                    }}
                                    sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    {strings.settings.workspaceProfile?.globalAccountSettings || 'Change email/password in global account settings'}
                                </Link>
                            </Typography>
                        </Alert>

                        <Typography variant="h6" gutterBottom>
                            {strings.settings.workspaceProfile?.profileInfo || 'Profile Information'}
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid size={12}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                    <Avatar
                                        sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}
                                    >
                                        {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                                    </Avatar>
                                    <Button variant="outlined" size="small" disabled>
                                        {strings.settings.workspaceProfile?.changeAvatar || 'Change Avatar'}
                                    </Button>
                                </Box>
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label={strings.settings.workspaceProfile?.displayName || 'Display Name'}
                                    fullWidth
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    helperText={strings.settings.workspaceProfile?.displayNameHelper || 'How you appear to others in this workspace'}
                                    variant="outlined"
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel shrink>{strings.settings.workspaceProfile?.language || 'Language'}</InputLabel>
                                    <Select
                                        native
                                        value={profileLocale}
                                        label={strings.settings.workspaceProfile?.language || 'Language'}
                                        onChange={(e) => setProfileLocale(e.target.value as Locale)}
                                    >
                                        <option value="en-US">{languageOptions['en-US']}</option>
                                        <option value="ko-KR">{languageOptions['ko-KR']}</option>
                                        <option value="ja-JP">{languageOptions['ja-JP']}</option>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <FormControl fullWidth>
                                    <InputLabel shrink>{strings.settings.global?.timezone || 'Timezone'}</InputLabel>
                                    <Select
                                        native
                                        value={profileTimezone}
                                        label={strings.settings.global?.timezone || 'Timezone'}
                                        onChange={(e) => setProfileTimezone(e.target.value)}
                                    >
                                        {timezoneOptionsWithLabel.map((tz) => (
                                            <option key={tz.value} value={tz.value}>
                                                {tz.label}
                                            </option>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
                            <Button onClick={onClose}>
                                {strings.workspace.close || 'Close'}
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={loading}
                            >
                                {loading ? <CircularProgress size={24} /> : (strings.settings.workspaceProfile?.saveProfile || 'Save Profile')}
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default WorkspaceAccountSettingsDialog;
