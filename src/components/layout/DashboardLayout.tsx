import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Divider, useTheme, useMediaQuery, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, CircularProgress, Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate, useLocation, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaces, getWorkspaceMemberProfile, getWorkspace, updateWorkspace, updateAccount, updateWorkspaceMemberProfile, type WorkspaceSummary, type MembershipSummary } from '../../lib/api';
import { useI18n, type Locale } from '../../lib/i18n';
import WorkspaceLanguageSync from '../common/WorkspaceLanguageSync';

const DRAWER_WIDTH = 260;

const DashboardLayout = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [workspaceMenuAnchorEl, setWorkspaceMenuAnchorEl] = useState<null | HTMLElement>(null);
    const { logout, user, tokens, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [workspaceDisplayName, setWorkspaceDisplayName] = useState<string | null>(null);
    const [workspaceMember, setWorkspaceMember] = useState<MembershipSummary | null>(null);
    const [accountDialogOpen, setAccountDialogOpen] = useState(false);
    const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
    const [accountName, setAccountName] = useState('');
    const [accountLocale, setAccountLocale] = useState<Locale>('en-US');
    const [accountTimezone, setAccountTimezone] = useState('UTC');
    const [accountSaving, setAccountSaving] = useState(false);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [workspaceNameForm, setWorkspaceNameForm] = useState('');
    const [workspaceDescForm, setWorkspaceDescForm] = useState('');
    const [workspaceLocaleState, setWorkspaceLocaleState] = useState<Locale>('en-US');
    const [workspaceTimezoneState, setWorkspaceTimezoneState] = useState('UTC');
    const [workspaceSaving, setWorkspaceSaving] = useState(false);
    const [workspaceError, setWorkspaceError] = useState<string | null>(null);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const { strings } = useI18n();

    useEffect(() => {
        if (tokens) {
            getWorkspaces(tokens.accessToken).then(setWorkspaces).catch(console.error);
        }
    }, [tokens]);

    useEffect(() => {
        if (tokens && workspaceId) {
            getWorkspaceMemberProfile(workspaceId, tokens.accessToken)
                .then((profile) => {
                    setWorkspaceDisplayName(profile.displayName || null);
                    setWorkspaceMember(profile);
                    setWorkspaceLocaleState((profile.preferredLocale as Locale) || 'en-US');
                    setWorkspaceTimezoneState(profile.timezone || 'UTC');
                })
                .catch(() => {
                    setWorkspaceDisplayName(null);
                    setWorkspaceMember(null);
                });
        } else {
            setWorkspaceDisplayName(null);
            setWorkspaceMember(null);
        }
    }, [tokens, workspaceId]);

    const languageOptions = strings.settings.languageOptions ?? {
        'en-US': 'English (English)',
        'ko-KR': '?쒓뎅??(?쒓뎅??',
        'ja-JP': '?ζ쑍沃?(?ζ쑍沃?',
    };
    const accountLanguageLabelId = 'account-language-label';
    const accountTimezoneLabelId = 'account-timezone-label';
    const timezoneOptions = [
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

    const userDisplayName =
        (user?.legalName && user.legalName.trim().length > 0 && user.legalName.trim()) ||
        (user?.email ? user.email.split('@')[0] : '');
    const sidebarDisplayName = workspaceDisplayName?.trim() || userDisplayName;
    const sidebarAvatar = sidebarDisplayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase();

    const currentWorkspace = workspaces.find(w => w.id === workspaceId);
    const isPrivileged = workspaceMember?.role === 'owner' || workspaceMember?.role === 'admin';

    const openAccountDialog = () => {
        setAccountError(null);
        setAccountName(userDisplayName);
        setAccountLocale((user?.preferredLocale as Locale) || 'en-US');
        setAccountTimezone(user?.preferredTimezone || 'UTC');
        setAccountDialogOpen(true);
    };

    const openWorkspaceDialog = async () => {
        if (!tokens || !workspaceId) return;
        setWorkspaceError(null);
        setWorkspaceLoading(true);
        setWorkspaceDialogOpen(true);
        try {
            const [ws, member] = await Promise.all([
                getWorkspace(workspaceId, tokens.accessToken),
                getWorkspaceMemberProfile(workspaceId, tokens.accessToken),
            ]);
            setWorkspaceNameForm(ws.name);
            setWorkspaceDescForm(ws.description || '');
            const fallbackDisplay = member.displayName || userDisplayName;
            setWorkspaceDisplayName(fallbackDisplay || '');
            setWorkspaceMember(member);
            setWorkspaceLocaleState((member.preferredLocale as Locale) || 'en-US');
            setWorkspaceTimezoneState(member.timezone || 'UTC');
        } catch (err) {
            setWorkspaceError((err as Error).message);
        } finally {
            setWorkspaceLoading(false);
        }
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
                preferredLocale: accountLocale,
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

    const handleSaveWorkspace = async () => {
        if (!tokens || !workspaceId) return;
        setWorkspaceSaving(true);
        setWorkspaceError(null);
        try {
            const trimmedDisplay = workspaceDisplayName?.trim();
            const memberPayload: Record<string, unknown> = {
                preferredLocale: workspaceLocaleState,
                timezone: workspaceTimezoneState,
            };
            if (trimmedDisplay && trimmedDisplay.length > 0) {
                memberPayload.displayName = trimmedDisplay;
            }
            const memberUpdate = updateWorkspaceMemberProfile(workspaceId, tokens.accessToken, memberPayload);
            const workspaceUpdate = isPrivileged
                ? updateWorkspace(workspaceId, tokens.accessToken, {
                    name: workspaceNameForm.trim(),
                    description: workspaceDescForm.trim(),
                })
                : Promise.resolve();
            await Promise.all([memberUpdate, workspaceUpdate]);
            setWorkspaceDialogOpen(false);
            getWorkspaces(tokens.accessToken).then(setWorkspaces).catch(console.error);
        } catch (err) {
            setWorkspaceError((err as Error).message);
        } finally {
            setWorkspaceSaving(false);
        }
    };

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleWorkspaceMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setWorkspaceMenuAnchorEl(event.currentTarget);
    };

    const handleWorkspaceMenuClose = () => {
        setWorkspaceMenuAnchorEl(null);
    };

    const handleLogout = () => {
        handleMenuClose();
        logout();
        navigate('/login');
    };

    const menuItems: { text: string; icon: React.ReactNode; path: string }[] = [];

    const brandingContent = (
        <Box sx={{ p: 3 }}>
            {currentWorkspace ? (
                <>
                    <ListItemButton
                        onClick={handleWorkspaceMenuOpen}
                        sx={{
                            px: 1,
                            borderRadius: 1,
                            '&:hover': { bgcolor: 'action.hover' }
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
                            <Avatar
                                variant="rounded"
                                sx={{
                                    width: 32,
                                    height: 32,
                                    bgcolor: 'primary.main',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                {currentWorkspace.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle1" fontWeight="bold" noWrap>
                                    {currentWorkspace.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                    {strings.layout.dashboard.workspace}
                                </Typography>
                            </Box>
                            <ExpandMoreIcon color="action" />
                        </Box>
                    </ListItemButton>
                    <Menu
                        anchorEl={workspaceMenuAnchorEl}
                        open={Boolean(workspaceMenuAnchorEl)}
                        onClose={handleWorkspaceMenuClose}
                        PaperProps={{ sx: { width: 240, mt: 1 } }}
                    >
                        <MenuItem onClick={() => { navigate('/dashboard'); handleWorkspaceMenuClose(); }}>
                            <ListItemIcon><DashboardIcon fontSize="small" /></ListItemIcon>
                            <ListItemText primary={strings.layout.dashboard.allWorkspaces} />
                        </MenuItem>
                        <Divider />
                        {workspaces.map(ws => (
                            <MenuItem
                                key={ws.id}
                                selected={ws.id === workspaceId}
                                onClick={() => { navigate(`/workspace/${ws.id}`); handleWorkspaceMenuClose(); }}
                            >
                                <ListItemText primary={ws.name} />
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            ) : (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 1,
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.8 }
                    }}
                    onClick={() => navigate('/dashboard')}
                >
                    <Box component="img" src="/logo.png" alt="ododocs logo" sx={{ height: 32, width: 'auto' }} />
                    <Typography variant="h6" fontWeight="bold">
                        {strings.layout.dashboard.ododocs}
                    </Typography>
                </Box>
            )}
        </Box>
    );

    const drawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {brandingContent}

            <List sx={{ px: 2, flex: 1 }}>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                        <ListItemButton
                            selected={location.pathname === item.path}
                            onClick={() => {
                                navigate(item.path);
                                if (isMobile) setMobileOpen(false);
                            }}
                            sx={{
                                borderRadius: 2,
                                '&.Mui-selected': {
                                    bgcolor: 'action.selected',
                                    color: 'primary.main',
                                    '& .MuiListItemIcon-root': {
                                        color: 'primary.main',
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={item.text}
                                primaryTypographyProps={{ fontWeight: 500 }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ p: 2 }}>
                <ListItemButton
                    onClick={handleMenuOpen}
                    sx={{
                        borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                            {sidebarAvatar}
                        </Avatar>
                    </ListItemIcon>
                    <ListItemText
                        primary={sidebarDisplayName}
                        secondary={workspaceId ? strings.layout.dashboard.workspaceSettingsLabel : strings.layout.dashboard.accountSettingsLabel}
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                        secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary', noWrap: true }}
                    />
                </ListItemButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <MenuItem onClick={() => { handleMenuClose(); openAccountDialog(); }}>
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        {strings.layout.dashboard.accountSettingsLabel}
                    </MenuItem>
                    {workspaceId && (
                        <MenuItem onClick={() => { handleMenuClose(); openWorkspaceDialog(); }}>
                            <ListItemIcon>
                                <DashboardIcon fontSize="small" />
                            </ListItemIcon>
                            {strings.layout.dashboard.workspaceSettingsLabel}
                        </MenuItem>
                    )}
                    <MenuItem onClick={() => { handleMenuClose(); handleLogout(); }}>
                        <ListItemIcon>
                            <LogoutIcon fontSize="small" />
                        </ListItemIcon>
                        {strings.layout.dashboard.logout}
                    </MenuItem>
                </Menu>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            <WorkspaceLanguageSync />
            <AppBar
                position="fixed"
                sx={{
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { md: `${DRAWER_WIDTH}px` },
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    boxShadow: 'none',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    display: { md: 'none' } // Hide on desktop as we have sidebar
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        fontWeight="700"
                        sx={{
                            letterSpacing: '-0.02em',
                            cursor: !currentWorkspace ? 'pointer' : 'default'
                        }}
                        onClick={() => !currentWorkspace && navigate('/dashboard')}
                    >
                        {currentWorkspace ? currentWorkspace.name : strings.layout.dashboard.ododocs}
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box
                component="nav"
                sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
                    }}
                >
                    {drawerContent}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
                    }}
                    open
                >
                    {drawerContent}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    mt: { xs: 8, md: 0 },
                }}
            >
                <Outlet />
            </Box>

            <Dialog open={accountDialogOpen} onClose={() => setAccountDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{strings.layout.dashboard.accountSettingsLabel}</DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
                    {accountError && <Alert severity="error">{accountError}</Alert>}
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

            <Dialog open={workspaceDialogOpen} onClose={() => setWorkspaceDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{strings.layout.dashboard.workspaceSettingsLabel}</DialogTitle>
                <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
                    {workspaceError && <Alert severity="error">{workspaceError}</Alert>}
                    {workspaceLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <TextField
                                label={strings.workspace.createWorkspacePlaceholder}
                                value={workspaceNameForm}
                                onChange={(e) => setWorkspaceNameForm(e.target.value)}
                                fullWidth
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                                margin="dense"
                                disabled={!isPrivileged}
                            />
                            <TextField
                                label={strings.workspace.descriptionLabel}
                                value={workspaceDescForm}
                                onChange={(e) => setWorkspaceDescForm(e.target.value)}
                                fullWidth
                                multiline
                                minRows={3}
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                                margin="dense"
                                disabled={!isPrivileged}
                            />
                            <TextField
                                label={strings.settings.workspaceProfile.displayName}
                                value={workspaceDisplayName || ''}
                                onChange={(e) => setWorkspaceDisplayName(e.target.value)}
                                fullWidth
                                variant="outlined"
                                InputLabelProps={{ shrink: true }}
                                margin="dense"
                            />
                            <FormControl fullWidth margin="dense" variant="outlined" size="small">
                                <InputLabel shrink>{strings.settings.workspaceProfile.language}</InputLabel>
                                <Select
                                    native
                                    value={workspaceLocaleState}
                                    onChange={(e) => setWorkspaceLocaleState(e.target.value as Locale)}
                                >
                                    <option value="en-US">{languageOptions['en-US']}</option>
                                    <option value="ko-KR">{languageOptions['ko-KR']}</option>
                                    <option value="ja-JP">{languageOptions['ja-JP']}</option>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth margin="dense" variant="outlined" size="small">
                                <InputLabel shrink>{strings.settings.global.timezone}</InputLabel>
                                <Select
                                    native
                                    value={workspaceTimezoneState}
                                    onChange={(e) => setWorkspaceTimezoneState(e.target.value)}
                                >
                                    {timezoneOptionsWithLabel.map((tz) => (
                                        <option key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </option>
                                    ))}
                                </Select>
                            </FormControl>
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setWorkspaceDialogOpen(false)} disabled={workspaceSaving}>
                        {strings.dashboard.createWorkspaceDialogCancel}
                    </Button>
                    <Button onClick={handleSaveWorkspace} disabled={workspaceSaving || workspaceLoading} variant="contained">
                        {workspaceSaving ? <CircularProgress size={18} /> : strings.workspace.updateButton}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DashboardLayout;

