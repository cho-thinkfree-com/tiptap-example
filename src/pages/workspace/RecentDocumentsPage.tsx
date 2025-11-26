import { Alert, Box, Breadcrumbs, CircularProgress, Container, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Snackbar, TableSortLabel, Checkbox } from '@mui/material';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRecentDocuments, type DocumentSummary, toggleDocumentStarred, getShareLinks } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import StarIcon from '@mui/icons-material/Star';
import PublicIcon from '@mui/icons-material/Public';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useI18n } from '../../lib/i18n';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import PublicDocumentIndicator from '../../components/workspace/PublicDocumentIndicator';
import { useNavigate } from 'react-router-dom';

const RecentDocumentsPage = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

    // Sorting state
    const [orderBy, setOrderBy] = useState<string>('updatedAt');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const { strings } = useI18n();

    usePageTitle('최근 문서함');

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

    const handleClearSelection = () => {
        setSelectedItems(new Set());
    };

    const fetchDocuments = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        setError(null);
        try {
            const docs = await getRecentDocuments({ sortBy: orderBy, sortOrder: order });
            setDocuments(docs);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, orderBy, order]);

    const handleStar = async () => {
        if (!isAuthenticated) return;

        const itemsToStar = Array.from(selectedItems);

        // Check if all selected items are already starred
        let allStarred = true;
        for (const itemId of itemsToStar) {
            const doc = documents.find(d => d.id === itemId);
            if (doc && !doc.isImportant) {
                allStarred = false;
                break;
            }
        }

        const newImportantStatus = !allStarred;

        try {
            await Promise.all(itemsToStar.map(async (itemId) => {
                await toggleDocumentStarred(itemId, newImportantStatus);
            }));

            fetchDocuments();
            setSnackbarMessage(newImportantStatus ? 'Added to Starred' : 'Removed from Starred');
            setSnackbarOpen(true);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handlePublish = async () => {
        const selectedDocs = documents.filter(d => selectedItems.has(d.id) && d.visibility === 'public');

        if (selectedDocs.length === 0) {
            return;
        }

        try {
            const links = await Promise.all(
                selectedDocs.map(async (doc) => {
                    const shareLinks = await getShareLinks(doc.id);
                    const activeLink = shareLinks.find(l => !l.revokedAt);
                    if (activeLink) {
                        const url = `${window.location.origin}/share/${activeLink.token}`;
                        return `${doc.title}\n${url}`;
                    }
                    return null;
                })
            );

            const validLinks = links.filter(l => l !== null).join('\n\n');
            if (validLinks) {
                await navigator.clipboard.writeText(validLinks);
                setSnackbarMessage(`Copied ${selectedDocs.length} link(s)`);
                setSnackbarOpen(true);
            }
        } catch (err) {
            console.error('Failed to copy links:', err);
            setSnackbarMessage('Failed to copy links');
            setSnackbarOpen(true);
        }
    };

    const handleDelete = () => {
        // Delete is disabled for recent documents
    };

    const handleSelectAll = () => {
        if (selectedItems.size === documents.length && documents.length > 0) {
            setSelectedItems(new Set());
        } else {
            const newSelecteds = new Set(documents.map((n) => n.id));
            setSelectedItems(newSelecteds);
        }
    };

    const isAllSelected = documents.length > 0 && selectedItems.size === documents.length;
    const isIndeterminate = selectedItems.size > 0 && selectedItems.size < documents.length;

    // Sort documents by size on client side when sorting by size
    const sortedDocuments = useMemo(() => {
        if (orderBy === 'size') {
            return [...documents].sort((a, b) => {
                const aSize = a.contentSize || 0;
                const bSize = b.contentSize || 0;
                return order === 'asc' ? aSize - bSize : bSize - aSize;
            });
        }
        return documents;
    }, [documents, orderBy, order]);

    // Check if all selected documents have public links
    const hasPublicLinks = useMemo(() => {
        const selectedDocs = documents.filter(d => selectedItems.has(d.id));
        return selectedDocs.length > 0 && selectedDocs.every(d => d.visibility === 'public');
    }, [documents, selectedItems]);

    useEffect(() => {
        if (isAuthenticated) {
            setLoading(true);
            getRecentDocuments({ sortBy: orderBy, sortOrder: order })
                .then((docs) => {
                    setDocuments(docs);
                })
                .catch((err) => {
                    setError((err as Error).message);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [isAuthenticated, orderBy, order]);

    const renderDocuments = () => {
        if (loading) return <CircularProgress />;
        if (error) return <Alert severity="error">{error}</Alert>;

        if (documents.length === 0) {
            return (
                <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        최근 수정된 문서가 없습니다.
                    </Typography>
                </Paper>
            );
        }

        return (
            <TableContainer component={Paper} variant="outlined" sx={{ border: 'none' }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell width="35%">
                                <TableSortLabel
                                    active={orderBy === 'title'}
                                    direction={orderBy === 'title' ? order : 'asc'}
                                    onClick={() => handleRequestSort('title')}
                                >
                                    {strings.workspace.nameColumn}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="15%">{strings.workspace.folderColumn}</TableCell>
                            <TableCell width="12%">
                                <TableSortLabel
                                    active={orderBy === 'size'}
                                    direction={orderBy === 'size' ? order : 'asc'}
                                    onClick={() => handleRequestSort('size')}
                                >
                                    {strings.workspace.sizeColumn}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="18%">
                                <TableSortLabel
                                    active={orderBy === 'updatedAt'}
                                    direction={orderBy === 'updatedAt' ? order : 'asc'}
                                    onClick={() => handleRequestSort('updatedAt')}
                                >
                                    {strings.workspace.lastModifiedColumn}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="15%">{strings.workspace.modifiedByColumn}</TableCell>
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
                                        <ArticleIcon color="action" sx={{ mr: 1.5 }} />
                                        {doc.title}
                                        {doc.isImportant && (
                                            <StarIcon
                                                sx={{
                                                    ml: 1,
                                                    fontSize: '1rem',
                                                    color: 'warning.main',
                                                    opacity: 0.6
                                                }}
                                            />
                                        )}
                                        {doc.visibility === 'public' && (
                                            <PublicDocumentIndicator
                                                documentId={doc.id}
                                                title={doc.title}
                                            />
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                        <Link
                                            component={RouterLink}
                                            to={`/workspace/${doc.workspaceId}${doc.folderId ? `?folderId=${doc.folderId}` : ''}`}
                                            underline="hover"
                                            color="inherit"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {doc.folderName || strings.workspace.rootFolder}
                                        </Link>
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">{formatBytes(doc.contentSize)}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.updatedAt)}</Typography>
                                </TableCell>
                                <TableCell>
                                    <Chip label={doc.lastModifiedBy || strings.workspace.ownerLabel} size="small" variant="outlined" sx={{ borderRadius: 1 }} />
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} underline="hover" color="inherit" to="/dashboard" sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Dashboard
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        최근 문서함
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                    최근 문서함
                </Typography>
                <Box sx={{ height: 60, display: 'flex', alignItems: 'center', mb: 2 }}>
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
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
            />
        </Container>
    );
};

export default RecentDocumentsPage;
