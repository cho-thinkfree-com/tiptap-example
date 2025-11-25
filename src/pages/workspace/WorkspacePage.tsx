import { Alert, Box, Breadcrumbs, Button, CircularProgress, Container, Link, Typography, Menu, MenuItem, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, useTheme, Snackbar, Checkbox, TableSortLabel } from '@mui/material';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUpload } from '../../context/UploadContext';
import { getWorkspaceDocuments, getFolder, createFolder, createDocument, deleteDocument, deleteFolder, renameDocument, renameFolder, getWorkspace, ApiError, type DocumentSummary, type FolderSummary, type WorkspaceSummary, downloadDocument, moveFolder, updateDocument } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';

import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PublicIcon from '@mui/icons-material/Public';

import CreateFolderDialog from '../../components/workspace/CreateFolderDialog';
import RenameDialog from '../../components/workspace/RenameDialog';
import ShareDialog from '../../components/editor/ShareDialog';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';

import { usePageTitle } from '../../hooks/usePageTitle';
import { broadcastSync } from '../../lib/syncEvents';
import { useSyncChannel } from '../../hooks/useSyncChannel';
import { useI18n } from '../../lib/i18n';

const WorkspacePage = () => {
  const theme = useTheme();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folderId');
  const { isAuthenticated } = useAuth();
  const { uploadFiles } = useUpload();
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const { strings } = useI18n();
  const formatBytes = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
  };

  usePageTitle(workspace?.name || 'Workspace');
  const [ancestors, setAncestors] = useState<FolderSummary[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderSummary | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState(false);
  const [isCreateFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [anchorElBreadcrumb, setAnchorElBreadcrumb] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<{ id: string; name: string; type: 'document' | 'folder'; title?: string } | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Multi-select state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Sorting state
  const [orderBy, setOrderBy] = useState<string>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const breadcrumbContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetFolderId, setDragTargetFolderId] = useState<string | null>(null);
  const [draggedItems, setDraggedItems] = useState<Set<string>>(new Set());
  const [dragOverBreadcrumbIndex, setDragOverBreadcrumbIndex] = useState<number | null>(null);

  const fetchContents = useCallback(() => {
    if (isAuthenticated && workspaceId) {
      setLoading(true);

      const folderDetailsPromise = folderId
        ? getFolder(folderId)
        : Promise.resolve(null);

      Promise.all([
        getWorkspace(workspaceId),
        folderDetailsPromise,
        getWorkspaceDocuments(workspaceId, {
          folderId: folderId ?? undefined,
          sortBy: orderBy,
          sortOrder: order
        }),
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
          if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
            setNotFoundError(true);
          } else {
            setError((err as Error).message);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isAuthenticated, workspaceId, folderId, orderBy, order]);

  useEffect(() => {
    fetchContents();
  }, [fetchContents]);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // ... (existing code)

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
    if (!isAuthenticated || !workspaceId) {
      throw new Error('Not authenticated or workspace not found');
    }
    await createFolder(workspaceId, { name, parentId: folderId ?? undefined });
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
    if (!isAuthenticated || !workspaceId) {
      throw new Error('Not authenticated or workspace not found');
    }
    try {
      setLoading(true);
      const newDoc = await createDocument(workspaceId, {
        folderId: folderId ?? undefined,
        title: strings.editor.title.placeholder,
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DEBUG] handleFileUpload called', event.target.files);
    const files = event.target.files;
    if (!files || files.length === 0 || !workspaceId) return;

    console.log('[DEBUG] Calling uploadFiles with', files.length, 'files');
    uploadFiles(Array.from(files), workspaceId, folderId ?? undefined);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
      setDragTargetFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragTargetFolderId(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0 && workspaceId) {
      uploadFiles(Array.from(files), workspaceId, folderId ?? undefined);
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

  const handleShareClick = () => {
    setShareDialogOpen(true);
    handleMenuClose();
  };

  const handleStar = () => {
    // Placeholder for future implementation
    console.log('Star functionality to be implemented');
  };

  const handlePublish = async () => {
    const selectedDocs = documents.filter(d => selectedItems.has(d.id));

    if (selectedDocs.length === 0) {
      return;
    }

    // Copy document links to clipboard
    const links = selectedDocs.map(doc => {
      const url = `${window.location.origin}/document/${doc.id}`;
      return `[${doc.title}](${url})`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(links);
      setSnackbarMessage(`Copied ${selectedDocs.length} link(s) to clipboard`);
      setSnackbarOpen(true);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const handleToggleItem = (itemId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }

    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setLastSelectedId(itemId);
  };

  const handleSelectAll = () => {
    const allIds = [
      ...folders.map(f => f.id),
      ...documents.map(d => d.id)
    ];

    if (selectedItems.size === allIds.length && allIds.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleRowClick = (itemId: string, event: React.MouseEvent) => {
    // Ignore clicks on links, buttons, and checkboxes
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input')) {
      return;
    }

    // Prevent text selection when using Shift+click for range selection
    if (event.shiftKey) {
      event.preventDefault();
    }

    const newSelected = new Set(selectedItems);

    if (event.shiftKey && lastSelectedId) {
      // Shift+click: Range selection
      const allIds = [...folders.map(f => f.id), ...documents.map(d => d.id)];
      const lastIndex = allIds.indexOf(lastSelectedId);
      const currentIndex = allIds.indexOf(itemId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);

        for (let i = start; i <= end; i++) {
          newSelected.add(allIds[i]);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: Toggle selection
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
    } else {
      // Regular click: Select only this item
      newSelected.clear();
      newSelected.add(itemId);
    }

    setSelectedItems(newSelected);
    setLastSelectedId(itemId);
  };

  const handleRowDoubleClick = (itemId: string, itemType: 'document' | 'folder') => {
    // Clear selection when opening
    setSelectedItems(new Set());

    if (itemType === 'document') {
      window.open(`/document/${itemId}`, '_blank');
    } else {
      navigate(`?folderId=${itemId}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!isAuthenticated || !workspaceId) return;

    const itemsToDelete = Array.from(selectedItems);
    const errors: string[] = [];

    try {
      await Promise.all(
        itemsToDelete.map(async (itemId) => {
          const isDocument = documents.some(d => d.id === itemId);
          try {
            if (isDocument) {
              await deleteDocument(itemId);
              broadcastSync({
                type: 'document-deleted',
                workspaceId,
                folderId: folderId ?? null,
                documentId: itemId
              });
            } else {
              await deleteFolder(itemId);
            }
          } catch (err) {
            errors.push(itemId);
            console.error(`Failed to delete item ${itemId}:`, err);
          }
        })
      );

      const successCount = itemsToDelete.length - errors.length;
      setSnackbarMessage(`${successCount} item(s) moved to trash`);
      setSnackbarOpen(true);
      fetchContents();
      setSelectedItems(new Set());

      if (errors.length > 0) {
        setError(`Failed to delete ${errors.length} item(s)`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only handle if exactly one item is selected
    if (selectedItems.size !== 1) return;

    const selectedId = Array.from(selectedItems)[0];
    const selectedDoc = documents.find(d => d.id === selectedId);
    const selectedFolder = folders.find(f => f.id === selectedId);
    const itemName = selectedDoc?.title || selectedFolder?.name || '';
    const itemType = selectedDoc ? 'document' : 'folder';

    if (event.key === 'F2') {
      // F2: Rename
      event.preventDefault();
      setSelectedItem({
        id: selectedId,
        name: itemName,
        type: itemType,
        title: selectedDoc?.title
      });
      setRenameDialogOpen(true);
    } else if (event.key === 'Delete') {
      // Delete: Delete selected item
      event.preventDefault();
      handleBulkDelete();
    }
  };

  const handleDeleteClick = async () => {
    if (!isAuthenticated || !selectedItem || !workspaceId) return;
    handleMenuClose();

    try {
      const itemName = selectedItem.type === 'document' ? selectedItem.title : selectedItem.name;

      if (selectedItem.type === 'document') {
        await deleteDocument(selectedItem.id);

        // Broadcast document deletion
        broadcastSync({
          type: 'document-deleted',
          workspaceId,
          folderId: folderId ?? null,
          documentId: selectedItem.id
        });
      } else {
        await deleteFolder(selectedItem.id);
      }

      setSnackbarMessage(`"${itemName}" moved to trash`);
      setSnackbarOpen(true);
      fetchContents();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSelectedItem(null);
    }
  };

  const handleRenameClick = () => {
    setRenameDialogOpen(true);
    handleMenuClose();
  };

  const handleDownloadClick = async () => {
    if (!isAuthenticated || !selectedItem || selectedItem.type !== 'document') return;
    handleMenuClose();

    try {
      setLoading(true);
      await downloadDocument(selectedItem.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setSelectedItem(null);
    }
  };



  const handleRename = async (newName: string) => {
    if (!isAuthenticated || !selectedItem || !workspaceId) return;
    try {
      if (selectedItem.type === 'document') {
        await renameDocument(selectedItem.id, { title: newName });
      } else {
        await renameFolder(selectedItem.id, { name: newName });

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

  // Drag and drop handlers for moving items
  const handleItemDragStart = (e: React.DragEvent, itemId: string, itemType: 'document' | 'folder') => {
    // If the dragged item is not in the selection, select only it
    const itemsToDrag = selectedItems.has(itemId) ? selectedItems : new Set([itemId]);
    setDraggedItems(itemsToDrag);

    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-workspace-items', JSON.stringify({
      itemIds: Array.from(itemsToDrag),
      sourceFolder: folderId ?? null
    }));

    // Create custom drag image showing count
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.padding = '8px 12px';
    dragImage.style.backgroundColor = theme.palette.primary.main;
    dragImage.style.color = 'white';
    dragImage.style.borderRadius = '4px';
    dragImage.style.fontSize = '14px';
    dragImage.style.fontWeight = 'bold';
    dragImage.textContent = itemsToDrag.size === 1 ? '1 item' : `${itemsToDrag.size} items`;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleItemDragEnd = () => {
    setDraggedItems(new Set());
    setDragTargetFolderId(null);
    setDragOverBreadcrumbIndex(null);
  };

  const isValidDropTarget = (targetFolderId: string | null, draggedItemIds: Set<string>): boolean => {
    // Can't drop into current location
    if (targetFolderId === (folderId ?? null)) {
      return false;
    }

    // Check if any dragged item is a folder that would create a circular reference
    for (const itemId of draggedItemIds) {
      const draggedFolder = folders.find(f => f.id === itemId);
      if (draggedFolder) {
        // Can't drop folder into itself
        if (itemId === targetFolderId) {
          return false;
        }

        // Can't drop folder into its own descendant
        if (targetFolderId) {
          const targetFolder = folders.find(f => f.id === targetFolderId);
          if (targetFolder && targetFolder.pathCache.includes(itemId)) {
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleFolderDragOver = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.types.includes('application/x-workspace-items');
    if (!data) return; // Only handle workspace items, not file uploads

    if (isValidDropTarget(targetFolderId, draggedItems)) {
      e.dataTransfer.dropEffect = 'move';
      setDragTargetFolderId(targetFolderId);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragTargetFolderId === targetFolderId) {
      setDragTargetFolderId(null);
    }
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('application/x-workspace-items');
    if (!data) {
      // Handle file upload
      const files = e.dataTransfer.files;
      if (files && files.length > 0 && workspaceId) {
        uploadFiles(Array.from(files), workspaceId, targetFolderId);
      }
      setDragTargetFolderId(null);
      return;
    }

    try {
      const { itemIds } = JSON.parse(data);
      const itemsToMove = new Set(itemIds);

      if (!isValidDropTarget(targetFolderId, itemsToMove)) {
        setDragTargetFolderId(null);
        return;
      }

      // Move all items
      const errors: string[] = [];
      await Promise.all(
        Array.from(itemsToMove).map(async (itemId) => {
          try {
            const isDocument = documents.some(d => d.id === itemId);
            if (isDocument) {
              await updateDocument(itemId, { folderId: targetFolderId });
            } else {
              await moveFolder(itemId, { parentId: targetFolderId });
            }
          } catch (err) {
            errors.push(itemId);
            console.error(`Failed to move item ${itemId}:`, err);
          }
        })
      );

      const successCount = itemsToMove.size - errors.length;
      if (successCount > 0) {
        setSnackbarMessage(`${successCount} item(s) moved successfully`);
        setSnackbarOpen(true);
        fetchContents();
        setSelectedItems(new Set());
      }

      if (errors.length > 0) {
        setError(`Failed to move ${errors.length} item(s)`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDragTargetFolderId(null);
      setDraggedItems(new Set());
    }
  };

  const handleBreadcrumbDragOver = (e: React.DragEvent, index: number, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.types.includes('application/x-workspace-items');
    if (!data) return;

    if (isValidDropTarget(targetFolderId, draggedItems)) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverBreadcrumbIndex(index);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleBreadcrumbDragLeave = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverBreadcrumbIndex === index) {
      setDragOverBreadcrumbIndex(null);
    }
  };

  const handleBreadcrumbDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const data = e.dataTransfer.getData('application/x-workspace-items');
    if (!data) {
      setDragOverBreadcrumbIndex(null);
      return;
    }

    try {
      const { itemIds } = JSON.parse(data);
      const itemsToMove = new Set(itemIds);

      if (!isValidDropTarget(targetFolderId, itemsToMove)) {
        setDragOverBreadcrumbIndex(null);
        return;
      }

      // Move all items
      const errors: string[] = [];
      await Promise.all(
        Array.from(itemsToMove).map(async (itemId) => {
          try {
            const isDocument = documents.some(d => d.id === itemId);
            if (isDocument) {
              await updateDocument(itemId, { folderId: targetFolderId });
            } else {
              await moveFolder(itemId, { parentId: targetFolderId });
            }
          } catch (err) {
            errors.push(itemId);
            console.error(`Failed to move item ${itemId}:`, err);
          }
        })
      );

      const successCount = itemsToMove.size - errors.length;
      if (successCount > 0) {
        setSnackbarMessage(`${successCount} item(s) moved successfully`);
        setSnackbarOpen(true);
        fetchContents();
        setSelectedItems(new Set());
      }

      if (errors.length > 0) {
        setError(`Failed to move ${errors.length} item(s)`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDragOverBreadcrumbIndex(null);
      setDraggedItems(new Set());
    }
  };

  const truncateName = (name: string, maxLength: number = 17): string => {
    if (name.length <= maxLength) return name;
    const halfLength = Math.floor((maxLength - 3) / 2);
    return `${name.substring(0, halfLength)}...${name.substring(name.length - halfLength)}`;
  };

  const { breadcrumbPaths, hiddenBreadcrumbItems } = useMemo(() => {
    const paths: { name: string; fullName: string; path: string; icon?: React.ReactNode }[] = [
      {
        name: 'Files',
        fullName: 'Files',
        path: `/workspace/${workspaceId}`,
        icon: <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
      }
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

  const totalItems = folders.length + documents.length;
  const isAllSelected = selectedItems.size === totalItems && totalItems > 0;
  const isIndeterminate = selectedItems.size > 0 && selectedItems.size < totalItems;
  const selectedItemsData = {
    hasDocuments: Array.from(selectedItems).some(id => documents.some(d => d.id === id)),
    hasFolders: Array.from(selectedItems).some(id => folders.some(f => f.id === id)),
  };

  // Combine and sort folders and documents for display
  const sortedItems = useMemo(() => {
    type Item = (FolderSummary & { type: 'folder' }) | (DocumentSummary & { type: 'document' });

    const foldersWithType: Item[] = folders.map(f => ({ ...f, type: 'folder' as const }));
    const documentsWithType: Item[] = documents.map(d => ({ ...d, type: 'document' as const }));

    // Always keep folders first, then documents
    // Sort each group independently based on the current sort criteria
    if (orderBy === 'size') {
      // For size sorting, sort folders and documents separately
      const sortedFolders = [...foldersWithType].sort((a, b) => {
        // Folders don't have size, so always sort by name (A-Z)
        const aName = (a as FolderSummary).name.toLowerCase();
        const bName = (b as FolderSummary).name.toLowerCase();
        return aName.localeCompare(bName);
      });
      const sortedDocuments = [...documentsWithType].sort((a, b) => {
        const aSize = (a as DocumentSummary).contentSize || 0;
        const bSize = (b as DocumentSummary).contentSize || 0;
        return order === 'asc' ? aSize - bSize : bSize - aSize;
      });
      return [...sortedFolders, ...sortedDocuments];
    }

    // For other sorting (name, date), backend handles the sorting
    // Just combine folders first, then documents
    return [...foldersWithType, ...documentsWithType];
  }, [folders, documents, orderBy, order]);

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
              <TableCell width="40%">
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleRequestSort('name')}
                >
                  {strings.workspace.nameColumn}
                </TableSortLabel>
              </TableCell>
              <TableCell width="15%">
                <TableSortLabel
                  active={orderBy === 'size'}
                  direction={orderBy === 'size' ? order : 'asc'}
                  onClick={() => handleRequestSort('size')}
                >
                  {strings.workspace.sizeColumn}
                </TableSortLabel>
              </TableCell>
              <TableCell width="20%">
                <TableSortLabel
                  active={orderBy === 'updatedAt'}
                  direction={orderBy === 'updatedAt' ? order : 'asc'}
                  onClick={() => handleRequestSort('updatedAt')}
                >
                  {strings.workspace.lastModifiedColumn}
                </TableSortLabel>
              </TableCell>
              <TableCell width="15%">{strings.workspace.modifiedByColumn}</TableCell>
              <TableCell align="right" width="10%">{strings.workspace.actionsColumn}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedItems.map((item) => {
              const isFolder = item.type === 'folder';
              const itemId = item.id;
              const itemName = isFolder ? (item as FolderSummary).name : (item as DocumentSummary).title;

              return (
                <TableRow
                  key={itemId}
                  hover
                  selected={selectedItems.has(itemId)}
                  draggable
                  onClick={(e) => handleRowClick(itemId, e)}
                  onDoubleClick={() => handleRowDoubleClick(itemId, item.type)}
                  onDragStart={(e) => handleItemDragStart(e, itemId, item.type)}
                  onDragEnd={handleItemDragEnd}
                  {...(isFolder ? {
                    onDragOver: (e) => handleFolderDragOver(e, itemId),
                    onDragLeave: (e) => handleFolderDragLeave(e, itemId),
                    onDrop: (e) => handleFolderDrop(e, itemId)
                  } : {})}
                  sx={{
                    cursor: draggedItems.has(itemId) ? 'grabbing' : 'pointer',
                    userSelect: 'none',
                    opacity: draggedItems.has(itemId) ? 0.5 : 1,
                    ...(isFolder && dragTargetFolderId === itemId ? {
                      bgcolor: 'action.hover',
                      border: `2px dashed ${theme.palette.primary.main}`
                    } : {})
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {isFolder ? (
                        <FolderIcon color="action" sx={{ mr: 1.5 }} />
                      ) : (
                        <ArticleIcon color="action" sx={{ mr: 1.5 }} />
                      )}
                      {itemName}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {isFolder ? (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {formatBytes((item as DocumentSummary).contentSize)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatRelativeDate(item.updatedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {isFolder ? (
                      '-'
                    ) : (
                      <Chip
                        label={(item as DocumentSummary).lastModifiedBy || strings.workspace.ownerLabel}
                        size="small"
                        variant="outlined"
                        sx={{ borderRadius: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(event) => handleMenuOpen(event, {
                        id: itemId,
                        name: itemName,
                        type: item.type,
                        ...(item.type === 'document' ? { title: (item as DocumentSummary).title } : {})
                      })}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
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
    <Container
      maxWidth="xl"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        position: 'relative',
        '&::after': isDragging ? {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
          border: '2px dashed #1976d2',
          borderRadius: 2,
          zIndex: 10,
          pointerEvents: 'none'
        } : {}
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".odocs"
        multiple
        onChange={handleFileUpload}
      />
      <Dialog open={notFoundError}>
        <DialogTitle>{strings.dashboard.noWorkspacesFound || 'Workspace Not Found'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {strings.dashboard.workspaceNotFoundDetail || 'The workspace you are trying to access does not exist or you do not have permission to view it.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate('/')} variant="contained" autoFocus>
            {strings.settings.global.backToDashboard || 'Back to Dashboard'}
          </Button>
        </DialogActions>
      </Dialog>
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

            // Extract folder ID from path for drop handling
            const pathMatch = item.path.match(/folderId=([^&]+)/);
            const breadcrumbFolderId = pathMatch ? pathMatch[1] : null;
            const isDropTarget = dragOverBreadcrumbIndex === index;

            return isLast ? (
              <Typography
                color="text.primary"
                fontWeight="600"
                key={item.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 1,
                  ...(isDropTarget ? {
                    bgcolor: 'action.hover',
                    border: `2px dashed ${theme.palette.primary.main}`
                  } : {})
                }}
                title={item.fullName}
                onDragOver={(e) => handleBreadcrumbDragOver(e, index, breadcrumbFolderId)}
                onDragLeave={(e) => handleBreadcrumbDragLeave(e, index)}
                onDrop={(e) => handleBreadcrumbDrop(e, breadcrumbFolderId)}
              >
                {item.icon}
                {item.name}
              </Typography>
            ) : (
              <Link
                component={RouterLink}
                underline="hover"
                color="inherit"
                to={item.path}
                key={item.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px 8px',
                  borderRadius: 1,
                  ...(isDropTarget ? {
                    bgcolor: 'action.hover',
                    border: `2px dashed ${theme.palette.primary.main}`
                  } : {})
                }}
                title={item.fullName}
                onDragOver={(e) => handleBreadcrumbDragOver(e, index, breadcrumbFolderId)}
                onDragLeave={(e) => handleBreadcrumbDragLeave(e, index)}
                onDrop={(e) => handleBreadcrumbDrop(e, breadcrumbFolderId)}
              >
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
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
            {strings.workspace.upload || 'Upload'}
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
        <Box sx={{ height: 60, display: 'flex', alignItems: 'center', mb: 2 }}>
          <SelectionToolbar
            selectedCount={selectedItems.size}
            hasDocuments={selectedItemsData.hasDocuments}
            onDelete={handleBulkDelete}
            onClearSelection={handleClearSelection}
            onStar={handleStar}
            onPublish={handlePublish}
            onSelectAll={handleSelectAll}
          />
        </Box>
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
        {selectedItem?.type === 'document' && (
          <MenuItem onClick={handleShareClick}>{strings.editor.title.share || 'Share'}</MenuItem>
        )}
        {selectedItem?.type === 'document' && (
          <MenuItem onClick={handleDownloadClick}>Download</MenuItem>
        )}
        <MenuItem onClick={handleRenameClick}>{strings.workspace.rename}</MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>{strings.workspace.delete}</MenuItem>
      </Menu>

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

      {selectedItem?.type === 'document' && selectedItem.id && (
        <ShareDialog
          open={shareDialogOpen}
          onClose={() => {
            setShareDialogOpen(false);
            setSelectedItem(null);
          }}
          documentId={selectedItem.id}
        />
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity="info" sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container >
  );
};

export default WorkspacePage;
