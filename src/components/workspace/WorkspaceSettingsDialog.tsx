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
    initialTab?: Tab;
    onWorkspaceUpdated?: () => void;
}

type Tab = 'general' | 'subscription';

const WorkspaceSettingsDialog = ({ open, onClose, workspaceId, initialTab = 'general', onWorkspaceUpdated }: WorkspaceSettingsDialogProps) => {
    const { isAuthenticated } = useAuth();
    const { strings } = useI18n();
    const theme = useTheme();

    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Data
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [member, setMember] = useState<MembershipSummary | null>(null);

    // Form States - General
    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceDesc, setWorkspaceDesc] = useState('');



    const isPrivileged = member?.role === 'owner' || member?.role === 'admin';



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

                    // Init General Form
                    setWorkspaceName(wsData.name);
                    setWorkspaceDesc(wsData.description || '');
                })
                .catch((err) => {
                    setError((err as Error).message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [open, isAuthenticated, workspaceId]);

    const handleSaveGeneral = async () => {
        if (!isAuthenticated || !workspaceId) return;
        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const updated = await updateWorkspace(workspaceId, {
                name: workspaceName,
                description: workspaceDesc,
            });
            setWorkspace(updated);
            setSuccessMessage(strings.workspace.updateSuccess || 'Workspace updated successfully');

            // Notify parent component that workspace was updated
            if (onWorkspaceUpdated) {
                onWorkspaceUpdated();
            }
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



    const renderSubscriptionTab = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 2 }}>
            <Typography variant="h5" color="text.secondary">
                Coming Soon
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Subscription management features will be available soon.
            </Typography>
        </Box>
    );


    const dialogTitle = strings.layout.dashboard.workspaceSettingsLabel || 'Workspace Settings';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 3, py: 2 }}>
                {dialogTitle}
            </DialogTitle>
            <DialogContent sx={{ p: 0, display: 'flex', height: '500px' }}>
                {/* Sidebar - only show for workspace settings */}
                {/* Sidebar */}
                {(
                    <Box sx={{ width: '240px', borderRight: `1px solid ${theme.palette.divider}`, bgcolor: 'background.default' }}>
                        <List component="nav" sx={{ pt: 2 }}>
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'general'}
                                    onClick={() => setActiveTab('general')}
                                >
                                    <ListItemText primary="General" />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'subscription'}
                                    onClick={() => setActiveTab('subscription')}
                                >
                                    <ListItemText primary="Subscription" />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </Box>
                )}

                {/* Content */}
                <Box sx={{ flex: 1, p: 3, overflowY: 'auto' }}>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

                    {loading && !workspace ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        activeTab === 'general' ? renderGeneralTab() : renderSubscriptionTab()
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
