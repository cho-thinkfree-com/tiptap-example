import { Alert, Box, Breadcrumbs, CircularProgress, Container, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Snackbar, TableSortLabel } from '@mui/material';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPublicDocuments, type DocumentSummary, toggleDocumentStarred } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import { generateShareUrl } from '../../lib/shareUtils';
import HomeIcon from '@mui/icons-material/Home';

import StarIcon from '@mui/icons-material/Star';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useI18n } from '../../lib/i18n';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import FileShareIndicator from '../../components/workspace/FileShareIndicator';
import { useFileEvents } from '../../hooks/useFileEvents';

const SharedFilesPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const { isAuthenticated } = useAuth();
    // const navigate = useNavigate();
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    // Sorting state
    const [orderBy, setOrderBy] = useState<keyof DocumentSummary>('createdAt');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    const handleRequestSort = (property: keyof DocumentSummary) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };



    usePageTitle('Shared Files');

    const formatBytes = (bytes?: number) => {
        if (bytes === undefined || bytes === null) return '-';
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        const value = bytes / Math.pow(1024, i);
        return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
    };

    const handleRowClick = (itemId: string, event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest('a, button, input')) {
            return;
        }

        if (event.shiftKey) {
            event.preventDefault();
        }

        const newSelected = new Set(selectedItems);

        if (event.shiftKey && lastSelectedId) {
            const allIds = documents.map(d => d.id);
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
            if (newSelected.has(itemId)) {
                newSelected.delete(itemId);
            } else {
                newSelected.add(itemId);
            }
        } else {
            newSelected.clear();
            newSelected.add(itemId);
        }

        setSelectedItems(newSelected);
        setLastSelectedId(itemId);
    };

    const handleRowDoubleClick = (itemId: string) => {
        setSelectedItems(new Set());
        window.open(`/document/${itemId}`, '_blank');
    };



    const fetchDocuments = useCallback(async () => {
        if (!isAuthenticated || !workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const docs = await getPublicDocuments(workspaceId);
            setDocuments(docs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, workspaceId, orderBy, order]);

    const handleStar = async () => {
        if (!isAuthenticated) return;

        const itemsToStar = Array.from(selectedItems);

        // Check if all selected items are already starred
        let allStarred = true;
        for (const itemId of itemsToStar) {
            const doc = documents.find(d => d.id === itemId);
            if (doc && !doc.isStarred) {
                allStarred = false;
                break;
            }
        }

        const newImportantStatus = !allStarred;

        try {
            await Promise.all(itemsToStar.map(async (itemId) => {
                const doc = documents.find(d => d.id === itemId);
                if (doc && doc.isStarred !== newImportantStatus) {
                    await toggleDocumentStarred(doc.id);
                }
            }));

            fetchDocuments();
            setSnackbar({
                open: true,
                message: newImportantStatus ? 'Added to Starred' : 'Removed from Starred',
                severity: 'success'
            });
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handlePublish = async () => {
        const selectedDocs = documents.filter(d => selectedItems.has(d.id));

        if (selectedDocs.length === 0) {
            return;
        }

        try {
            const links = await Promise.all(
                selectedDocs.map(async (doc) => {
                    const shareLinks = doc.shareLinks || [];
                    const activeLink = shareLinks.find(l => !l.revokedAt);
                    if (activeLink) {
                        const url = generateShareUrl(activeLink.token, doc.name);
                        return `${doc.name}\n${url}`;
                    }
                    return null;
                })
            );

            const validLinks = links.filter(l => l !== null).join('\n\n');
            if (validLinks) {
                await navigator.clipboard.writeText(validLinks);
                setSnackbar({
                    open: true,
                    message: `Copied ${selectedDocs.length} link(s)`,
                    severity: 'success'
                });
            }
        } catch (err) {
            console.error('Failed to copy links:', err);
            setSnackbar({
                open: true,
                message: 'Failed to copy links',
                severity: 'error'
            });
        }
    };

    const handleDelete = () => {
        // Delete is disabled for shared documents
    };

    const handleSelectAll = () => {
        if (selectedItems.size === documents.length && documents.length > 0) {
            setSelectedItems(new Set());
        } else {
            const newSelecteds = new Set(documents.map((n) => n.id));
            setSelectedItems(newSelecteds);
        }
    };

    // Sort documents by size on client side when sorting by size
    const sortedDocuments = useMemo(() => {
        if (orderBy === 'size') {
            return [...documents].sort((a, b) => {
                const aSize = parseInt(a.size || '0');
                const bSize = parseInt(b.size || '0');
                return order === 'asc' ? aSize - bSize : bSize - aSize;
            });
        }
        return documents;
    }, [documents, orderBy, order]);

    // All documents in this page are public, so hasPublicLinks is true when any are selected
    const hasPublicLinks = useMemo(() => {
        return selectedItems.size > 0;
    }, [selectedItems]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedItems(new Set(documents.map(d => d.id)));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [documents]);

    // Real-time file events via WebSocket
    useFileEvents({
        workspaceId,
        onFileCreated: (event) => {
            // If a new file with shareLinks is created, refetch
            if (event.file.shareLinks && event.file.shareLinks.length > 0) {
                fetchDocuments();
            }
        },
        onFileUpdated: (event) => {
            // Update the document's shareLinks in the list
            setDocuments((prevDocs) => {
                const index = prevDocs.findIndex((doc) => doc.id === event.fileId);
                if (index !== -1) {
                    const updated = [...prevDocs];
                    updated[index] = { ...updated[index], ...event.updates };

                    // If shareLinks are now empty or file is unpublished, remove from list
                    if (event.updates.shareLinks && event.updates.shareLinks.length === 0) {
                        return prevDocs.filter((doc) => doc.id !== event.fileId);
                    }

                    return updated;
                }
                // If file not in list but has shareLinks, refetch to add it
                if (event.updates.shareLinks && event.updates.shareLinks.length > 0) {
                    fetchDocuments();
                }
                return prevDocs;
            });
        },
        onFileDeleted: (event) => {
            // Remove from list if deleted
            setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== event.fileId));
        },
    });

    const renderDocuments = () => {
        if (loading) return <CircularProgress />;
        if (error) return <Alert severity="error">{error}</Alert>;

        if (documents.length === 0) {
            return (
                <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        공개된 문서가 없습니다.
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        문서를 공개하려면 문서의 공유 설정에서 "Publish to Web"을 선택하세요.
                    </Typography>
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
                                    Name
                                </TableSortLabel>
                            </TableCell>

                            <TableCell width="15%">
                                <TableSortLabel
                                    active={orderBy === 'updatedAt'}
                                    direction={orderBy === 'updatedAt' ? order : 'asc'}
                                    onClick={() => handleRequestSort('updatedAt')}
                                >
                                    Last Modified
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
                        {sortedDocuments.map((doc) => (
                            <TableRow
                                key={doc.id}
                                hover
                                selected={selectedItems.has(doc.id)}
                                onClick={(e) => handleRowClick(doc.id, e)}
                                onDoubleClick={() => handleRowDoubleClick(doc.id)}
                                sx={{ cursor: 'pointer', userSelect: 'none' }}
                            >
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                                    <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.updatedAt)}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">{formatBytes(parseInt(doc.size || '0'))}</Typography>
                                </TableCell>

                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer >
        );
    };

    return (
        <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, height: 40 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} underline="hover" color="inherit" to={`/workspace/${workspaceId}`} sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Files
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        공유 문서함
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    공유 문서함
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    공유 링크가 생성된 문서 목록입니다.
                </Typography>
                <Box sx={{ height: 32, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SelectionToolbar
                        selectedCount={selectedItems.size}
                        hasDocuments={true}
                        hasPublicLinks={hasPublicLinks}
                        onDelete={handleDelete}
                        onClearSelection={() => setSelectedItems(new Set())}
                        onStar={handleStar}
                        onPublish={handlePublish}
                        onSelectAll={handleSelectAll}
                        showDelete={false}
                    />
                </Box>
                {renderDocuments()}
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default SharedFilesPage;

