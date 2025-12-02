import { Alert, Box, Breadcrumbs, CircularProgress, Container, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStarredFiles, type FileSystemEntry, deleteFileSystemEntry, toggleFileStar } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FileIcon from '@mui/icons-material/InsertDriveFile';
import FolderIcon from '@mui/icons-material/Folder';
import StarIcon from '@mui/icons-material/Star';
import { usePageTitle } from '../../hooks/usePageTitle';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import FileShareIndicator from '../../components/workspace/FileShareIndicator';
import { useNavigate } from 'react-router-dom';
import { useFileEvents } from '../../hooks/useFileEvents';

const ImportantFilesPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<FileSystemEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    usePageTitle('Important Files');

    const formatBytes = (bytes?: string | null) => {
        if (!bytes) return '-';
        const numBytes = parseInt(bytes, 10);
        if (numBytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(numBytes) / Math.log(1024)), units.length - 1);
        const value = numBytes / Math.pow(1024, i);
        return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
    };

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    const fetchData = async () => {
        if (!isAuthenticated || !workspaceId) return;
        setLoading(true);
        try {
            const starredItems = await getStarredFiles(workspaceId);
            setItems(starredItems);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isAuthenticated, workspaceId]);

    // Real-time file events via WebSocket - handle star/unstar
    useFileEvents({
        workspaceId,
        onFileUpdated: (event) => {
            // Check if isStarred changed
            if (event.updates.isStarred !== undefined) {
                if (event.updates.isStarred) {
                    // File was starred - fetch to add to list (or re-fetch all)
                    fetchData();
                } else {
                    // File was unstarred - remove from list
                    setItems((prevItems) => prevItems.filter((item) => item.id !== event.fileId));
                }
            } else {
                // Other updates (like name, size, etc.) - update the item
                setItems((prevItems) => {
                    const index = prevItems.findIndex((item) => item.id === event.fileId);
                    if (index !== -1) {
                        const updated = [...prevItems];
                        updated[index] = { ...updated[index], ...event.updates };
                        return updated;
                    }
                    return prevItems;
                });
            }
        },
        onFileDeleted: (event) => {
            // Remove deleted file from list
            setItems((prevItems) => prevItems.filter((item) => item.id !== event.fileId));
        },
    });

    const handleRowClick = (event: React.MouseEvent, item: FileSystemEntry) => {
        if (event.shiftKey && lastSelectedId) {
            const currentIndex = items.findIndex(i => i.id === item.id);
            const lastIndex = items.findIndex(i => i.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const range = items.slice(start, end + 1);

                const newSelected = new Set(selectedItems);
                range.forEach(i => newSelected.add(i.id));
                setSelectedItems(newSelected);
            }
        } else if (event.ctrlKey || event.metaKey) {
            const newSelected = new Set(selectedItems);
            if (newSelected.has(item.id)) {
                newSelected.delete(item.id);
            } else {
                newSelected.add(item.id);
                setLastSelectedId(item.id);
            }
            setSelectedItems(newSelected);
        } else {
            setSelectedItems(new Set([item.id]));
            setLastSelectedId(item.id);
        }
    };

    const handleRowDoubleClick = (item: FileSystemEntry) => {
        if (item.type === 'folder') {
            navigate(`/workspace/${workspaceId}?folderId=${item.id}`);
        } else if (item.mimeType === 'application/x-odocs') {
            window.open(`/document/${item.id}`, '_blank');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedItems.size} items?`)) return;
        try {
            await Promise.all(Array.from(selectedItems).map(id => deleteFileSystemEntry(id)));
            setSelectedItems(new Set());
            fetchData();
        } catch (err: any) {
            alert('Failed to delete items: ' + err.message);
        }
    };

    const handleBulkStar = async () => {
        const selectedFiles = items.filter(f => selectedItems.has(f.id));
        const allStarred = selectedFiles.every(f => f.isStarred);
        try {
            await Promise.all(selectedFiles.map(f => {
                if (f.isStarred === allStarred) {
                    return toggleFileStar(f.id);
                }
                return Promise.resolve();
            }));
            fetchData();
        } catch (err: any) {
            alert('Failed to star items: ' + err.message);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="xl" sx={{ py: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, height: 40 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} underline="hover" color="inherit" to={`/workspace/${workspaceId}/files`} sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Files
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        Important Files
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    ⭐ Important Files
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Star your favorite folders and documents to find them here.
                </Typography>
                <Box sx={{ height: 32, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SelectionToolbar
                        selectedCount={selectedItems.size}
                        hasDocuments={true}
                        onDelete={handleBulkDelete}
                        onClearSelection={() => setSelectedItems(new Set())}
                        onStar={handleBulkStar}
                        onSelectAll={() => setSelectedItems(new Set(items.map(i => i.id)))}
                        showDelete={false}
                    />
                </Box>

                {items.length === 0 ? (
                    <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                        <Typography color="text.secondary">
                            No starred items yet. Star your favorite folders and documents to find them here.
                        </Typography>
                    </Paper>
                ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width="40%">Name</TableCell>
                                    <TableCell width="20%">Modified</TableCell>
                                    <TableCell width="15%">Size</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        hover
                                        selected={selectedItems.has(item.id)}
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={(e) => handleRowClick(e, item)}
                                        onDoubleClick={() => handleRowDoubleClick(item)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {item.type === 'folder' ? (
                                                    <FolderIcon color="action" />
                                                ) : (
                                                    <FileIcon color={item.mimeType === 'application/x-odocs' ? 'primary' : 'action'} />
                                                )}
                                                {item.name}
                                                <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                                {item.type === 'file' && <FileShareIndicator fileId={item.id} shareLinks={item.shareLinks} />}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatRelativeDate(item.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {item.type === 'folder' ? '-' : formatBytes(item.size)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Container>
    );
};

export default ImportantFilesPage;
