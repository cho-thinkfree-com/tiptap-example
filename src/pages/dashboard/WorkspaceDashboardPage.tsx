import { Alert, Box, Button, Card, CardActionArea, CardContent, CircularProgress, Container, TextField, Typography, InputAdornment, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Link, Chip } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createWorkspace, getWorkspaces, getRecentDocuments, createDocument, type WorkspaceSummary, type DocumentSummary } from '../../lib/api';
import { readJsonFile } from '../../lib/fileUtils';
import { ODOCS_EXTENSION, ODOCS_MIME_TYPE } from '../../lib/constants';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import StarIcon from '@mui/icons-material/Star';
import CreateWorkspaceDialog from '../../components/workspace/CreateWorkspaceDialog';
import FileShareIndicator from '../../components/workspace/FileShareIndicator';
import { formatRelativeDate } from '../../lib/formatDate';
import { useI18n } from '../../lib/i18n';

import { usePageTitle } from '../../hooks/usePageTitle';
import { useSyncChannel } from '../../hooks/useSyncChannel';

const WorkspaceDashboardPage = () => {
  const { strings } = useI18n();
  usePageTitle(strings.dashboard.title);
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<DocumentSummary[]>([]);
  const [recentDocumentsLoading, setRecentDocumentsLoading] = useState(true);
  const [recentDocumentsError, setRecentDocumentsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(() => {
    if (isAuthenticated) {
      setLoading(true);
      getWorkspaces()
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
  }, [isAuthenticated]);

  const fetchRecentDocuments = useCallback(async () => {
    if (isAuthenticated) {
      setRecentDocumentsLoading(true);
      try {
        // Fetch recent documents from all workspaces using the global endpoint
        const allDocuments = await getRecentDocuments();

        // Already sorted by updatedAt from the backend, just take top 10
        setRecentDocuments(allDocuments.slice(0, 10));
        setRecentDocumentsError(null);
      } catch (err) {
        setRecentDocumentsError((err as Error).message);
      } finally {
        setRecentDocumentsLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
    fetchRecentDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Listen for sync events from other tabs
  useSyncChannel(useCallback((event) => {
    // Refresh recent documents on any document event
    if (['document-created', 'document-updated', 'document-deleted'].includes(event.type)) {
      fetchRecentDocuments();
    }
  }, [fetchRecentDocuments]));

  const handleCreateWorkspace = async (name: string) => {
    if (!isAuthenticated) {
      throw new Error('Not authenticated');
    }
    await createWorkspace({ name });
    fetchWorkspaces();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAuthenticated || workspaces.length === 0) return;

    if (!file.name.endsWith(ODOCS_EXTENSION)) {
      alert(`Only ${ODOCS_EXTENSION} files are allowed.`);
      event.target.value = '';
      return;
    }

    try {
      const content = await readJsonFile(file);
      // Default to the first workspace for now, or we could add a dialog to select workspace
      const workspaceId = workspaces[0].id;

      await createDocument(
        workspaceId,
        file.name.replace(new RegExp(`\\${ODOCS_EXTENSION}$`), ''),
        content
      );

      fetchRecentDocuments();
      // Reset input
      event.target.value = '';
    } catch (error) {
      console.error('Failed to upload file:', error);
      // You might want to show an error message to the user here
    }
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
          <Button
            variant="outlined"
            component="label"
            startIcon={<FileUploadIcon />}
            sx={{ ml: 2 }}
          >
            Upload .odocs
            <input
              type="file"
              hidden
              accept={`${ODOCS_EXTENSION},${ODOCS_MIME_TYPE}`}
              onChange={handleFileUpload}
            />
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
    if (recentDocuments.length === 0) {
      const message =
        workspaces.length === 0
          ? strings.dashboard.noRecentDocumentsNoWorkspace
          : strings.dashboard.noRecentDocuments;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography color="text.secondary">{message}</Typography>
          {workspaces.length > 0 && (
            <Box>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                {strings.dashboard.createWorkspace}
              </Button>
              <Button
                variant="outlined"
                component="label"
                startIcon={<FileUploadIcon />}
                sx={{ ml: 2 }}
              >
                Upload .odocs
                <input
                  type="file"
                  hidden
                  accept=".odocs,application/vnd.odocs+json"
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>
          )}
        </Box>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="35%">{strings.workspace.nameColumn}</TableCell>
              <TableCell width="15%">{strings.dashboard.workspace}</TableCell>
              <TableCell width="15%">{strings.workspace.folderColumn}</TableCell>
              <TableCell width="18%">{strings.workspace.lastModifiedColumn}</TableCell>
              <TableCell width="15%">{strings.workspace.modifiedByColumn}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentDocuments.map((doc) => {
              const workspace = workspaces.find(w => w.id === doc.workspaceId);
              return (
                <TableRow
                  key={doc.id}
                  hover
                  selected={selectedId === doc.id}
                  onClick={() => setSelectedId(doc.id)}
                  onDoubleClick={() => window.open(`/workspace/${doc.workspaceId}/files/${doc.id}/edit`, '_blank')}
                  sx={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.primary' }}>
                      <Box
                        component="img"
                        src="/odocs-file-icon-small.png"
                        alt="document"
                        sx={{ width: 24, height: 24, mr: 1.5 }}
                      />
                      {doc.name}
                      {doc.isStarred && (
                        <StarIcon
                          sx={{
                            ml: 1,
                            fontSize: '1rem',
                            color: 'warning.main',
                            opacity: 0.6
                          }}
                        />
                      )}
                      <FileShareIndicator fileId={doc.id} shareLinks={doc.shareLinks} />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      <Link
                        component={RouterLink}
                        to={`/workspace/${doc.workspaceId}`}
                        underline="hover"
                        color="inherit"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {workspace?.name || 'Unknown'}
                      </Link>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {doc.folderId ? (
                        <Link
                          component={RouterLink}
                          to={`/workspace/${doc.workspaceId}/folder/${doc.folderId}`}
                          underline="hover"
                          color="inherit"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {doc.folderName || 'Folder'}
                        </Link>
                      ) : (
                        <Link
                          component={RouterLink}
                          to={`/workspace/${doc.workspaceId}`}
                          underline="hover"
                          color="inherit"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ opacity: 0.7 }}
                        >
                          {strings.workspace.rootFolder}
                        </Link>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.updatedAt)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={doc.lastModifiedByName || strings.workspace.ownerLabel} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
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
