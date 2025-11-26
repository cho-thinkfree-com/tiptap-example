import { Alert, Box, Breadcrumbs, CircularProgress, Container, Link, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Snackbar, TableSortLabel } from '@mui/material';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPublicDocuments, type DocumentSummary, toggleDocumentStarred } from '../../lib/api';
import { formatRelativeDate } from '../../lib/formatDate';
import HomeIcon from '@mui/icons-material/Home';
import ArticleIcon from '@mui/icons-material/Article';
import StarIcon from '@mui/icons-material/Star';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useI18n } from '../../lib/i18n';
import SelectionToolbar from '../../components/workspace/SelectionToolbar';
import PublicDocumentIndicator from '../../components/workspace/PublicDocumentIndicator';

const SharedDocumentsPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();
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
    const [orderBy, setOrderBy] = useState<string>('createdAt');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const { strings } = useI18n();

    usePageTitle('공유 문서함');

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
        if (!isAuthenticated || !workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const docs = await getPublicDocuments(workspaceId, { sortBy: orderBy, sortOrder: order });
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
        const selectedDocs = documents.filter(d => selectedItems.has(d.id));

        if (selectedDocs.length === 0) {
            return;
        }

        const links = selectedDocs.map(doc => {
            const url = `${window.location.origin}/document/${doc.id}`;
            return `[${doc.title}](${url})`;
        }).join('\n');

        try {
            await navigator.clipboard.writeText(links);
            setSnackbarMessage(`Copied ${selectedDocs.length} link(s) to clipboard`);
            setSnackbarOpen(true);
        } catch (err) {
            console.error('Failed to copy to clipboard');
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
                const aSize = a.contentSize || 0;
                const bSize = b.contentSize || 0;
                return order === 'asc' ? aSize - bSize : bSize - aSize;
            });
        }
        return documents;
    }, [documents, orderBy, order]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

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
                            <TableCell width="30%">
                                <TableSortLabel
                                    active={orderBy === 'title'}
                                    direction={orderBy === 'title' ? order : 'asc'}
                                    onClick={() => handleRequestSort('title')}
                                >
                                    {strings.workspace.nameColumn}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="15%">{strings.workspace.folderColumn}</TableCell>
                            <TableCell width="10%">
                                <TableSortLabel
                                    active={orderBy === 'size'}
                                    direction={orderBy === 'size' ? order : 'asc'}
                                    onClick={() => handleRequestSort('size')}
                                >
                                    {strings.workspace.sizeColumn}
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="15%">
                                <TableSortLabel
                                    active={orderBy === 'createdAt'}
                                    direction={orderBy === 'createdAt' ? order : 'asc'}
                                    onClick={() => handleRequestSort('createdAt')}
                                >
                                    공개 일시
                                </TableSortLabel>
                            </TableCell>
                            <TableCell width="15%">
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
                                        <PublicDocumentIndicator
                                            documentId={doc.id}
                                            title={doc.title}
                                        />
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
                                    <Typography variant="body2" color="text.secondary">{formatRelativeDate(doc.createdAt)}</Typography>
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    공개된 문서 목록입니다. 회원 간 공유 기능은 추후 지원될 예정입니다.
                </Typography>
                <Box sx={{ height: 60, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SelectionToolbar
                        selectedCount={selectedItems.size}
                        hasDocuments={true}
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

export default SharedDocumentsPage;
