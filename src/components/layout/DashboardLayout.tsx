import { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Divider, useTheme, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useNavigate, useLocation, Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaces, getWorkspaceMemberProfile, type WorkspaceSummary } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import WorkspaceLanguageSync from '../common/WorkspaceLanguageSync';

const DRAWER_WIDTH = 260;

const DashboardLayout = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [workspaceMenuAnchorEl, setWorkspaceMenuAnchorEl] = useState<null | HTMLElement>(null);
    const { logout, user, tokens } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
    const [workspaceDisplayName, setWorkspaceDisplayName] = useState<string | null>(null);
    const { strings } = useI18n();

    useEffect(() => {
        if (tokens) {
            getWorkspaces(tokens.accessToken).then(setWorkspaces).catch(console.error);
        }
    }, [tokens]);

    useEffect(() => {
        if (tokens && workspaceId) {
            getWorkspaceMemberProfile(workspaceId, tokens.accessToken)
                .then((profile) => setWorkspaceDisplayName(profile.displayName || null))
                .catch(() => setWorkspaceDisplayName(null));
        } else {
            setWorkspaceDisplayName(null);
        }
    }, [tokens, workspaceId]);

    const userDisplayName =
        (user?.legalName && user.legalName.trim().length > 0 && user.legalName.trim()) ||
        (user?.email ? user.email.split('@')[0] : '');
    const sidebarDisplayName = workspaceDisplayName?.trim() || userDisplayName;
    const sidebarAvatar = sidebarDisplayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase();

    const currentWorkspace = workspaces.find(w => w.id === workspaceId);

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
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
                    />
                </ListItemButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <MenuItem onClick={() => {
                        handleMenuClose();
                        if (workspaceId) {
                            navigate(`/workspace/${workspaceId}/profile`);
                        } else {
                            navigate('/settings');
                        }
                    }}>
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        {strings.layout.dashboard.settings}
                    </MenuItem>
                    <MenuItem onClick={handleLogout}>
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
        </Box>
    );
};

export default DashboardLayout;
