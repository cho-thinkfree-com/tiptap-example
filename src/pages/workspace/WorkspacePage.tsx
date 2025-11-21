import { Alert, Box, Breadcrumbs, Button, CircularProgress, Container, Link, Typography, Menu, MenuItem, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWorkspaceDocuments, getFolder, createFolder, createDocument, deleteDocument, deleteFolder, renameDocument, renameFolder, getWorkspace, type DocumentSummary, type FolderSummary, type WorkspaceSummary } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';

import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CreateFolderDialog from '../../components/workspace/CreateFolderDialog';
import RenameDialog from '../../components/workspace/RenameDialog';

import { usePageTitle } from '../../hooks/usePageTitle';
import { broadcastSync } from '../../lib/syncEvents';
import { useSyncChannel } from '../../hooks/useSyncChannel';
import { useI18n } from '../../lib/i18n';

const WorkspacePage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  const { tokens } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const { strings } = useI18n();

  usePageTitle(workspace?.name || 'Workspace');
  const [ancestors, setAncestors] = useState<FolderSummary[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorElBreadcrumb, setAnchorElBreadcrumb] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; type: 'document' | 'folder' } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  const breadcrumbContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const fetchContents = useCallback(() => {
    if (tokens && workspaceId) {
      setLoading(true);

      const folderDetailsPromise = folderId
        ? getFolder(folderId, tokens.accessToken)
        : Promise.resolve(null);

      Promise.all([
        getWorkspace(workspaceId, tokens.accessToken),
        folderDetailsPromise,
        getWorkspaceDocuments(workspaceId, tokens.accessToken, { folderId: folderId ?? undefined }),
      ])
        .then(([workspaceData, folderResponse, contents]) => {
          setWorkspace(workspaceData);

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

  // Track breadcrumb container width
  useEffect(() => {
    const container = breadcrumbContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Listen for sync events from other tabs
  useSyncChannel(useCallback((event) => {
    // Only refresh if the event is for the current workspace and folder
    if (event.workspaceId !== workspaceId) return;
    if (event.folderId !== (folderId ?? null)) return;

    // Refresh content for relevant events
    if (['document-created', 'document-updated', 'document-deleted', 'folder-created', 'folder-renamed'].includes(event.type)) {
      fetchContents();
    }
  }, [workspaceId, folderId, fetchContents]));

  const handleCreateFolder = async (name: string) => {
    if (!tokens || !workspaceId) {
      throw new Error('Not authenticated or workspace not found');
    }
    await createFolder(workspaceId, tokens.accessToken, { name, parentId: folderId ?? undefined });
    fetchContents();

    // Broadcast folder creation
    broadcastSync({
      type: 'folder-created',
      workspaceId,
      folderId: folderId ?? null,
      data: { name }
    });
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

      // Broadcast document creation
      broadcastSync({
        type: 'document-created',
        workspaceId,
        folderId: folderId ?? null,
        documentId: newDoc.id
      });
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
    if (!tokens || !selectedItem || !workspaceId) return;
    try {
      if (selectedItem.type === 'document') {
        await deleteDocument(selectedItem.id, tokens.accessToken);

        // Broadcast document deletion
        broadcastSync({
          type: 'document-deleted',
          workspaceId,
          folderId: folderId ?? null,
          documentId: selectedItem.id
        });
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
    if (!tokens || !selectedItem || !workspaceId) return;
    try {
      if (selectedItem.type === 'document') {
        await renameDocument(selectedItem.id, tokens.accessToken, { title: newName });
      } else {
        await renameFolder(selectedItem.id, tokens.accessToken, { name: newName });

        // Broadcast folder rename
        broadcastSync({
          type: 'folder-renamed',
          workspaceId,
          folderId: folderId ?? null,
          data: { name: newName }
        });
      }
      fetchContents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRenameDialogOpen(false);
      setSelectedItem(null);
    }
  };

  const truncateName = (name: string, maxLength: number = 17): string => {
    if (name.length <= maxLength) return name;
    const halfLength = Math.floor((maxLength - 3) / 2);
    return `${name.substring(0, halfLength)}...${name.substring(name.length - halfLength)}`;
  };

  const { breadcrumbPaths, hiddenBreadcrumbItems } = useMemo(() => {
    const paths: { name: string; fullName: string; path: string; icon?: React.ReactNode }[] = [
      { name: 'Root', fullName: 'Root', path: `/workspace/${workspaceId}`, icon: <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" /> }
    ];

    if (Array.isArray(ancestors)) {
      ancestors.forEach((ancestor) => {
        paths.push({
          name: truncateName(ancestor.name),
          fullName: ancestor.name,
          path: `/workspace/${workspaceId}?folderId=${ancestor.id}`,
          icon: null
        });
      });
    }

    if (currentFolder) {
      paths.push({
        name: truncateName(currentFolder.name),
        fullName: currentFolder.name,
        path: `/workspace/${workspaceId}?folderId=${currentFolder.id}`,
        icon: null
      });
    }

    // Width-based collapse logic
    if (paths.length > 2 && containerWidth > 0) {
      const BUTTON_RESERVE = 300; // Reserve space for right-side buttons
      const SEPARATOR_WIDTH = 20; // Approximate width of separator
      const ELLIPSIS_WIDTH = 40; // Approximate width of "..." button

      const availableWidth = containerWidth - BUTTON_RESERVE;

      // Estimate width for each item (char * 8px + padding/icon)
      const estimateWidth = (item: typeof paths[0]) => {
        return item.name.length * 8 + (item.icon ? 50 : 40);
      };

      // Calculate total width if all items were shown
      const totalWidth = paths.reduce((sum, item, index) => {
        return sum + estimateWidth(item) + (index > 0 ? SEPARATOR_WIDTH : 0);
      }, 0);

      // If total width exceeds available space, collapse middle items
      if (totalWidth > availableWidth) {
        const first = paths[0];
        const last = paths[paths.length - 1];

        // Start with first and last items
        let currentWidth = estimateWidth(first) + SEPARATOR_WIDTH + ELLIPSIS_WIDTH + SEPARATOR_WIDTH + estimateWidth(last);

        // Try to add items from the end (most recent folders)
        const visibleMiddleItems: typeof paths = [];
        for (let i = paths.length - 2; i >= 1; i--) {
          const itemWidth = estimateWidth(paths[i]) + SEPARATOR_WIDTH;
          if (currentWidth + itemWidth <= availableWidth) {
            visibleMiddleItems.unshift(paths[i]);
            currentWidth += itemWidth;
          } else {
            break;
          }
        }

        // If we can show some middle items
        if (visibleMiddleItems.length > 0) {
          const hiddenStartIndex = 1;
          const hiddenEndIndex = paths.length - 1 - visibleMiddleItems.length;

          const hidden = paths.slice(hiddenStartIndex, hiddenEndIndex).map((item, index) => ({
            ...item,
            depth: index
          }));

          const collapsed = [first];
          if (hidden.length > 0) {
            collapsed.push({ name: '...', fullName: 'Hidden path items', path: '#', icon: null });
          }
          collapsed.push(...visibleMiddleItems);
          collapsed.push(last);

          return { breadcrumbPaths: collapsed, hiddenBreadcrumbItems: hidden };
        } else {
          // Can't fit any middle items, just show first ... last
          const hidden = paths.slice(1, paths.length - 1).map((item, index) => ({
            ...item,
            depth: index
          }));

          return {
            breadcrumbPaths: [
              first,
              { name: '...', fullName: 'Hidden path items', path: '#', icon: null },
              last
            ],
            hiddenBreadcrumbItems: hidden
          };
        }
      }
    }

    return { breadcrumbPaths: paths, hiddenBreadcrumbItems: [] };
  }, [ancestors, currentFolder, workspaceId, containerWidth]);

  const renderFilesAndFolders = () => {
    if (loading) return <CircularProgress />;
    if (error) return <Alert severity="error">{error}</Alert>;

    if (folders.length === 0 && documents.length === 0) {
      return (
        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {strings.workspace.emptyFolder}
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleCreateDocument()}>
            {strings.workspace.createFirstDocument}
          </Button>
        </Paper>
      );
    }

    return (
      <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width="50%">{strings.workspace.nameColumn}</TableCell>
              <TableCell width="20%">{strings.workspace.lastModifiedColumn}</TableCell>
              <TableCell width="20%">{strings.workspace.modifiedByColumn}</TableCell>
              <TableCell align="right" width="10%">{strings.workspace.actionsColumn}</TableCell>
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
                  <Chip label={doc.lastModifiedBy || strings.workspace.ownerLabel} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
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

  return (
    <Container maxWidth="xl">
      <Box ref={breadcrumbContainerRef} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" maxItems={20}>
          {breadcrumbPaths.map((item, index) => {
            const isLast = index === breadcrumbPaths.length - 1;
            const isEllipsis = item.name === '...';

            if (isEllipsis) {
              return (
                <Box
                  key={`ellipsis-${index}`}
                  component="button"
                  onClick={(e) => setAnchorElBreadcrumb(e.currentTarget)}
                  sx={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'text.secondary',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    '&:hover': {
                      color: 'text.primary',
                      textDecoration: 'underline'
                    }
                  }}
                >
                  ...
                </Box>
              );
            }

            return isLast ? (
              <Typography color="text.primary" fontWeight="600" key={item.name} sx={{ display: 'flex', alignItems: 'center' }} title={item.fullName}>
                {item.icon}
                {item.name}
              </Typography>
            ) : (
              <Link component={RouterLink} underline="hover" color="inherit" to={item.path} key={item.name} sx={{ display: 'flex', alignItems: 'center' }} title={item.fullName}>
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </Breadcrumbs>

        {/* Breadcrumb dropdown menu */}
        <Menu
          anchorEl={anchorElBreadcrumb}
          open={Boolean(anchorElBreadcrumb)}
          onClose={() => setAnchorElBreadcrumb(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {hiddenBreadcrumbItems.map((item) => (
            <MenuItem
              key={item.path}
              component={RouterLink}
              to={item.path}
              onClick={() => setAnchorElBreadcrumb(null)}
              sx={{ pl: 2 + (item.depth * 2) }}
            >
              <FolderIcon sx={{ mr: 1.5, fontSize: 18, opacity: 0.7 }} />
              {item.fullName}
            </MenuItem>
          ))}
        </Menu>

        {/* DEBUG: Remove after fixing */}
        {/* <Box sx={{ display: 'none' }}>Ancestors: {JSON.stringify(ancestors)}</Box> */}

      <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setCreateFolderDialogOpen(true)}>
            {strings.workspace.newFolder}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleCreateDocument()}>
            {strings.workspace.newDocument}
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          {strings.workspace.filesTitle}
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
        <MenuItem onClick={handleRenameClick}>{strings.workspace.rename}</MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>{strings.workspace.delete}</MenuItem>
      </Menu>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSelectedItem(null);
        }}
      >
        <DialogTitle>{strings.workspace.confirmDeletionTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {strings.workspace.confirmDeletionBody.replace('{name}', selectedItem?.name ?? '')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteConfirmOpen(false);
            setSelectedItem(null);
          }}>{strings.workspace.cancel}</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">{strings.workspace.delete}</Button>
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
