import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const PublicRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
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
