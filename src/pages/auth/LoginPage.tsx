import { Alert, Box, Button, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';
import { useI18n } from '../../lib/i18n';

import { usePageTitle } from '../../hooks/usePageTitle';

const LoginPage = () => {
  usePageTitle('Login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, logoutMessage } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/dashboard';
  const { strings } = useI18n();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      navigate(redirectUrl, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={strings.auth.login.title}
      subtitle={strings.auth.login.subtitle}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : logoutMessage ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            {logoutMessage === 'auth.sessionExpired' ? strings.auth.sessionExpired : logoutMessage}
          </Alert>
        ) : null}

        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label={strings.auth.login.emailLabel}
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label={strings.auth.login.passwordLabel}
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          sx={{ mb: 3 }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ mb: 3, height: 48 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : strings.auth.login.submitButton}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {strings.auth.login.noAccount}{' '}
            <Link component={RouterLink} to="/signup" fontWeight="600" underline="hover">
              {strings.auth.login.signupLink}
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default LoginPage;
