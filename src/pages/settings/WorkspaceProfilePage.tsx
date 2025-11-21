import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Avatar,
    FormControl,
    InputLabel,
    Select,
    Paper,
    Grid,
    Link
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';
import { getWorkspaceMemberProfile, updateWorkspaceMemberProfile, getWorkspace } from '../../lib/api';

const WorkspaceProfilePage = () => {
    const { user, tokens } = useAuth();
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const navigate = useNavigate();
    const { strings, locale, setLocale } = useI18n();

    // Workspace Profile State
    const [workspaceName, setWorkspaceName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [displayNameError, setDisplayNameError] = useState<string | null>(null);
    const [workspaceTimezone, setWorkspaceTimezone] = useState('UTC');
    const [workspaceLocale, setWorkspaceLocale] = useState('en-US');

    // UI State
    const [loading, setLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (workspaceId && tokens) {
            setProfileLoading(true);
            Promise.all([
                getWorkspaceMemberProfile(workspaceId, tokens.accessToken),
                getWorkspace(workspaceId, tokens.accessToken)
            ])
                .then(([profile, workspace]) => {
                    setDisplayName(profile.displayName || '');
                    setWorkspaceTimezone(profile.timezone || 'UTC');
                    setWorkspaceLocale(profile.preferredLocale || 'en-US');
                    setWorkspaceName(workspace.name);
                })
                .catch(err => {
                    console.error('Failed to load workspace profile', err);
                    setError(strings.settings.workspaceProfile.loadError);
                })
                .finally(() => setProfileLoading(false));
        }
    }, [workspaceId, tokens, locale, strings.settings.workspaceProfile.loadError]);

    const handleSave = async () => {
        if (!tokens || !workspaceId) return;
        setLoading(true);
        setError(null);
        setSuccess(null);
        setDisplayNameError(null);

        try {
            if (!displayName.trim()) {
                setDisplayNameError(strings.settings.workspaceProfile.displayNameRequired);
                setLoading(false);
                return;
            }
            await updateWorkspaceMemberProfile(workspaceId, tokens.accessToken, {
                displayName: displayName.trim(),
                timezone: workspaceTimezone,
                preferredLocale: workspaceLocale
            });

            // Apply the new locale immediately after saving so the UI mirrors the selection
            setLocale(workspaceLocale as Locale);

            setSuccess(strings.settings.workspaceProfile.updateSuccess);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (profileLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    const subtitle = strings.settings.workspaceProfile.subtitle.replace('{workspaceName}', workspaceName)

    const languageOptions = strings.settings.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '한국어 (한국어)',
        'ja-JP': '日本語 (日本語)',
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

    return (
        <Container maxWidth="md">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="h4" fontWeight="bold">
                    {strings.settings.workspaceProfile.title.replace('{workspaceName}', workspaceName)}
                </Typography>
                {workspaceId && (
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate(`/workspace/${workspaceId}`)}
                    >
                        {strings.workspace.backToFiles}
                    </Button>
                )}
            </Box>
            {subtitle.trim() && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {subtitle}
                </Typography>
            )}

            <Paper sx={{ p: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

                <Alert severity="info" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2">
                        {strings.settings.workspaceProfile.workspaceSpecific}{' '}
                        <Link
                            component="button"
                            variant="body2"
                            onClick={() => navigate('/settings')}
                            sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {strings.settings.workspaceProfile.globalAccountSettings}
                        </Link>
                    </Typography>
                </Alert>

                <Typography variant="h6" gutterBottom>{strings.settings.workspaceProfile.profileInfo}</Typography>

                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Avatar
                                sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem' }}
                            >
                                {displayName ? displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                            </Avatar>
                            <Button variant="outlined" size="small">
                                {strings.settings.workspaceProfile.changeAvatar}
                            </Button>
                        </Box>
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label={strings.settings.workspaceProfile.displayName}
                            fullWidth
                            value={displayName}
                            onChange={(e) => { setDisplayName(e.target.value); setDisplayNameError(null); }}
                            helperText={displayNameError ?? strings.settings.workspaceProfile.displayNameHelper}
                            error={Boolean(displayNameError)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                            <InputLabel shrink>{strings.settings.workspaceProfile.language}</InputLabel>
                            <Select
                                native
                                value={workspaceLocale}
                                label={strings.settings.workspaceProfile.language}
                                onChange={(e) => setWorkspaceLocale(e.target.value)}
                            >
                                <option value="en-US">{languageOptions['en-US']}</option>
                                <option value="ko-KR">{languageOptions['ko-KR']}</option>
                                <option value="ja-JP">{languageOptions['ja-JP']}</option>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                            <InputLabel shrink>{strings.settings.global.timezone}</InputLabel>
                            <Select
                                native
                                value={workspaceTimezone}
                                label={strings.settings.global.timezone}
                                onChange={(e) => setWorkspaceTimezone(e.target.value)}
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

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : strings.settings.workspaceProfile.saveProfile}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default WorkspaceProfilePage;
