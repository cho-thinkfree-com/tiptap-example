import { Alert, Box, Button, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';
import { useI18n } from '../../lib/i18n';

import { usePageTitle } from '../../hooks/usePageTitle';

const SignupPage = () => {
  usePageTitle('Sign Up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalName, setLegalName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { strings, locale } = useI18n();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup({ email, password, legalName, preferredLocale: locale });
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={strings.auth.signup.title}
      subtitle={strings.auth.signup.subtitle}
    >
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <TextField
          required
          fullWidth
          id="email"
          label={strings.auth.signup.emailLabel}
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />
        <TextField
          required
          fullWidth
          name="password"
          label={strings.auth.signup.passwordLabel}
          type="password"
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          id="legalName"
          label={strings.auth.signup.legalNameLabel}
          name="legalName"
          autoComplete="name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
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
          {loading ? <CircularProgress size={24} color="inherit" /> : strings.auth.signup.submitButton}
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {strings.auth.signup.hasAccount}{' '}
            <Link component={RouterLink} to="/login" fontWeight="600" underline="hover">
              {strings.auth.signup.loginLink}
            </Link>
          </Typography>
        </Box>
      </Box>
    </AuthLayout>
  );
};

export default SignupPage;
