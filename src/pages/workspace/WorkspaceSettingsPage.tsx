import { Alert, Box, Button, CircularProgress, Container, TextField, Typography, Paper, Stack, Divider } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../context/AuthContext';
import { getWorkspace, getWorkspaceMemberProfile, updateWorkspace, type WorkspaceSummary, type MembershipSummary } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

const WorkspaceSettingsPage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { tokens } = useAuth();
  const { strings } = useI18n();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isPrivileged = useMemo(
    () => membership?.role === 'owner' || membership?.role === 'admin',
    [membership?.role],
  );

  useEffect(() => {
    if (tokens && workspaceId) {
      setLoading(true);
      Promise.all([
        getWorkspace(workspaceId, tokens.accessToken),
        getWorkspaceMemberProfile(workspaceId, tokens.accessToken),
      ])
        .then(([currentWorkspace, member]) => {
          setWorkspace(currentWorkspace);
          setMembership(member);
          setName(currentWorkspace.name);
          setDescription(currentWorkspace.description || '');
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tokens, workspaceId]);

  const handleSave = async () => {
    if (!tokens || !workspaceId) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await updateWorkspace(workspaceId, tokens.accessToken, { name, description });
      setSaveSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {strings.workspace.updateTitle}
        </Typography>
        {workspaceId && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(`/workspace/${workspaceId}`)}
          >
            {strings.workspace.backToFiles}
          </Button>
        )}
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3} divider={<Divider flexItem />}>
          {!isPrivileged && (
            <Alert severity="info">
              <Typography variant="subtitle2" fontWeight={600}>
                {strings.workspace.settingsAccessRestricted}
              </Typography>
              <Typography variant="body2">{strings.workspace.settingsAccessRestrictedDetail}</Typography>
            </Alert>
          )}

          <Box component="form" sx={{ display: 'grid', gap: 2 }}>
            <TextField
              label={strings.workspace.createWorkspacePlaceholder}
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              margin="normal"
              disabled={isSaving || !isPrivileged}
            />
            <TextField
              label={strings.workspace.descriptionLabel}
              fullWidth
              multiline
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              margin="normal"
              disabled={isSaving || !isPrivileged}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={isSaving || !isPrivileged}
              >
                {isSaving ? <CircularProgress size={18} /> : strings.workspace.updateButton}
              </Button>
            </Box>
            {saveSuccess && (
              <Alert severity="success">{strings.workspace.updateSuccess}</Alert>
            )}
            {error && (
              <Alert severity="error">{error}</Alert>
            )}
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default WorkspaceSettingsPage;
