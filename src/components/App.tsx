import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import DashboardLayout from './layout/DashboardLayout';
import WorkspaceDashboardPage from '../pages/dashboard/WorkspaceDashboardPage';
import WorkspacePage from '../pages/workspace/WorkspacePage';
import WorkspaceSettingsPage from '../pages/workspace/WorkspaceSettingsPage';
import WorkspaceMembersPage from '../pages/workspace/WorkspaceMembersPage';
import GlobalSettingsPage from '../pages/settings/GlobalSettingsPage';
import WorkspaceProfilePage from '../pages/settings/WorkspaceProfilePage';
import EditorPage from '../pages/editor/EditorPage';
import SharedDocumentPage from '../pages/editor/SharedDocumentPage';

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Checking auth:', { isAuthenticated, pathname: location.pathname });

  if (!isAuthenticated) {
    // Check if this is a manual logout
    const isManualLogout = typeof window !== 'undefined' && window.sessionStorage.getItem('manual-logout') === 'true';
    console.log('[ProtectedRoute] Not authenticated - manual logout flag:', isManualLogout);

    if (isManualLogout) {
      // Don't clear the flag here - let LoginPage clear it to avoid double-render issues
      console.log('[ProtectedRoute] Manual logout detected - redirecting to /login without param');
      return <Navigate to="/login" replace />;
    }

    // For automatic logouts (session expiry), preserve the redirect parameter
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    console.log('[ProtectedRoute] Auto logout - redirecting with param:', redirectUrl);
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

      {/* Public Share Route */}
      <Route path="/share/:token" element={<SharedDocumentPage />} />

      {/* Authenticated Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<WorkspaceDashboardPage />} />
          <Route path="/settings" element={<GlobalSettingsPage />} />
          <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
          <Route path="/workspace/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
          <Route path="/workspace/:workspaceId/profile" element={<WorkspaceProfilePage />} />
          <Route path="/workspace/:workspaceId/members" element={<WorkspaceMembersPage />} />
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

// ...

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LanguageSync />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
