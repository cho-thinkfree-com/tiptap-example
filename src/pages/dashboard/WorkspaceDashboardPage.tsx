import { Alert, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Container, TextField, Typography, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Link } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createWorkspace, getWorkspaces, getRecentDocuments, type WorkspaceSummary, type DocumentSummary } from '../../lib/api';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArticleIcon from '@mui/icons-material/Article';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import CreateWorkspaceDialog from '../../components/workspace/CreateWorkspaceDialog';
import { formatRelativeDate } from '../../lib/formatDate';
import { useI18n } from '../../lib/i18n';

import { usePageTitle } from '../../hooks/usePageTitle';
import { useSyncChannel } from '../../hooks/useSyncChannel';

const WorkspaceDashboardPage = () => {
  const { strings } = useI18n();
  usePageTitle(strings.dashboard.title);
  const { tokens } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<DocumentSummary[]>([]);
  const [recentDocumentsLoading, setRecentDocumentsLoading] = useState(true);
  const [recentDocumentsError, setRecentDocumentsError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(() => {
    if (tokens) {
      setLoading(true);
      getWorkspaces(tokens.accessToken)
        .then((data) => {
          setWorkspaces(data);
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tokens]);

  const fetchRecentDocuments = useCallback(() => {
    if (tokens) {
      setRecentDocumentsLoading(true);
      getRecentDocuments(tokens.accessToken)
        .then((data) => {
          setRecentDocuments(data);
        })
        .catch((err) => {
          setRecentDocumentsError((err as Error).message);
        })
        .finally(() => {
          setRecentDocumentsLoading(false);
        });
    }
  }, [tokens]);

  useEffect(() => {
    fetchWorkspaces();
    fetchRecentDocuments();
  }, [fetchWorkspaces, fetchRecentDocuments]);

  // Listen for sync events from other tabs
  useSyncChannel(useCallback((event) => {
    // Refresh recent documents on any document event
    if (['document-created', 'document-updated', 'document-deleted'].includes(event.type)) {
      fetchRecentDocuments();
    }
  }, [fetchRecentDocuments]));

  const handleCreateWorkspace = async (name: string) => {
    if (!tokens) {
      throw new Error('Not authenticated');
    }
    await createWorkspace(tokens.accessToken, { name });
    fetchWorkspaces();
  };

  const renderWorkspaces = () => {
    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;

    if (workspaces.length === 0) {
      return (
        <Paper sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography variant="h6" gutterBottom>{strings.dashboard.noWorkspacesFound}</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {strings.dashboard.manageDocuments}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            {strings.dashboard.createWorkspace}
          </Button>
        </Paper>
      );
    }

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
        {workspaces.map((ws) => (
          <Box key={ws.id}>
            <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardActionArea component={RouterLink} to={`/workspace/${ws.id}`} sx={{ height: '100%', p: 1 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <WorkspacesIcon color="primary" sx={{ fontSize: 32, mr: 1.5, opacity: 0.8 }} />
                    <Typography variant="h6" component="div" fontWeight="600">
                      {ws.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {ws.description || 'No description provided.'}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Box>
        ))}
        <Box>
          <Card sx={{ height: '100%', borderStyle: 'dashed', bgcolor: 'transparent' }}>
            <CardActionArea onClick={() => setCreateDialogOpen(true)} sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 160 }}>
              <AddIcon color="action" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" color="text.secondary">{strings.dashboard.createWorkspace}</Typography>
            </CardActionArea>
          </Card>
        </Box>
      </Box>
    );
  };

  const renderRecentDocuments = () => {
    if (recentDocumentsLoading) return <CircularProgress />;
    if (recentDocumentsError) return <Alert severity="error">{recentDocumentsError}</Alert>;
    if (recentDocuments.length === 0) return <Typography color="text.secondary">{strings.dashboard.noRecentDocuments}</Typography>;

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="40%">{strings.dashboard.name}</TableCell>
              <TableCell width="20%">{strings.dashboard.workspace}</TableCell>
              <TableCell width="25%">{strings.dashboard.lastModified}</TableCell>
              <TableCell align="right" width="15%">{strings.dashboard.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentDocuments.map((doc) => {
              const workspace = workspaces.find(w => w.id === doc.workspaceId);
              return (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/document/${doc.id}`} target="_blank" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                      <ArticleIcon color="action" sx={{ mr: 1.5 }} />
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {workspace?.name || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.updatedAt)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" component={RouterLink} to={`/document/${doc.id}`} target="_blank">
                      {strings.dashboard.open}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>{strings.dashboard.title}</Typography>
        <Typography variant="body1" color="text.secondary">{strings.dashboard.manageDocuments}</Typography>
      </Box>

      <TextField
        fullWidth
        placeholder={strings.dashboard.searchDocuments}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 6, maxWidth: 600 }}
      />

      <Box sx={{ mb: 6 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>{strings.dashboard.workspaces}</Typography>
        {renderWorkspaces()}
      </Box>

      <Box>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>{strings.dashboard.recentDocuments}</Typography>
        {renderRecentDocuments()}
      </Box>

      <CreateWorkspaceDialog
        open={isCreateDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateWorkspace}
      />
    </Container>
  );
};

export default WorkspaceDashboardPage;
