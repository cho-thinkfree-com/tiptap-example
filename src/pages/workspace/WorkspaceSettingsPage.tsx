import { Alert, Box, Button, CircularProgress, Container, TextField, Typography, Paper, Stack, Divider, Chip } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { getWorkspace, getWorkspaceMemberProfile, updateWorkspace, type WorkspaceSummary, type MembershipSummary } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

const WorkspaceSettingsPage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { strings } = useI18n();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);

  // General Section State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Initial State for Change Detection
  const [initialName, setInitialName] = useState('');
  const [initialDescription, setInitialDescription] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Saving States
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalSuccess, setGeneralSuccess] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const isPrivileged = useMemo(
    () => membership?.role === 'owner' || membership?.role === 'admin',
    [membership?.role],
  );

  useEffect(() => {
    if (isAuthenticated && workspaceId) {
      setLoading(true);
      Promise.all([
        getWorkspace(workspaceId),
        getWorkspaceMemberProfile(workspaceId),
      ])
        .then(([currentWorkspace, member]) => {
          setWorkspace(currentWorkspace);
          setMembership(member);

          setName(currentWorkspace.name);
          setDescription(currentWorkspace.description || '');

          setInitialName(currentWorkspace.name);
          setInitialDescription(currentWorkspace.description || '');
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAuthenticated, workspaceId]);

  const handleSaveGeneral = async () => {
    if (!isAuthenticated || !workspaceId) return;

    setIsSavingGeneral(true);
    setGeneralError(null);
    setGeneralSuccess(false);

    try {
      await updateWorkspace(workspaceId, { name, description });
      setGeneralSuccess(true);
      setInitialName(name);
      setInitialDescription(description);

      // Dispatch event to update global layout
      window.dispatchEvent(new CustomEvent('workspace-updated', { detail: { workspaceId } }));

      // Clear success message after 3 seconds
      setTimeout(() => setGeneralSuccess(false), 3000);
    } catch (err) {
      setGeneralError((err as Error).message);
    } finally {
      setIsSavingGeneral(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!workspace) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="warning">Workspace not found.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {strings.workspace.updateTitle || 'Workspace Settings'}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/workspace/${workspaceId}`)}
        >
          {strings.workspace.backToFiles || 'Back to Files'}
        </Button>
      </Box>

      <Stack spacing={3}>
        {/* General Section */}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">General</Typography>
              <Box sx={{ minWidth: 80, display: 'flex', justifyContent: 'center' }}>
                {generalSuccess && (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Saved"
                    color="success"
                    size="small"
                  />
                )}
                {generalError && (
                  <Chip
                    icon={<ErrorIcon />}
                    label="Error"
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            </Box>
            <Button
              variant="contained"
              onClick={handleSaveGeneral}
              disabled={isSavingGeneral || !isPrivileged || (name === initialName && description === initialDescription)}
              size="small"
            >
              {isSavingGeneral ? <CircularProgress size={20} /> : (strings.workspace.updateButton || 'Save Changes')}
            </Button>
          </Box>

          {!isPrivileged && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {strings.workspace.settingsAccessRestricted}
              </Typography>
              <Typography variant="body2">{strings.workspace.settingsAccessRestrictedDetail}</Typography>
            </Alert>
          )}

          <Stack spacing={2}>
            <TextField
              label={strings.workspace.createWorkspacePlaceholder}
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSavingGeneral || !isPrivileged}
            />
            <TextField
              label={strings.workspace.descriptionLabel}
              fullWidth
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSavingGeneral || !isPrivileged}
            />
            {generalError && (
              <Alert severity="error">{generalError}</Alert>
            )}
          </Stack>
        </Paper>


      </Stack>
    </Container>
  );
};

export default WorkspaceSettingsPage;
