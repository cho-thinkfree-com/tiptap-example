import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UploadProvider } from '../context/UploadContext';
import UploadManager from './upload/UploadManager';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import DashboardLayout from './layout/DashboardLayout';
import WorkspaceDashboardPage from '../pages/dashboard/WorkspaceDashboardPage';
import WorkspaceFilesPage from '../pages/workspace/WorkspaceFilesPage';
import WorkspaceSettingsPage from '../pages/workspace/WorkspaceSettingsPage';
import WorkspaceMembersPage from '../pages/workspace/WorkspaceMembersPage';
import GlobalSettingsPage from '../pages/settings/GlobalSettingsPage';
import WorkspaceProfilePage from '../pages/settings/WorkspaceProfilePage';
import EditorPage from '../pages/editor/EditorPage';
import ViewerPage from '../pages/editor/ViewerPage';
import BlogLandingPage from '../pages/blog/BlogLandingPage';
import TrashPage from '../pages/trash/TrashPage';
import RecentFilesPage from '../pages/workspace/RecentFilesPage';
import SharedFilesPage from '../pages/workspace/SharedFilesPage';
import ImportantFilesPage from '../pages/workspace/ImportantFilesPage';
import WorkspaceLayout from './layout/WorkspaceLayout';
import SharePage from '../pages/share/SharePage';

// Dispatcher for blog document routes to handle both legacy (documentNumber) and new (token) URLs
const BlogDocumentDispatcher = () => {
  const { tokenOrId } = useParams<{ tokenOrId: string }>();

  // Simple heuristic: if it's all digits, assume it's a document number (legacy)
  // Otherwise, assume it's a share token (new)
  const isNumeric = /^\d+$/.test(tokenOrId || '');

  if (isNumeric) {
    return <ViewerPage documentNumber={tokenOrId} />;
  } else {
    return <SharePage token={tokenOrId} />;
  }
};

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Check if this is a manual logout (user clicked logout button)
    // vs automatic logout (session expired)
    const isManualLogout = typeof window !== 'undefined' && window.sessionStorage.getItem('manual-logout') === 'true';

    if (isManualLogout) {
      // For manual logout, redirect to login without preserving the current page
      // The flag will be cleared by LoginPage on mount
      return <Navigate to="/login" replace />;
    }

    // For automatic logout (session expiry), preserve the redirect parameter
    // so user can return to their original page after logging in
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectUrl}`} replace />;
  }

  return <Outlet />;
};

const PublicRoute = () => {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect');

  if (isAuthenticated) {
    return <Navigate to={redirectUrl || '/dashboard'} replace />;
  }

  return <Outlet />;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        }
      />

      {/* Unified share route - handles both public and link-only shares */}
      {/* Token determines if it's searchable (accessType='public') or link-only (accessType='link') */}
      <Route path="/share/:token/:title?" element={<SharePage />} />
      <Route path="/public/:token/:title?" element={<SharePage />} />

      {/* Blog Landing Page */}
      <Route path="/blog/:handle" element={<BlogLandingPage />} />

      {/* Blog Document Routes - Handles both Token (new) and DocumentNumber (legacy) */}
      <Route path="/blog/:handle/documents/:tokenOrId/:titleSlug?" element={<BlogDocumentDispatcher />} />

      {/* Legacy Blog Route (Workspace/Profile ID) - Document View */}
      <Route path="/blog/:workspaceId/:profileId/documents/:token/:title?" element={<SharePage />} />
      <Route path="/blog/:workspaceId/:profileId" element={<BlogLandingPage />} />

      {/* Authenticated Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<WorkspaceDashboardPage />} />
          <Route path="/settings" element={<GlobalSettingsPage />} />

          {/* Workspace Routes with Sidebar */}
          <Route element={<WorkspaceLayout />}>
            <Route path="/workspace/:workspaceId" element={<Navigate to="files" replace />} />
            <Route path="/workspace/:workspaceId/files" element={<WorkspaceFilesPage />} />
            <Route path="/workspace/:workspaceId/folder/:folderId" element={<WorkspaceFilesPage />} />
            <Route path="/workspace/:workspaceId/shared" element={<SharedFilesPage />} />
            <Route path="/workspace/:workspaceId/recent" element={<RecentFilesPage />} />
            <Route path="/workspace/:workspaceId/important" element={<ImportantFilesPage />} />
            <Route path="/workspace/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
            <Route path="/workspace/:workspaceId/profile" element={<WorkspaceProfilePage />} />
            <Route path="/workspace/:workspaceId/members" element={<WorkspaceMembersPage />} />
            <Route path="/workspace/:workspaceId/trash" element={<TrashPage />} />
          </Route>
        </Route>
        {/* Editor route is outside DashboardLayout to have its own full-screen layout */}
        <Route path="/document/:documentId" element={<EditorPage />} />
      </Route>

      {/* Auth Routes - Redirect to dashboard if already logged in */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* Fallback Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

import LanguageSync from './common/LanguageSync';
import { SocketProvider } from '../context/SocketContext';

// ...

const App = () => {
  return (
    <AuthProvider>
      <UploadProvider>
        <BrowserRouter>
          <SocketProvider>
            <LanguageSync />
            <AppRoutes />
            <UploadManager />
          </SocketProvider>
        </BrowserRouter>
      </UploadProvider>
    </AuthProvider>
  );
};

export default App;
