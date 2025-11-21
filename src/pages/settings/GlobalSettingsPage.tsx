import { useState, useEffect } from 'react';
import {
    Container,
    Typography,
    Box,
    TextField,
    Button,
    Alert,
    CircularProgress,
    Divider,
    FormControl,
    InputLabel,
    Select,
    Paper,
    Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';
import { updateAccount } from '../../lib/api';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { useNavigate } from 'react-router-dom';

const GlobalSettingsPage = () => {
    const { user, tokens, refreshProfile } = useAuth();
    const { strings } = useI18n();
    const navigate = useNavigate();

    // Account State
    const [email, setEmail] = useState('');
    const [legalName, setLegalName] = useState('');
    const [preferredLocale, setPreferredLocale] = useState('en-US');
    const [preferredTimezone, setPreferredTimezone] = useState('UTC');
    const [legalNameError, setLegalNameError] = useState<string | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    useEffect(() => {
        if (user) {
            setEmail(user.email);
            setLegalName(user.legalName || '');
            setPreferredLocale(user.preferredLocale || 'en-US');
            setPreferredTimezone(user.preferredTimezone || 'UTC');
        }
    }, [user]);

    const handleSave = async () => {
        if (!tokens) return;
        setLoading(true);
        setError(null);
        setSuccess(false);
        setLegalNameError(null);

        try {
            const trimmedName = legalName.trim();
            if (!trimmedName) {
                setLegalNameError(strings.settings.global.legalNameRequired);
                setLoading(false);
                return;
            }
            const updates: any = {
                legalName: trimmedName,
                preferredLocale,
                preferredTimezone
            };

            await updateAccount(tokens.accessToken, updates);
            await refreshProfile(); // Refresh global user data
            setSuccess(true);
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

    const languageOptions = strings.settings.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '?�국??(?�국??',
        'ja-JP': '?�本�?(?�本�?',
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
                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ mb: 0 }}>
                    {strings.settings.global.title}
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/dashboard')}
                >
                    {strings.settings.global.backToDashboard}
                </Button>
            </Box>

            <Paper sx={{ p: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 3 }}>{strings.settings.global.updateSuccess}</Alert>}

                <Typography variant="h6" gutterBottom>{strings.settings.global.personalInfo}</Typography>

                <Grid container spacing={3}>
                    <Grid size={12}>
                        <TextField
                            label={strings.settings.global.legalName}
                            fullWidth
                            value={legalName}
                            onChange={(e) => {
                                setLegalName(e.target.value);
                                setLegalNameError(null);
                            }}
                            error={Boolean(legalNameError)}
                            helperText={legalNameError ?? undefined}
                        />
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label={strings.settings.global.email}
                            fullWidth
                            value={email}
                            disabled
                            helperText="Email cannot be changed"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth>
                            <InputLabel shrink>{strings.settings.global.preferredLanguage}</InputLabel>
                            <Select
                                native
                                value={preferredLocale}
                                label={strings.settings.global.preferredLanguage}
                                onChange={(e) => setPreferredLocale(e.target.value)}
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
                                value={preferredTimezone}
                                label={strings.settings.global.timezone}
                                onChange={(e) => setPreferredTimezone(e.target.value)}
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

                <Divider sx={{ my: 4 }} />

                <Typography variant="h6" gutterBottom>{strings.settings.global.security}</Typography>

                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {strings.settings.global.password}
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => setIsPasswordDialogOpen(true)}
                            >
                                {strings.settings.global.changePassword}
                            </Button>
                        </Box>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? <CircularProgress size={24} /> : strings.settings.global.saveChanges}
                    </Button>
                </Box>
            </Paper>

            <ChangePasswordDialog
                open={isPasswordDialogOpen}
                onClose={() => setIsPasswordDialogOpen(false)}
            />
        </Container>
    );
};

export default GlobalSettingsPage;



