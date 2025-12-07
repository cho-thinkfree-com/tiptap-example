import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    Divider,
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

    People as PeopleIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useUpload } from '../../context/UploadContext';
import { useI18n } from '../../lib/i18n';
import CollapsibleBreadcrumbs from '../../components/workspace/CollapsibleBreadcrumbs';
import {
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
    const { uploadFiles } = useUpload();
    const fileInputRef = useRef<HTMLInputElement>(null);


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

    // Drag and drop state for upload
    const [dragOver, setDragOver] = useState<string | null>(null);



    // Context menu
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        item: FileSystemEntry;
    } | null>(null);

    // Keep track of the last valid context menu item to prevent UI flickering during close animation
    const lastContextMenuItem = useRef<FileSystemEntry | null>(null);
    if (contextMenu?.item) {
        lastContextMenuItem.current = contextMenu.item;
    }

    const fetchData = useCallback(async () => {
        if (!isAuthenticated || !workspaceId) return;

        setLoading(true);
        setError(null);

        try {
            const [itemsData, folderData, ancestorsData] = await Promise.all([
                getWorkspaceFiles(workspaceId, folderId || null),
                folderId ? getFileSystemEntry(folderId) : Promise.resolve(null),
                folderId ? getFileAncestors(folderId) : Promise.resolve([]),
            ]);

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
                        // Remove from selection if selected
                        if (selectedIds.has(event.fileId)) {
                            setSelectedIds(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(event.fileId);
                                return newSet;
                            });
                        }
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
            // Remove from selection if selected
            if (selectedIds.has(event.fileId)) {
                setSelectedIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(event.fileId);
                    return newSet;
                });
            }
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
                name = `Untitled Document(${counter})`;
                counter++;
            }

            const doc = await createDocument(
                workspaceId,
                name,
                { type: 'doc', content: [] },
                folderId || undefined
            );
            // Open the document in editor
            window.open(`/workspace/${workspaceId}/files/${doc.id}/edit`, '_blank');
        } catch (err: any) {
            alert('Failed to create document: ' + err.message);
        }
    };

    const handleRowClick = (event: React.MouseEvent, item: FileSystemEntry) => {
        // Prevent default to avoid text selection
        event.preventDefault();

        if (event.shiftKey && lastSelectedId && items.length > 0) {
            // Shift+Click: Select range
            // IMPORTANT: Use display order (folders first, then documents)
            const sortedItems = [...items].sort((a, b) => {
                if (orderBy === 'name') {
                    return order === 'asc'
                        ? a.name.localeCompare(b.name)
                        : b.name.localeCompare(a.name);
                } else if (orderBy === 'updatedAt') {
                    const dateA = new Date(a.updatedAt).getTime();
                    const dateB = new Date(b.updatedAt).getTime();
                    return order === 'asc'
                        ? dateA - dateB
                        : dateB - dateA;
                } else if (orderBy === 'size') {
                    return order === 'asc'
                        ? (Number(a.size) || 0) - (Number(b.size) || 0)
                        : (Number(b.size) || 0) - (Number(a.size) || 0);
                }
                return 0;
            });
            const folders = sortedItems.filter((i) => i.type === 'folder');
            const documents = sortedItems.filter((i) => i.type !== 'folder');
            const displayItems = [...folders, ...documents];

            const currentIndex = displayItems.findIndex(i => i.id === item.id);
            const lastIndex = displayItems.findIndex(i => i.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = displayItems.slice(start, end + 1).map(i => i.id);

                setSelectedIds(new Set(rangeIds));
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click (Cmd+Click on Mac): Toggle selection
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(item.id)) {
                    newSet.delete(item.id);
                    // Don't update lastSelectedId when removing
                } else {
                    newSet.add(item.id);
                    // Only update lastSelectedId when adding
                    setLastSelectedId(item.id);
                }
                return newSet;
            });
        } else {
            // Normal click: Select only this item
            setSelectedIds(new Set([item.id]));
            setLastSelectedId(item.id);
        }
    };

    const handleRowDoubleClick = (item: FileSystemEntry) => {
        if (item.type === 'folder') {
            navigate(`/workspace/${workspaceId}/folder/${item.id}`);
        } else if (item.mimeType === 'application/x-odocs') {
            window.open(`/workspace/${workspaceId}/files/${item.id}/edit`, '_blank');
        } else {
            // Download file
            window.open(`/api/files/${item.id}/download`, '_blank');
        }
    };

    const handleContextMenu = (event: React.MouseEvent, item: FileSystemEntry) => {
        event.preventDefault();
        event.stopPropagation();

        // If the right-clicked item is not selected, select only that item
        if (!selectedIds.has(item.id)) {
            setSelectedIds(new Set([item.id]));
            setLastSelectedId(item.id);
        }

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

            // Remove deleted items from state instead of refreshing
            setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));

            // Auto-hide undo after 5 seconds
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
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedIds(new Set(items.map(i => i.id)));
            } else if (e.key === 'F2' && selectedIds.size === 1) {
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

        const itemId = selectedItem.id;

        try {
            await renameFileSystemEntry(itemId, newName);

            // Update item name in state instead of refreshing
            setItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, name: newName } : item
            ));

            setRenameDialogOpen(false);
            setSelectedItem(null);
        } catch (err: any) {
            alert('Failed to rename: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!contextMenu) return;

        // If multiple items are selected and the context menu item is one of them, delete all selected
        // Otherwise, delete only the context menu item
        const idsToDelete = selectedIds.size > 0 && selectedIds.has(contextMenu.item.id)
            ? Array.from(selectedIds)
            : [contextMenu.item.id];

        try {
            await Promise.all(idsToDelete.map(id => deleteFileSystemEntry(id)));

            // Remove deleted items from state instead of refreshing
            setItems(prev => prev.filter(item => !idsToDelete.includes(item.id)));

            if (selectedIds.size > 0) {
                setSelectedIds(new Set());
            }

            handleCloseContextMenu();
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    };

    const handleToggleStar = async () => {
        if (!contextMenu) return;

        const itemId = contextMenu.item.id;
        const currentStarred = contextMenu.item.isStarred;

        try {
            await toggleFileStar(itemId);

            // Update item's star status in state instead of refreshing
            setItems(prev => prev.map(item =>
                item.id === itemId ? { ...item, isStarred: !currentStarred } : item
            ));

            handleCloseContextMenu();
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

    // Drag and drop handlers for .odocs upload
    const handleDragOverUpload = (e: React.DragEvent, dropTarget: string) => {
        // Check if this is external files or internal drag
        const types = e.dataTransfer.types;
        const hasFiles = types.includes('Files');

        if (hasFiles) {
            // External file drag - prevent default and show feedback
            e.preventDefault();
            e.stopPropagation();
            setDragOver(dropTarget);
        }
        // If no files, let it bubble to existing handleDragOver for internal file move
    };

    const handleDragLeaveUpload = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);
    };

    const handleDropUpload = async (e: React.DragEvent, targetFolderId?: string) => {
        // Check if this is an external file drop (not internal drag&drop)
        const files = e.dataTransfer.files;

        if (files.length === 0) {
            // No files means this is internal drag&drop for moving files
            // Let the existing handleDrop handle it
            return;
        }

        // This is an external file drop, handle it and stop propagation
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);

        if (!workspaceId) return;

        // Pass all files to global upload context - it handles validation and error reporting
        uploadFiles(Array.from(files), workspaceId, targetFolderId || folderId || undefined);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0 && workspaceId) {
            uploadFiles(Array.from(files), workspaceId, folderId || undefined);
        }
        // Reset input
        if (event.target) {
            event.target.value = '';
        }
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
                    onDragOver={(e, folderId) => {
                        const hasFiles = e.dataTransfer.types.includes('Files');
                        if (hasFiles) {
                            // Prevent drop for external files
                            e.stopPropagation();
                            return;
                        }
                        handleDragOver(e, folderId);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e, targetFolderId, items, selectedIds) => {
                        const hasFiles = e.dataTransfer.files.length > 0;
                        if (hasFiles) {
                            // Prevent drop for external files
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                        handleDrop(e, targetFolderId, items, selectedIds);
                    }}
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
                        onClick={handleUploadClick}
                        size="small"
                    >
                        Upload
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        multiple
                        accept=".odocs"
                        onChange={handleFileChange}
                    />
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

                {/* Drop Zone Container */}
                <Box
                    onDragOver={(e) => {
                        // Support both external file upload and internal file move
                        const types = e.dataTransfer.types;
                        const hasFiles = types.includes('Files');

                        if (hasFiles) {
                            // External file drag
                            handleDragOverUpload(e, 'main');
                        } else {
                            // Internal file move
                            handleDragOver(e);
                        }
                    }}
                    onDragLeave={(e) => {
                        handleDragLeaveUpload(e);
                        handleDragLeave(e);
                    }}
                    onDrop={async (e) => {
                        const files = e.dataTransfer.files;

                        if (files.length > 0) {
                            // External file upload
                            await handleDropUpload(e, folderId || undefined);
                        } else {
                            // Internal file move
                            await handleDrop(e, folderId || null, items as Array<{ id: string; type: string; parentId: string | null }>, selectedIds);
                        }
                    }}
                    sx={{
                        position: 'relative',
                        backgroundColor: dragOver === 'main' ? 'action.hover' : 'transparent',
                        border: dragOver === 'main' ? '2px dashed' : '2px dashed transparent',
                        borderColor: dragOver === 'main' ? 'primary.main' : 'transparent',
                        transition: 'all 0.2s',
                        borderRadius: 1,
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 200,
                    }}
                >
                    {/* Files Table */}
                    {items.length === 0 ? (
                        <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography color="text.secondary">
                                This folder is empty. Create a document or folder to get started.
                            </Typography>
                        </Paper>
                    ) : (
                        <TableContainer component={Paper} variant="outlined" sx={{ border: 'none', flexGrow: 1 }}>
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
                                            onDragOver={(e) => {
                                                const types = e.dataTransfer.types;
                                                const hasFiles = types.includes('Files');

                                                if (hasFiles) {
                                                    // External file drag
                                                    handleDragOverUpload(e, item.id);
                                                } else {
                                                    // Internal file move  
                                                    handleDragOver(e, item.id);
                                                }
                                            }}
                                            onDragLeave={handleDragLeave}
                                            onDrop={async (e) => {
                                                const files = e.dataTransfer.files;

                                                if (files.length > 0) {
                                                    // External file upload to this folder
                                                    await handleDropUpload(e, item.id);
                                                } else {
                                                    // Internal file move
                                                    await handleDrop(e, item.id, items as Array<{ id: string; type: string; parentId: string | null }>, selectedIds);
                                                }
                                            }}
                                            sx={{
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                opacity: draggedItemIds.includes(item.id) ? 0.5 : 1,
                                                bgcolor: (dragOverId === item.id || dragOver === item.id) ? 'action.hover' : 'inherit',
                                                borderLeft: (dragOverId === item.id || dragOver === item.id) ? '3px solid' : '3px solid transparent',
                                                borderColor: (dragOverId === item.id || dragOver === item.id) ? 'primary.main' : 'transparent',
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
                                                    <Box
                                                        component="img"
                                                        src="/odocs-file-icon-small.png"
                                                        alt="document"
                                                        sx={{ width: 24, height: 24 }}
                                                    />
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
                {/* Rename - only for single selection */}
                <MenuItem onClick={handleRename} disabled={selectedIds.size > 1}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{strings.workspace.rename}</ListItemText>
                </MenuItem>

                {/* Share - only for single selection */}
                <MenuItem onClick={handleShare} disabled={selectedIds.size > 1}>
                    <ListItemIcon>
                        <ShareIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{strings.editor.title.share || 'Share'}</ListItemText>
                </MenuItem>

                {/* Collaborative Edit - only for .odocs files */}
                {contextMenu?.item.mimeType === 'application/x-odocs' && (
                    <MenuItem
                        onClick={() => {
                            if (contextMenu) {
                                window.open(`/workspace/${workspaceId}/files/${contextMenu.item.id}/edit?mode=collaboration`, '_blank');
                                handleCloseContextMenu();
                            }
                        }}
                        disabled={selectedIds.size > 1}
                    >
                        <ListItemIcon>
                            <PeopleIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Collaborative Edit</ListItemText>
                    </MenuItem>
                )}

                {/* Download - only for single selection and files only */}
                <MenuItem
                    onClick={handleDownload}
                    disabled={selectedIds.size > 1 || contextMenu?.item.type === 'folder'}
                >
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Download</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleToggleStar}>
                    <ListItemIcon>
                        {(contextMenu?.item || lastContextMenuItem.current)?.isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText>{(contextMenu?.item || lastContextMenuItem.current)?.isStarred ? 'Unstar' : 'Star'}</ListItemText>
                </MenuItem>
                {/* Delete - works for both single and multiple */}
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
                file={selectedItem || undefined}
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
