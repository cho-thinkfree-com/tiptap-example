import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Alert,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    TableSortLabel,
} from '@mui/material';
import {
    Add as AddIcon,
    Folder as FolderIcon,
    InsertDriveFile as FileIcon,
    CreateNewFolder as CreateNewFolderIcon,
    UploadFile as UploadFileIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Share as ShareIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';
import CollapsibleBreadcrumbs from '../../components/workspace/CollapsibleBreadcrumbs';
import {
    getWorkspace,
    getWorkspaceFiles,
    getFileSystemEntry,
    createFolder,
    createDocument,
    deleteFileSystemEntry,
    renameFileSystemEntry,
    toggleFileStar,
    restoreFileSystemEntry,
    getFileAncestors,
    type FileSystemEntry,
    type WorkspaceSummary,
} from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import CreateFolderDialog from '../../components/workspace/CreateFolderDialog';
import RenameDialog from '../../components/workspace/RenameDialog';
import ShareDialog from '../../components/editor/ShareDialog';
import FileShareIndicator from '../../components/workspace/FileShareIndicator';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import { useFileEvents } from '../../hooks/useFileEvents';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';

const WorkspaceFilesPage = () => {
    const { strings } = useI18n();
    const { workspaceId, folderId: paramFolderId } = useParams<{ workspaceId: string; folderId?: string }>();
    const [searchParams] = useSearchParams();
    const queryFolderId = searchParams.get('folderId');
    const folderId = paramFolderId || queryFolderId;
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
    const [items, setItems] = useState<FileSystemEntry[]>([]);
    const [currentFolder, setCurrentFolder] = useState<FileSystemEntry | null>(null);
    const [ancestors, setAncestors] = useState<FileSystemEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Dialogs
    const [createFolderOpen, setCreateFolderOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<FileSystemEntry | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [showUndo, setShowUndo] = useState(false);
    const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
    const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
    const [orderBy, setOrderBy] = useState<'name' | 'updatedAt' | 'size'>('name');
    const [order, setOrder] = useState<'asc' | 'desc'>('asc');

    // Context menu
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        item: FileSystemEntry;
    } | null>(null);

    const fetchData = useCallback(async () => {
        if (!isAuthenticated || !workspaceId) return;

        setLoading(true);
        setError(null);

        try {
            const [workspaceData, itemsData, folderData, ancestorsData] = await Promise.all([
                getWorkspace(workspaceId),
                getWorkspaceFiles(workspaceId, folderId || null),
                folderId ? getFileSystemEntry(folderId) : Promise.resolve(null),
                folderId ? getFileAncestors(folderId) : Promise.resolve([]),
            ]);

            setWorkspace(workspaceData);
            setItems(itemsData);
            setCurrentFolder(folderData);

            if (folderData) {
                setAncestors(ancestorsData);
            } else {
                setAncestors([]);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load workspace');
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, workspaceId, folderId]);

    // Drag and drop
    const {
        draggedItemIds,
        dragOverId,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    } = useDragAndDrop({
        onMoveComplete: fetchData,
        onMoveError: (error) => alert('Failed to move: ' + error.message),
    });

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Clear selection when folder changes
    useEffect(() => {
        setSelectedIds(new Set());
        setLastSelectedId(null);
    }, [folderId]);

    // Real-time file events via WebSocket
    useFileEvents({
        workspaceId,
        onFileCreated: (event) => {
            // Only add if the file is in the current folder
            if (event.file.parentId === (folderId || null)) {
                setItems((prevItems) => {
                    // Check if file already exists (防止重복)
                    if (prevItems.some((item) => item.id === event.file.id)) {
                        return prevItems;
                    }
                    return [...prevItems, event.file];
                });
            }
        },
        onFileUpdated: (event) => {
            setItems((prevItems) => {
                // Find the file in current list
                const fileIndex = prevItems.findIndex((item) => item.id === event.fileId);

                // Handle Move operation
                if (event.oldParentId !== undefined && event.newParentId !== undefined) {
                    const currentFolderId = folderId || null;

                    // File moved OUT of current folder
                    if (event.oldParentId === currentFolderId && event.newParentId !== currentFolderId) {
                        return prevItems.filter((item) => item.id !== event.fileId);
                    }

                    // File moved INTO current folder (need to fetch full data)
                    if (event.oldParentId !== currentFolderId && event.newParentId === currentFolderId) {
                        // Trigger re-fetch to get the full file object
                        fetchData();
                        return prevItems;
                    }
                }

                // Update existing file in list
                if (fileIndex !== -1) {
                    const updatedItems = [...prevItems];
                    updatedItems[fileIndex] = {
                        ...updatedItems[fileIndex],
                        ...event.updates,
                    };
                    return updatedItems;
                }

                return prevItems;
            });
        },
        onFileDeleted: (event) => {
            setItems((prevItems) => prevItems.filter((item) => item.id !== event.fileId));
        },
        onFileRestored: (event) => {
            // If restored to current folder, add it
            if (event.file.parentId === (folderId || null)) {
                setItems((prevItems) => {
                    // Check if file already exists
                    if (prevItems.some((item) => item.id === event.file.id)) {
                        return prevItems;
                    }
                    return [...prevItems, event.file];
                });
            }
        },
    });

    const handleCreateFolder = async (name: string) => {
        if (!workspaceId) return;

        try {
            const existingNames = new Set(items.map(i => i.name));
            let uniqueName = name;
            let counter = 1;
            while (existingNames.has(uniqueName)) {
                uniqueName = `${name} (${counter})`;
                counter++;
            }

            await createFolder(workspaceId, uniqueName, folderId || undefined);
            setCreateFolderOpen(false);
            fetchData();
        } catch (err: any) {
            alert('Failed to create folder: ' + err.message);
        }
    };

    const handleCreateDocument = async () => {
        if (!workspaceId) return;

        try {
            const existingNames = new Set(items.map(i => i.name));
            let name = 'Untitled Document';
            let counter = 1;
            while (existingNames.has(name)) {
                name = `Untitled Document (${counter})`;
                counter++;
            }

            const doc = await createDocument(
                workspaceId,
                name,
                { type: 'doc', content: [] },
                folderId || undefined
            );
            // Open the document in editor
            window.open(`/document/${doc.id}`, '_blank');
        } catch (err: any) {
            alert('Failed to create document: ' + err.message);
        }
    };

    const handleRowClick = (event: React.MouseEvent, item: FileSystemEntry) => {
        if (event.shiftKey && lastSelectedId) {
            const currentIndex = items.findIndex(i => i.id === item.id);
            const lastIndex = items.findIndex(i => i.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const range = items.slice(start, end + 1);

                const newSelected = new Set(selectedIds);
                range.forEach(i => newSelected.add(i.id));
                setSelectedIds(newSelected);
            }
        } else if (event.ctrlKey || event.metaKey) {
            const newSelected = new Set(selectedIds);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
            } else {
                newSelected.add(item.id);
                setLastSelectedId(item.id);
            }
            setSelectedIds(newSelected);
        } else {
            setSelectedIds(new Set([item.id]));
            setLastSelectedId(item.id);
        }
    };

    const handleRowDoubleClick = (item: FileSystemEntry) => {
        if (item.type === 'folder') {
            navigate(`/workspace/${workspaceId}/folder/${item.id}`);
        } else if (item.mimeType === 'application/x-odocs') {
            window.open(`/document/${item.id}`, '_blank');
        } else {
            // Download file
            window.open(`/api/files/${item.id}/download`, '_blank');
        }
    };

    const handleContextMenu = (event: React.MouseEvent, item: FileSystemEntry) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
            item,
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            window.addEventListener('click', handleClick);
            window.addEventListener('contextmenu', handleClick);
        }
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('contextmenu', handleClick);
        };
    }, [contextMenu]);


    const handleRename = () => {
        if (contextMenu) {
            setSelectedItem(contextMenu.item);
            setRenameDialogOpen(true);
        }
        handleCloseContextMenu();
    };

    const handleShare = () => {
        if (contextMenu) {
            setSelectedItem(contextMenu.item);
            setShareDialogOpen(true);
        }
        handleCloseContextMenu();
    };

    const selectedItemsList = items.filter(i => selectedIds.has(i.id));

    const handleBulkStar = async () => {
        try {
            const allStarred = selectedItemsList.every(i => i.isStarred);
            const targetIsStarred = !allStarred;

            const promises = selectedItemsList.map(item => {
                if (item.isStarred !== targetIsStarred) {
                    return toggleFileStar(item.id);
                }
                return Promise.resolve();
            });

            await Promise.all(promises);
            fetchData();
        } catch (err: any) {
            alert('Failed to update star status: ' + err.message);
        }
    };

    const handleUndo = async () => {
        if (undoTimer) clearTimeout(undoTimer);
        setShowUndo(false);
        try {
            await Promise.all(deletedItemIds.map(id => restoreFileSystemEntry(id)));
            setDeletedItemIds([]);
            fetchData();
        } catch (err: any) {
            alert('Failed to undo delete: ' + err.message);
        }
    };

    const handleBulkDelete = async () => {
        const idsToDelete = Array.from(selectedIds);
        try {
            await Promise.all(idsToDelete.map(id => deleteFileSystemEntry(id)));

            setDeletedItemIds(idsToDelete);
            setShowUndo(true);
            setSelectedIds(new Set());
            fetchData();

            if (undoTimer) clearTimeout(undoTimer);
            const timer = setTimeout(() => {
                setShowUndo(false);
                setDeletedItemIds([]);
            }, 5000);
            setUndoTimer(timer);
        } catch (err: any) {
            alert('Failed to delete items: ' + err.message);
        }
    };

    // Keyboard shortcuts and Undo logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2' && selectedIds.size === 1) {
                e.preventDefault();
                const id = Array.from(selectedIds)[0];
                const item = items.find(i => i.id === id);
                if (item) {
                    setSelectedItem(item);
                    setRenameDialogOpen(true);
                }
            } else if (e.key === 'Delete' && selectedIds.size > 0) {
                e.preventDefault();
                handleBulkDelete();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, items]);

    useEffect(() => {
        if (selectedIds.size > 0) {
            setShowUndo(false);
            if (undoTimer) clearTimeout(undoTimer);
        }
    }, [selectedIds, undoTimer]);

    const handleRenameSubmit = async (newName: string) => {
        if (!selectedItem) return;

        try {
            await renameFileSystemEntry(selectedItem.id, newName);
            setRenameDialogOpen(false);
            setSelectedItem(null);
            fetchData();
        } catch (err: any) {
            alert('Failed to rename: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!contextMenu) return;

        try {
            await deleteFileSystemEntry(contextMenu.item.id);
            handleCloseContextMenu();
            fetchData();
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    };

    const handleToggleStar = async () => {
        if (!contextMenu) return;

        try {
            await toggleFileStar(contextMenu.item.id);
            handleCloseContextMenu();
            fetchData();
        } catch (err: any) {
            alert('Failed to toggle star: ' + err.message);
        }
    };

    const handleDownload = async () => {
        if (!contextMenu) return;

        const item = contextMenu.item;

        // Use API_BASE_URL to ensure request goes to backend server (9920), not frontend (9910)
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9920';

        try {
            // Get download URL from backend (with authentication)
            const response = await fetch(`${API_BASE_URL}/api/files/${item.id}/download`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Download failed: ${response.statusText}`);
            }

            const data = await response.json();

            // Download from S3 presigned URL (no authentication needed)
            const downloadResponse = await fetch(data.downloadUrl);

            if (!downloadResponse.ok) {
                throw new Error(`Download failed: ${downloadResponse.statusText}`);
            }

            // Get the blob
            const blob = await downloadResponse.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Set filename - ensure odocs files have .odocs extension
            let filename = item.name;
            if (item.mimeType === 'application/x-odocs' && !filename.endsWith('.odocs')) {
                filename += '.odocs';
            }
            link.download = filename;

            // Trigger download
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Failed to download file: ' + err.message);
        }

        handleCloseContextMenu();
    };

    const formatBytes = (bytes?: string | null) => {
        if (!bytes) return '-';
        const numBytes = parseInt(bytes, 10);
        if (numBytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(numBytes) / Math.log(1024)), units.length - 1);
        const value = numBytes / Math.pow(1024, i);
        return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
    };

    const handleRequestSort = (property: 'name' | 'updatedAt' | 'size') => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    // Sort items: folders first, then documents, then files, all sorted by selected column
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            // Type priority: folder < document < file
            const getTypePriority = (item: FileSystemEntry) => {
                if (item.type === 'folder') return 0;
                if (item.mimeType === 'application/x-odocs') return 1;
                return 2;
            };

            const aPriority = getTypePriority(a);
            const bPriority = getTypePriority(b);

            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }

            // Within same type, sort by selected column
            let comparison = 0;

            if (orderBy === 'name') {
                comparison = a.name.localeCompare(b.name);
            } else if (orderBy === 'size') {
                const aSize = parseInt(a.size || '0');
                const bSize = parseInt(b.size || '0');
                comparison = aSize - bSize;
            } else if (orderBy === 'updatedAt') {
                comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            }

            return order === 'asc' ? comparison : -comparison;
        });
    }, [items, orderBy, order]);

    if (loading) {
        return (
            <Container sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (error) {
        return (
            <Container sx={{ py: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    const folders = sortedItems.filter((i) => i.type === 'folder');
    const documents = sortedItems.filter((i) => i.type === 'file' && i.mimeType === 'application/x-odocs');
    const files = sortedItems.filter((i) => i.type === 'file' && i.mimeType !== 'application/x-odocs');

    return (
        <Container maxWidth="xl">
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                {/* Breadcrumbs */}
                <CollapsibleBreadcrumbs
                    ancestors={ancestors}
                    currentFolder={currentFolder}
                    onNavigate={(folderId) => {
                        if (folderId) {
                            navigate(`/workspace/${workspaceId}/folder/${folderId}`);
                        } else {
                            navigate(`/workspace/${workspaceId}/files`);
                        }
                    }}
                    dragOverId={dragOverId}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    items={items as Array<{ id: string; type: string; parentId: string | null }>}
                    selectedIds={selectedIds}
                />

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleCreateDocument}
                        size="small"
                    >
                        New Document
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<CreateNewFolderIcon />}
                        onClick={() => setCreateFolderOpen(true)}
                        size="small"
                    >
                        New Folder
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => alert('File upload not implemented yet')}
                        size="small"
                    >
                        Upload
                    </Button>
                </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    {currentFolder ? currentFolder.name : 'Files'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {currentFolder ? 'Manage files in this folder.' : 'Manage all files and folders in your workspace.'}
                </Typography>

                {/* Selection Toolbar (Reserved Space) */}
                <Box sx={{ height: 32, display: 'flex', alignItems: 'center', mb: 2 }}>
                    {selectedIds.size > 0 ? (
                        <SelectionToolbar
                            selectedCount={selectedIds.size}
                            hasDocuments={true}
                            hasPublicLinks={false}
                            onDelete={handleBulkDelete}
                            onClearSelection={() => setSelectedIds(new Set())}
                            onStar={handleBulkStar}
                            onSelectAll={() => setSelectedIds(new Set(items.map(i => i.id)))}
                            showDelete={true}
                            showStar={true}
                        />
                    ) : showUndo ? (
                        <Paper
                            elevation={0}
                            sx={{
                                width: '100%',
                                px: 2,
                                py: 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                bgcolor: 'grey.300',
                                border: '1px solid',
                                borderColor: 'grey.500',
                                borderRadius: 1,
                            }}
                        >
                            <Box sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                                Deleted {deletedItemIds.length} {deletedItemIds.length === 1 ? 'item' : 'items'}
                            </Box>
                            <Box sx={{ flexGrow: 1 }} />
                            <Button
                                size="small"
                                onClick={handleUndo}
                                variant="text"
                                sx={{ fontWeight: 600 }}
                            >
                                Undo
                            </Button>
                        </Paper>
                    ) : null}
                </Box>

                {/* Files Table */}
                {items.length === 0 ? (
                    <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                        <Typography color="text.secondary">
                            This folder is empty. Create a document or folder to get started.
                        </Typography>
                    </Paper>
                ) : (
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
                                            Name
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell width="20%">
                                        <TableSortLabel
                                            active={orderBy === 'updatedAt'}
                                            direction={orderBy === 'updatedAt' ? order : 'asc'}
                                            onClick={() => handleRequestSort('updatedAt')}
                                        >
                                            Modified
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell width="15%">
                                        <TableSortLabel
                                            active={orderBy === 'size'}
                                            direction={orderBy === 'size' ? order : 'asc'}
                                            onClick={() => handleRequestSort('size')}
                                        >
                                            Size
                                        </TableSortLabel>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {/* Folders first */}
                                {folders.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        hover
                                        selected={selectedIds.has(item.id)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id, selectedIds)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => handleDragOver(e, item.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, item.id, items as Array<{ id: string; type: string; parentId: string | null }>, selectedIds)}
                                        sx={{
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            opacity: draggedItemIds.includes(item.id) ? 0.5 : 1,
                                            bgcolor: dragOverId === item.id ? 'action.hover' : 'inherit',
                                            borderLeft: dragOverId === item.id ? '3px solid' : '3px solid transparent',
                                            borderColor: dragOverId === item.id ? 'primary.main' : 'transparent',
                                            transition: 'all 0.2s',
                                        }}
                                        onClick={(e) => handleRowClick(e, item)}
                                        onDoubleClick={() => handleRowDoubleClick(item)}
                                        onContextMenu={(e) => handleContextMenu(e, item)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FolderIcon color="action" />
                                                {item.name}
                                                {item.isStarred && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatRelativeDate(item.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                -
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Documents */}
                                {documents.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        hover
                                        selected={selectedIds.has(item.id)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id, selectedIds)}
                                        onDragEnd={handleDragEnd}
                                        sx={{
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            opacity: draggedItemIds.includes(item.id) ? 0.5 : 1,
                                            transition: 'opacity 0.2s',
                                        }}
                                        onClick={(e) => handleRowClick(e, item)}
                                        onDoubleClick={() => handleRowDoubleClick(item)}
                                        onContextMenu={(e) => handleContextMenu(e, item)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FileIcon color="primary" />
                                                {item.name}
                                                {item.isStarred && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                                                <FileShareIndicator fileId={item.id} shareLinks={item.shareLinks} />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatRelativeDate(item.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatBytes(item.size)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {/* Other files */}
                                {files.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        hover
                                        selected={selectedIds.has(item.id)}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, item.id, selectedIds)}
                                        onDragEnd={handleDragEnd}
                                        sx={{
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            opacity: draggedItemIds.includes(item.id) ? 0.5 : 1,
                                            transition: 'opacity 0.2s',
                                        }}
                                        onClick={(e) => handleRowClick(e, item)}
                                        onDoubleClick={() => handleRowDoubleClick(item)}
                                        onContextMenu={(e) => handleContextMenu(e, item)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <FileIcon color="action" />
                                                {item.name}
                                                {item.isStarred && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                                                <FileShareIndicator fileId={item.id} shareLinks={item.shareLinks} />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatRelativeDate(item.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatBytes(item.size)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                slotProps={{
                    root: { sx: { pointerEvents: 'none' } },
                    paper: { sx: { pointerEvents: 'auto' } },
                }}
                hideBackdrop
            >
                {contextMenu?.item.type === 'file' && (
                    <MenuItem onClick={handleDownload}>
                        <ListItemIcon>
                            <DownloadIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Download</ListItemText>
                    </MenuItem>
                )}
                <MenuItem onClick={handleShare}>
                    <ListItemIcon>
                        <ShareIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{strings.editor.title.share || 'Share'}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleRename}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{strings.workspace.rename}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleToggleStar}>
                    <ListItemIcon>
                        {contextMenu?.item.isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>{contextMenu?.item.isStarred ? 'Unstar' : 'Star'}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{strings.workspace.delete}</ListItemText>
                </MenuItem>
            </Menu>

            <ShareDialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                documentId={selectedItem?.id || ''}
                document={selectedItem as any}
            />

            {/* Dialogs */}
            <CreateFolderDialog
                open={createFolderOpen}
                onClose={() => setCreateFolderOpen(false)}
                onCreate={handleCreateFolder}
            />

            <RenameDialog
                open={renameDialogOpen}
                onClose={() => {
                    setRenameDialogOpen(false);
                    setSelectedItem(null);
                }}
                currentName={selectedItem?.name || ''}
                onRename={handleRenameSubmit}
                itemType={selectedItem?.type === 'folder' ? 'folder' : 'file'}
            />
        </Container>
    );
};

export default WorkspaceFilesPage;
