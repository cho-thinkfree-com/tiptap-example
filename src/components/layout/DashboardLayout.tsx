import { useState, useEffect, useCallback } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Menu, MenuItem, Divider, useTheme, Avatar, ListItemIcon } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';

import { useNavigate, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaceMemberProfile, getWorkspace, type MembershipSummary, type WorkspaceSummary } from '../../lib/api';
import { useI18n, type Locale } from '../../lib/i18n';
import WorkspaceLanguageSync from '../common/WorkspaceLanguageSync';
import WorkspaceAccountSettingsDialog from '../workspace/WorkspaceAccountSettingsDialog';

const DashboardLayout = () => {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const { logout, user, isAuthenticated, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const [workspaceDisplayName, setWorkspaceDisplayName] = useState<string | null>(null);
    const [workspaceMember, setWorkspaceMember] = useState<MembershipSummary | null>(null);
    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [profileDialogOpen, setProfileDialogOpen] = useState(false);
    const { strings, locale, setLocale } = useI18n();


    // Fetch workspace data
    const fetchWorkspaceData = useCallback(() => {
        if (isAuthenticated && workspaceId) {
            getWorkspaceMemberProfile(workspaceId)
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

            getWorkspace(workspaceId)
                .then((ws) => {
                    setWorkspace(ws);
                })
                .catch(() => {
                    setWorkspace(null);
                });
        } else {
            setWorkspaceDisplayName(null);
            setWorkspaceMember(null);
            setWorkspace(null);
        }
    }, [isAuthenticated, workspaceId, locale, setLocale]);

    useEffect(() => {
        fetchWorkspaceData();
    }, [fetchWorkspaceData]);

    // Listen for workspace updates
    useEffect(() => {
        const handleWorkspaceUpdate = () => {
            fetchWorkspaceData();
        };

        window.addEventListener('workspace-updated', handleWorkspaceUpdate);
        return () => {
            window.removeEventListener('workspace-updated', handleWorkspaceUpdate);
        };
    }, [fetchWorkspaceData]);




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
                    <Box component="img" src="/odocs-logo-small.png" alt="ododocs logo" sx={{ height: 32, width: 'auto', mr: 2, cursor: 'pointer' }} onClick={() => navigate('/dashboard')} />
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        fontWeight="700"
                        sx={{
                            letterSpacing: '-0.02em',
                            cursor: 'pointer',
                        }}
                        onClick={() => navigate('/dashboard')}
                    >
                        {strings.layout.dashboard.ododocs}
                    </Typography>

                    {workspace && (
                        <>
                            <Typography variant="h6" sx={{ mx: 1, color: 'text.secondary' }}>
                                /
                            </Typography>
                            <Typography
                                variant="h6"
                                noWrap
                                component="div"
                                sx={{
                                    color: 'text.secondary',
                                    flexGrow: 1,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        color: 'text.primary',
                                    }
                                }}
                                onClick={() => navigate(`/workspace/${workspaceId}`)}
                            >
                                {workspace.name}
                            </Typography>
                        </>
                    )}

                    {!workspace && (
                        <Box sx={{ flexGrow: 1 }} />
                    )}

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
                            {/* Settings icon - opens account settings or workspace profile dialog */}
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleMenuClose();
                                    if (isWorkspaceContext) {
                                        // Open workspace account settings dialog
                                        setProfileDialogOpen(true);
                                    } else {
                                        navigate('/settings');
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

            {workspaceId && (
                <WorkspaceAccountSettingsDialog
                    open={profileDialogOpen}
                    onClose={() => setProfileDialogOpen(false)}
                    workspaceId={workspaceId}
                />
            )}
        </Box >
    );
};

export default DashboardLayout;
