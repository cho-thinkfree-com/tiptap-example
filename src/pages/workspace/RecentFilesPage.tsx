import { Alert, Box, Breadcrumbs, CircularProgress, Container, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRecentDocuments, type FileSystemEntry, deleteFileSystemEntry, toggleFileStar } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StarIcon from '@mui/icons-material/Star';
import { usePageTitle } from '../../hooks/usePageTitle';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import FileShareIndicator from '../../components/workspace/FileShareIndicator';
import { useFileEvents } from '../../hooks/useFileEvents';

const RecentFilesPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { isAuthenticated } = useAuth();
    const [files, setFiles] = useState<FileSystemEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    usePageTitle('Recent Files');

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
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const recentDocs = await getRecentDocuments({});
            setFiles(recentDocs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [isAuthenticated]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedItems(new Set(files.map(f => f.id)));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [files]);

    // Real-time file events via WebSocket
    useFileEvents({
        onFileCreated: (event) => {
            // If it's a document in this workspace, refetch
            if (event.file.type === 'file' && event.file.mimeType === 'application/x-odocs' && event.file.workspaceId === workspaceId) {
                fetchData();
            }
        },
        onFileUpdated: (event) => {
            // Update items in list
            setFiles((prevFiles) => {
                const index = prevFiles.findIndex((f) => f.id === event.fileId);
                if (index !== -1) {
                    const updated = [...prevFiles];
                    updated[index] = { ...updated[index], ...event.updates };
                    return updated;
                }
                return prevFiles;
            });
        },
        onFileDeleted: (event) => {
            // Remove from list
            setFiles((prevFiles) => prevFiles.filter((f) => f.id !== event.fileId));
        },
    });

    const handleRowClick = (event: React.MouseEvent, item: FileSystemEntry) => {
        if (event.shiftKey && lastSelectedId) {
            const currentIndex = files.findIndex(i => i.id === item.id);
            const lastIndex = files.findIndex(i => i.id === lastSelectedId);

            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const range = files.slice(start, end + 1);

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
        window.open(`/workspace/${item.workspaceId}/files/${item.id}/edit`, '_blank');
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
        const selectedFiles = files.filter(f => selectedItems.has(f.id));
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

    // Filter to show only documents (.odocs files) from this workspace
    const documents = files.filter(f => f.type === 'file' && f.mimeType === 'application/x-odocs' && f.workspaceId === workspaceId);

    return (
        <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, height: 40 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} underline="hover" color="inherit" to={`/workspace/${workspaceId}/files`} sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Files
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        Recent Files
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    Recent Files
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Recently modified files in this workspace.
                </Typography>
                <Box sx={{ height: 32, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SelectionToolbar
                        selectedCount={selectedItems.size}
                        onClearSelection={() => setSelectedItems(new Set())}
                        onDelete={handleBulkDelete}
                        onStar={handleBulkStar}
                        onSelectAll={() => setSelectedItems(new Set(files.map(f => f.id)))}
                        hasDocuments={true}
                    />
                </Box>

                {documents.length === 0 ? (
                    <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                        <Typography color="text.secondary">
                            No recent files found.
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
                                {documents.map((doc) => (
                                    <TableRow
                                        key={doc.id}
                                        hover
                                        selected={selectedItems.has(doc.id)}
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                        onClick={(e) => handleRowClick(e, doc)}
                                        onDoubleClick={() => handleRowDoubleClick(doc)}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box
                                                    component="img"
                                                    src="/odocs-file-icon-small.png"
                                                    alt="document"
                                                    sx={{ width: 24, height: 24 }}
                                                />
                                                {doc.name}
                                                {doc.isStarred && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
                                                <FileShareIndicator fileId={doc.id} shareLinks={doc.shareLinks} />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatRelativeDate(doc.updatedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatBytes(doc.size)}
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

export default RecentFilesPage;
