import { Alert, Box, Breadcrumbs, Button, CircularProgress, Container, Link, Typography, Menu, MenuItem, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Avatar, Stack, Divider } from '@mui/material';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaceDocuments, getFolder, createFolder, createDocument, deleteDocument, deleteFolder, renameDocument, renameFolder, getWorkspace, getWorkspaceMembers, type DocumentSummary, type FolderSummary, type WorkspaceSummary, type MembershipSummary } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';

import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PersonIcon from '@mui/icons-material/Person';
import CreateFolderDialog from '../../components/workspace/CreateFolderDialog';
import RenameDialog from '../../components/workspace/RenameDialog';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  const { tokens } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<MembershipSummary[]>([]);
  const [ancestors, setAncestors] = useState<FolderSummary[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; type: 'document' | 'folder' } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  const fetchContents = useCallback(() => {
    if (tokens && workspaceId) {
      setLoading(true);

      const folderDetailsPromise = folderId
        ? getFolder(folderId, tokens.accessToken)
        : Promise.resolve(null);

      Promise.all([
        getWorkspace(workspaceId, tokens.accessToken),
        getWorkspaceMembers(workspaceId, tokens.accessToken),
        folderDetailsPromise,
        getWorkspaceDocuments(workspaceId, tokens.accessToken, { folderId: folderId ?? undefined }),
      ])
        .then(([workspaceData, membersData, folderResponse, contents]) => {
          setWorkspace(workspaceData);
          setMembers(membersData.items);

          // Robust handling for folderResponse
          if (folderResponse) {
            if ('ancestors' in folderResponse) {
              setCurrentFolder(folderResponse.folder);
              setAncestors(folderResponse.ancestors || []);
            } else {
              // Fallback if backend returns old structure
              setCurrentFolder(folderResponse as unknown as FolderSummary);
              setAncestors([]);
            }
          } else {
            setCurrentFolder(null);
            setAncestors([]);
          }

          setDocuments(contents.documents);
          setFolders(contents.folders);
        })
        .catch((err) => {
          setError((err as Error).message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [tokens, workspaceId, folderId]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleCreateFolder = async (name: string) => {
    if (!tokens || !workspaceId) {
      throw new Error('Not authenticated or workspace not found');
    }
    await createFolder(workspaceId, tokens.accessToken, { name, parentId: folderId ?? undefined });
    fetchContents();
  };

  const handleCreateDocument = async () => {
    if (!tokens || !workspaceId) {
      throw new Error('Not authenticated or workspace not found');
    }
    try {
      setLoading(true);
      const newDoc = await createDocument(workspaceId, tokens.accessToken, {
        folderId: folderId ?? undefined
        // Title is optional, backend generates "Untitled"
      });
      window.open(`/document/${newDoc.id}`, '_blank');
      fetchContents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: { id: string; name: string; type: 'document' | 'folder' }) => {
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedItem here - it's needed for dialogs
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
    handleMenuClose();
  };

  const handleRenameClick = () => {
    setRenameDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!tokens || !selectedItem) return;
    try {
      if (selectedItem.type === 'document') {
        await deleteDocument(selectedItem.id, tokens.accessToken);
      } else {
        await deleteFolder(selectedItem.id, tokens.accessToken);
      }
      fetchContents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleteConfirmOpen(false);
      setSelectedItem(null);
    }
  };

  const handleRename = async (newName: string) => {
    if (!tokens || !selectedItem) return;
    try {
      if (selectedItem.type === 'document') {
        await renameDocument(selectedItem.id, tokens.accessToken, { title: newName });
      } else {
        await renameFolder(selectedItem.id, tokens.accessToken, { name: newName });
      }
      fetchContents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRenameDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const breadcrumbPaths = useMemo(() => {
    const paths = [{ name: 'Root', path: `/workspace/${workspaceId}`, icon: <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" /> }];

    if (Array.isArray(ancestors)) {
      ancestors.forEach((ancestor) => {
        paths.push({ name: ancestor.name, path: `/workspace/${workspaceId}?folderId=${ancestor.id}`, icon: null });
      });
    }

    if (currentFolder) {
      paths.push({ name: currentFolder.name, path: `/workspace/${workspaceId}?folderId=${currentFolder.id}`, icon: null });
    }

    return paths;
  }, [ancestors, currentFolder, workspaceId]);

  const renderFilesAndFolders = () => {
    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;

    if (folders.length === 0 && documents.length === 0) {
      return (
        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            This folder is empty.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleCreateDocument()}>
            Create your first document
          </Button>
        </Paper>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50%">Name</TableCell>
              <TableCell width="20%">Last Modified</TableCell>
              <TableCell width="20%">Modified By</TableCell>
              <TableCell align="right" width="10%">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {folders.map((folder) => (
              <TableRow key={folder.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={`?folderId=${folder.id}`} sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
                    <FolderIcon color="primary" sx={{ mr: 1.5, opacity: 0.8 }} />
                    {folder.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{formatRelativeDate(folder.updatedAt)}</Typography>
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(event) => handleMenuOpen(event, { id: folder.id, name: folder.name, type: 'folder' })}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {documents.map((doc) => (
              <TableRow key={doc.id} hover>
                <TableCell>
                  <Link component={RouterLink} to={`/document/${doc.id}`} target="_blank" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                    <ArticleIcon color="action" sx={{ mr: 1.5 }} />
                    {doc.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.updatedAt)}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={doc.lastModifiedBy || 'User'} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={(event) => handleMenuOpen(event, { id: doc.id, name: doc.title, type: 'document' })}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const owner = useMemo(() => {
    if (!workspace || !members) return null;
    return members.find(m => m.accountId === workspace.ownerAccountId);
  }, [workspace, members]);

  return (
    <Container maxWidth="xl">
      {/* Workspace Header Info */}
      {workspace && (
        <Box sx={{ mb: 4, p: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h4" fontWeight="bold" component="h1">
                {workspace.name}
              </Typography>
              {owner && (
                <Chip
                  avatar={<Avatar><PersonIcon /></Avatar>}
                  label={`Owner: ${owner.displayName || 'Unknown'}`}
                  variant="outlined"
                />
              )}
            </Box>

            {workspace.description && (
              <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {workspace.description}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" maxItems={20}>
          {breadcrumbPaths.map((item, index) => {
            const isLast = index === breadcrumbPaths.length - 1;
            return isLast ? (
              <Typography color="text.primary" fontWeight="600" key={item.name} sx={{ display: 'flex', alignItems: 'center' }}>
                {item.icon}
                {item.name}
              </Typography>
            ) : (
              <Link component={RouterLink} underline="hover" color="inherit" to={item.path} key={item.name} sx={{ display: 'flex', alignItems: 'center' }}>
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </Breadcrumbs>

        {/* DEBUG: Remove after fixing */}
        {/* <Box sx={{ display: 'none' }}>Ancestors: {JSON.stringify(ancestors)}</Box> */}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateFolderDialogOpen(true)}>
            New Folder
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleCreateDocument()}>
            New Document
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          Files
        </Typography>
        {renderFilesAndFolders()}
      </Box>

      <CreateFolderDialog
        open={isCreateFolderDialogOpen}
        onClose={() => {
          setCreateFolderDialogOpen(false);
          setSelectedItem(null);
        }}
        onCreate={handleCreateFolder}
      />


      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleRenameClick}>Rename</MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSelectedItem(null);
        }}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            setSelectedItem(null);
          }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <RenameDialog
        open={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setSelectedItem(null);
        }}
        onRename={handleRename}
        initialName={selectedItem?.name || ''}
        itemType={selectedItem?.type || 'document'}
      />
    </Container >
  );
};

export default WorkspacePage;
