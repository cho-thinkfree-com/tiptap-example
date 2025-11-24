import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Divider,
    Typography,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    CircularProgress,
    Alert,
    useTheme
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Locale } from '../../lib/i18n';
import {
    getWorkspace,
    getWorkspaceMemberProfile,
    updateWorkspace,
    updateWorkspaceMemberProfile,
    type WorkspaceSummary,
    type MembershipSummary
} from '../../lib/api';

interface WorkspaceSettingsDialogProps {
    open: boolean;
    onClose: () => void;
    workspaceId: string;
}

type Tab = 'general' | 'profile';

const WorkspaceSettingsDialog = ({ open, onClose, workspaceId }: WorkspaceSettingsDialogProps) => {
    const { tokens } = useAuth();
    const { strings, locale } = useI18n();
    const theme = useTheme();

    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Data
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [member, setMember] = useState<MembershipSummary | null>(null);

    // Form States - General
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDesc, setWorkspaceDesc] = useState('');

    // Form States - Profile
    const [displayName, setDisplayName] = useState('');
    const [profileLocale, setProfileLocale] = useState<Locale>('en-US');
    const [profileTimezone, setProfileTimezone] = useState('');

    const isPrivileged = member?.role === 'owner' || member?.role === 'admin';

    // Options
    const languageOptions = {
        'en-US': 'English',
        'ko-KR': '한국어',
        'ja-JP': '日本語',
    };

    const timezoneOptionsWithLabel = [
        { value: 'UTC', label: 'UTC' },
        { value: 'Asia/Seoul', label: 'Seoul (KST)' },
        { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
        { value: 'America/New_York', label: 'New York (EST/EDT)' },
        { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
        { value: 'Europe/London', label: 'London (GMT/BST)' },
    ];

    useEffect(() => {
        if (open && tokens && workspaceId) {
            setLoading(true);
            setError(null);
            Promise.all([
                getWorkspace(workspaceId, tokens.accessToken),
                getWorkspaceMemberProfile(workspaceId, tokens.accessToken)
            ])
                .then(([wsData, memberData]) => {
                    setWorkspace(wsData);
                    setMember(memberData);

                    // Init General Form
                    setWorkspaceName(wsData.name);
                    setWorkspaceDesc(wsData.description || '');

                    // Init Profile Form
                    setDisplayName(memberData.name);
                    setProfileLocale((memberData.locale as Locale) || 'en-US');
                    setProfileTimezone(memberData.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                })
                .catch((err) => {
                    setError((err as Error).message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, tokens, workspaceId]);

    const handleSaveGeneral = async () => {
        if (!tokens || !workspaceId) return;
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const updated = await updateWorkspace(workspaceId, tokens.accessToken, {
                name: workspaceName,
                description: workspaceDesc,
            });
            setWorkspace(updated);
            setSuccessMessage(strings.workspace.updateSuccess || 'Workspace updated successfully');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!tokens || !workspaceId) return;
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const updated = await updateWorkspaceMemberProfile(workspaceId, tokens.accessToken, {
                name: displayName,
                locale: profileLocale,
                timezone: profileTimezone,
            });
            setMember(updated);
            setSuccessMessage(strings.workspace.profileUpdateSuccess || 'Profile updated successfully');

            // If the updated locale is different from current app locale, we might want to reload or notify
            // But for now, just saving is enough. The app might need a reload to reflect locale change fully if it relies on this setting immediately.
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const renderGeneralTab = () => (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
                {strings.layout.dashboard.workspace || 'Workspace'}
            </Typography>
            <TextField
                label={strings.workspace.createWorkspacePlaceholder}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                disabled={!isPrivileged}
            />
            <TextField
                label={strings.workspace.descriptionLabel}
                value={workspaceDesc}
                onChange={(e) => setWorkspaceDesc(e.target.value)}
                fullWidth
                multiline
                minRows={3}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                disabled={!isPrivileged}
            />
            {!isPrivileged && (
                <Alert severity="info" sx={{ mt: 1 }}>
                    {strings.workspace.adminOnly || 'Only admins can edit workspace settings.'}
                </Alert>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                    variant="contained"
                    onClick={handleSaveGeneral}
                    disabled={loading || !isPrivileged}
                >
                    {loading ? <CircularProgress size={24} /> : strings.workspace.updateButton}
                </Button>
            </Box>
        </Box>
    );

    const renderProfileTab = () => (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h6" gutterBottom>
                {strings.workspace.profileTitle || 'Profile'}
            </Typography>
            <TextField
                label={strings.settings.workspaceProfile.displayName}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="workspace-language">{strings.settings.workspaceProfile.language}</InputLabel>
                <Select
                    native
                    labelId="workspace-language"
                    label={strings.settings.workspaceProfile.language}
                    value={profileLocale}
                    onChange={(e) => setProfileLocale(e.target.value as Locale)}
                >
                    <option value="en-US">{languageOptions['en-US']}</option>
                    <option value="ko-KR">{languageOptions['ko-KR']}</option>
                    <option value="ja-JP">{languageOptions['ja-JP']}</option>
                </Select>
            </FormControl>
            <FormControl fullWidth variant="outlined" size="small">
                <InputLabel id="workspace-timezone">{strings.settings.global.timezone}</InputLabel>
                <Select
                    native
                    labelId="workspace-timezone"
                    label={strings.settings.global.timezone}
                    value={profileTimezone}
                    onChange={(e) => setProfileTimezone(e.target.value)}
                >
                    {timezoneOptionsWithLabel.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                            {tz.label}
                        </option>
                    ))}
                </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                    variant="contained"
                    onClick={handleSaveProfile}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : strings.settings.global.saveChanges}
                </Button>
            </Box>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 3, py: 2 }}>
                {strings.layout.dashboard.workspaceSettingsLabel}
            </DialogTitle>
            <DialogContent sx={{ p: 0, display: 'flex', height: '500px' }}>
                {/* Sidebar */}
                <Box sx={{ width: '240px', borderRight: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default' }}>
                    <List component="nav" sx={{ pt: 2 }}>
                        <ListItem disablePadding>
                            <ListItemButton
                                selected={activeTab === 'general'}
                                onClick={() => setActiveTab('general')}
                            >
                                <ListItemText primary={strings.layout.dashboard.workspace || 'Workspace'} />
                            </ListItemButton>
                        </ListItem>
                        <ListItem disablePadding>
                            <ListItemButton
                                selected={activeTab === 'profile'}
                                onClick={() => setActiveTab('profile')}
                            >
                                <ListItemText primary={strings.workspace.profileTitle || 'Profile'} />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

                    {loading && !workspace ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        activeTab === 'general' ? renderGeneralTab() : renderProfileTab()
                    )}
                </Box>
            </DialogContent>
            <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={onClose}>
                    {strings.workspace.close || 'Close'}
                </Button>
            </Box>
        </Dialog >
    );
};

export default WorkspaceSettingsDialog;
