import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Menu, MenuItem, Divider, useTheme, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, CircularProgress, Alert, InputAdornment, Avatar, ListItemIcon } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaceMemberProfile, updateAccount, type MembershipSummary } from '../../lib/api';
import { useI18n, type Locale } from '../../lib/i18n';
import WorkspaceLanguageSync from '../common/WorkspaceLanguageSync';
import { ChangePasswordDialog } from '../../pages/settings/ChangePasswordDialog';
import WorkspaceSettingsDialog from '../workspace/WorkspaceSettingsDialog';

const DashboardLayout = () => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { logout, user, tokens, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const [workspaceDisplayName, setWorkspaceDisplayName] = useState<string | null>(null);
    const [workspaceMember, setWorkspaceMember] = useState<MembershipSummary | null>(null);
    const [accountDialogOpen, setAccountDialogOpen] = useState(false);
    const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [accountLocale, setAccountLocale] = useState<Locale>('en-US');
    const [accountTimezone, setAccountTimezone] = useState('UTC');
    const [accountSaving, setAccountSaving] = useState(false);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const { strings, locale, setLocale } = useI18n();

    useEffect(() => {
        if (tokens && workspaceId) {
            getWorkspaceMemberProfile(workspaceId, tokens.accessToken)
                .then((profile) => {
                    setWorkspaceDisplayName(profile.displayName || null);
                    setWorkspaceMember(profile);
                    if (profile.preferredLocale && profile.preferredLocale !== locale) {
                        setLocale(profile.preferredLocale as Locale);
                    }
                })
                .catch(() => {
                    setWorkspaceDisplayName(null);
                    setWorkspaceMember(null);
                });
        } else {
            setWorkspaceDisplayName(null);
            setWorkspaceMember(null);
        }
    }, [tokens, workspaceId, locale, setLocale]);

    const languageOptions = strings.settings.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '한국어(한국어)',
        'ja-JP': '日本語(日本語)',
    };
    const accountLanguageLabelId = 'account-language-label';
    const accountTimezoneLabelId = 'account-timezone-label';
    const defaultTimezoneOptions = [
        'UTC',
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
        'Australia/Sydney',
        'Australia/Melbourne',
        'Pacific/Auckland',
    ];
    const timezoneOptions =
        typeof (Intl as any).supportedValuesOf === 'function'
            ? ((Intl as any).supportedValuesOf('timeZone') as string[])
            : defaultTimezoneOptions;
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
    const getOffsetMinutes = (tz: string) => {
        try {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset',
            }).formatToParts(new Date());
            const offsetRaw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
            const match = offsetRaw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
            if (!match) return 0;
            const sign = match[1] === '-' ? -1 : 1;
            const hours = parseInt(match[2], 10);
            const minutes = match[3] ? parseInt(match[3], 10) : 0;
            return sign * (hours * 60 + minutes);
        } catch {
            return 0;
        }
    };
    const timezoneOptionsWithLabel = timezoneOptions
        .map((tz) => ({
            value: tz,
            label: formatTzLabel(tz),
            offsetMinutes: getOffsetMinutes(tz),
        }))
        .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label));

    const userDisplayName =
        (user?.legalName && user.legalName.trim().length > 0 && user.legalName.trim()) ||
        (user?.email ? user.email.split('@')[0] : '');

    const isWorkspaceContext = !!workspaceId;
    // const currentWorkspace = workspaces.find(w => w.id === workspaceId); // Removed unused


    // Profile Display Logic
    const profileName = isWorkspaceContext
        ? (workspaceDisplayName?.trim() || userDisplayName)
        : userDisplayName;
    const profileEmail = isWorkspaceContext ? null : user?.email;
    const profileAvatarChar = profileName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase();

    const openAccountDialog = () => {
        setAccountError(null);
        setAccountName(userDisplayName);
        setAccountLocale((user?.preferredLocale as Locale) || 'en-US');
        setAccountTimezone(user?.preferredTimezone || 'UTC');
        setAccountDialogOpen(true);
    };

    const openWorkspaceDialog = () => {
        if (!workspaceId) return;
        setWorkspaceDialogOpen(true);
    };

    const handleSaveAccount = async () => {
        if (!tokens) return;
        setAccountSaving(true);
        setAccountError(null);
        try {
            const trimmedName = accountName.trim();
            if (!trimmedName) {
                setAccountError(strings.settings.global.legalNameRequired);
                setAccountSaving(false);
                return;
            }
            await updateAccount(tokens.accessToken, {
                legalName: trimmedName,
                preferredLanguage: accountLocale,
                preferredTimezone: accountTimezone,
            });
            await refreshProfile();
            setAccountDialogOpen(false);
        } catch (err) {
            setAccountError((err as Error).message);
        } finally {
            setAccountSaving(false);
        }
    };



    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        await logout();
        // Navigation is handled by ProtectedRoute based on manual-logout flag
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', flexDirection: 'column' }}>
            <WorkspaceLanguageSync />
            <AppBar
                position="fixed"
                sx={{
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    boxShadow: 'none',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                }}
            >
                <Toolbar>
                    <Box component="img" src="/logo.png" alt="ododocs logo" sx={{ height: 32, width: 'auto', mr: 2, cursor: 'pointer' }} onClick={() => navigate('/dashboard')} />
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        fontWeight="700"
                        sx={{
                            letterSpacing: '-0.02em',
                            cursor: 'pointer',
                            flexGrow: 1
                        }}
                        onClick={() => navigate('/dashboard')}
                    >
                        {strings.layout.dashboard.ododocs}
                    </Typography>

                    <IconButton
                        onClick={handleMenuOpen}
                        sx={{
                            p: 0,
                            border: `1px solid ${theme.palette.divider}`,
                            ml: 2
                        }}
                    >
                        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>
                            {profileAvatarChar}
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        onClick={handleMenuClose}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                overflow: 'visible',
                                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                mt: 1.5,
                                width: 240,
                                '& .MuiAvatar-root': {
                                    width: 32,
                                    height: 32,
                                    ml: -0.5,
                                    mr: 1,
                                },
                            },
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ overflow: 'hidden', mr: 1 }}>
                                <Typography variant="subtitle2" noWrap fontWeight="bold">
                                    {profileName}
                                </Typography>
                                {profileEmail && (
                                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                                        {profileEmail}
                                    </Typography>
                                )}
                            </Box>
                            {/* Settings icon always shown, opens appropriate dialog */}
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleMenuClose();
                                    if (isWorkspaceContext) {
                                        openWorkspaceDialog();
                                    } else {
                                        openAccountDialog();
                                    }
                                }}
                            >
                                <SettingsIcon fontSize="small" />
                            </IconButton>
                        </Box>
                        <Divider />

                        {isWorkspaceContext && (
                            <MenuItem onClick={() => navigate('/dashboard')}>
                                <ListItemIcon>
                                    <DashboardIcon fontSize="small" />
                                </ListItemIcon>
                                {strings.layout.dashboard.allWorkspaces}
                            </MenuItem>
                        )}



                        <Divider />

                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            {strings.layout.dashboard.logout}
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    mt: 8, // AppBar height
                    width: '100%',
                }}
            >
                <Outlet />
            </Box>

            <Dialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{strings.layout.dashboard.accountSettingsLabel}</DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
                    {accountError && <Alert severity="error">{accountError}</Alert>}
                    <TextField
                        label="Email"
                        value={user?.email || ''}
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        margin="dense"
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <LockIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TextField
                        label={strings.settings.global.legalName}
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        fullWidth
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        margin="dense"
                    />
                    <FormControl fullWidth margin="dense" variant="outlined" size="small">
                        <InputLabel id={accountLanguageLabelId}>{strings.settings.global.preferredLanguage}</InputLabel>
                        <Select
                            native
                            labelId={accountLanguageLabelId}
                            label={strings.settings.global.preferredLanguage}
                            value={accountLocale}
                            onChange={(e) => setAccountLocale(e.target.value as Locale)}
                        >
                            <option value="en-US">{languageOptions['en-US']}</option>
                            <option value="ko-KR">{languageOptions['ko-KR']}</option>
                            <option value="ja-JP">{languageOptions['ja-JP']}</option>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth margin="dense" variant="outlined" size="small">
                        <InputLabel id={accountTimezoneLabelId}>{strings.settings.global.timezone}</InputLabel>
                        <Select
                            native
                            labelId={accountTimezoneLabelId}
                            label={strings.settings.global.timezone}
                            value={accountTimezone}
                            onChange={(e) => setAccountTimezone(e.target.value)}
                        >
                            {timezoneOptionsWithLabel.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </Select>
                    </FormControl>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            {strings.settings.global.security}
                        </Typography>
                        <Button onClick={() => setIsPasswordDialogOpen(true)} variant="outlined" size="small">
                            {strings.settings.global.changePassword}
                        </Button>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAccountDialogOpen(false)} disabled={accountSaving}>
                        {strings.dashboard.createWorkspaceDialogCancel}
                    </Button>
                    <Button onClick={handleSaveAccount} disabled={accountSaving} variant="contained">
                        {accountSaving ? <CircularProgress size={18} /> : strings.settings.global.saveChanges}
                    </Button>
                </DialogActions>
            </Dialog>
            {workspaceId && (
                <WorkspaceSettingsDialog
                    open={workspaceDialogOpen}
                    onClose={() => setWorkspaceDialogOpen(false)}
                    workspaceId={workspaceId}
                />
            )}
            <ChangePasswordDialog open={isPasswordDialogOpen} onClose={() => setIsPasswordDialogOpen(false)} />
        </Box >
    );
};

export default DashboardLayout;
