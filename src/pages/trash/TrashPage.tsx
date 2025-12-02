import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    Box,
    Container,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Breadcrumbs,
    Link,
    Snackbar,
    Alert,
    TableSortLabel,
    CircularProgress,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import ArticleIcon from '@mui/icons-material/Article'
import HomeIcon from '@mui/icons-material/Home'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { useAuth } from '../../context/AuthContext'
import { listTrash, restoreDocument, permanentlyDeleteDocument, restoreFolder, permanentlyDeleteFolder } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import TrashSelectionToolbar from '../../components/trash/TrashSelectionToolbar'
import { useFileEvents } from '../../hooks/useFileEvents'

interface TrashDocument {
    id: string
    title: string
    deletedAt: string
    ownerMembershipId: string
    originalFolderId?: string | null
    originalFolderName?: string | null
    contentSize: number
}

interface TrashFolder {
    id: string
    name: string
    deletedAt: string
    originalParentId?: string | null
    originalParentName?: string | null
}

interface TrashItem {
    id: string
    name: string
    type: 'document' | 'folder'
    deletedAt: string
    size?: number
    location?: string | null
}

export default function TrashPage() {
    const { workspaceId } = useParams<{ workspaceId: string }>()
    const { isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const [items, setItems] = useState<TrashItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null)
    const [snackbarOpen, setSnackbarOpen] = useState(false)
    const [snackbarMessage, setSnackbarMessage] = useState('')

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

    // Sorting state
    const [orderBy, setOrderBy] = useState<string>('deletedAt')
    const [order, setOrder] = useState<'asc' | 'desc'>('desc')

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc'
        setOrder(isAsc ? 'desc' : 'asc')
        setOrderBy(property)
    }

    const handleSelectAll = () => {
        if (selectedItems.size === items.length && items.length > 0) {
            setSelectedItems(new Set())
        } else {
            setSelectedItems(new Set(items.map(item => item.id)))
        }
    }

    const isAllSelected = items.length > 0 && selectedItems.size === items.length
    const isIndeterminate = selectedItems.size > 0 && selectedItems.size < items.length

    const loadTrash = async () => {
        if (!workspaceId || !isAuthenticated) return

        try {
            setLoading(true)
            setError(null)
            // The API now returns FileSystemEntry[]
            const data = await listTrash(workspaceId, { sortBy: orderBy, sortOrder: order }) as unknown as any[]

            // Handle both legacy and new format if necessary, but assuming new format is flat array
            const entries = Array.isArray(data) ? data : []

            const trashItems: TrashItem[] = entries.map(item => ({
                id: item.id,
                name: item.name,
                type: item.type === 'folder' ? 'folder' : 'document',
                deletedAt: item.deletedAt || new Date().toISOString(),
                size: item.size ? parseInt(item.size) : undefined,
                location: item.originalParentId ? 'Folder' : 'Root',
            }));

            // Sort items
            const sortedItems = [...trashItems].sort((a, b) => {
                if (orderBy === 'name') {
                    return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                } else if (orderBy === 'deletedAt') {
                    return order === 'asc' ? new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime() : new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
                } else if (orderBy === 'size') {
                    const aSize = a.size || 0;
                    const bSize = b.size || 0;
                    return order === 'asc' ? aSize - bSize : bSize - aSize;
                }
                return 0;
            });

            setItems(sortedItems)
        } catch (err) {
            setError('Failed to load trash')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTrash()
    }, [workspaceId, isAuthenticated, orderBy, order])

    // Real-time file events via WebSocket - handle delete and restore
    useFileEvents({
        workspaceId,
        onFileDeleted: (event) => {
            // File moved to trash - add to trash list
            loadTrash(); // Refetch to get full item data
        },
        onFileRestored: (event) => {
            // File restored - remove from trash list
            setItems((prevItems) => prevItems.filter((item) => item.id !== event.file.id));
        },
    });

    const handleRestore = async (item: TrashItem) => {
        if (!isAuthenticated) {
            alert('Please log in to perform this action.')
            return
        }

        try {
            if (item.type === 'document') {
                await restoreDocument(item.id)
            } else {
                await restoreFolder(item.id)
            }
            setSnackbarMessage(`"${item.name}" restored successfully`)
            setSnackbarOpen(true)
            await loadTrash()
        } catch (err) {
            console.error('Failed to restore:', err)
            alert('Failed to restore item. Please try again.')
        }
    }

    const handlePermanentDelete = (item: TrashItem) => {
        if (!isAuthenticated) {
            alert('Please log in to perform this action.')
            return
        }
        setItemToDelete(item)
        setDeleteDialogOpen(true)
    }

    const confirmPermanentDelete = async () => {
        if (!itemToDelete || !isAuthenticated) return

        setDeleteDialogOpen(false)

        try {
            if (itemToDelete.type === 'document') {
                await permanentlyDeleteDocument(itemToDelete.id)
            } else {
                await permanentlyDeleteFolder(itemToDelete.id)
            }
            await loadTrash()
        } catch (err) {
            console.error('Failed to delete:', err)
            alert('Failed to permanently delete item. Please try again.')
        } finally {
            setItemToDelete(null)
        }
    }

    const cancelPermanentDelete = () => {
        setDeleteDialogOpen(false)
        setItemToDelete(null)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString()
    }

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return '-'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const handleRowClick = (itemId: string, event: React.MouseEvent) => {
        const target = event.target as HTMLElement
        if (target.closest('button')) {
            return
        }

        if (event.shiftKey) {
            event.preventDefault()
        }

        const newSelected = new Set(selectedItems)

        if (event.shiftKey && lastSelectedId) {
            const allIds = items.map(i => i.id)
            const lastIndex = allIds.indexOf(lastSelectedId)
            const currentIndex = allIds.indexOf(itemId)

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex)
                const end = Math.max(lastIndex, currentIndex)

                for (let i = start; i <= end; i++) {
                    newSelected.add(allIds[i])
                }
            }
        } else if (event.ctrlKey || event.metaKey) {
            if (newSelected.has(itemId)) {
                newSelected.delete(itemId)
            } else {
                newSelected.add(itemId)
            }
        } else {
            newSelected.clear()
            newSelected.add(itemId)
        }

        setSelectedItems(newSelected)
        setLastSelectedId(itemId)
    }

    const handleClearSelection = () => {
        setSelectedItems(new Set())
    }

    const handleBulkRestore = async () => {
        if (!isAuthenticated) {
            alert('Please log in to perform this action.')
            return
        }

        const itemsToRestore = Array.from(selectedItems)
        const errors: string[] = []

        try {
            await Promise.all(
                itemsToRestore.map(async (itemId) => {
                    const item = items.find(i => i.id === itemId)
                    if (!item) return

                    try {
                        if (item.type === 'document') {
                            await restoreDocument(itemId)
                        } else {
                            await restoreFolder(itemId)
                        }
                    } catch (err) {
                        errors.push(itemId)
                        console.error(`Failed to restore item ${itemId}:`, err)
                    }
                })
            )

            const successCount = itemsToRestore.length - errors.length
            setSnackbarMessage(`${successCount} item(s) restored successfully`)
            setSnackbarOpen(true)
            setSelectedItems(new Set())
            await loadTrash()

            if (errors.length > 0) {
                alert(`Failed to restore ${errors.length} item(s)`)
            }
        } catch (err) {
            console.error('Bulk restore failed:', err)
            alert('Failed to restore items. Please try again.')
        }
    }

    const handleBulkPermanentDelete = () => {
        if (!isAuthenticated) {
            alert('Please log in to perform this action.')
            return
        }
        setBulkDeleteDialogOpen(true)
    }

    const confirmBulkPermanentDelete = async () => {
        setBulkDeleteDialogOpen(false)

        const itemsToDelete = Array.from(selectedItems)
        const errors: string[] = []

        try {
            await Promise.all(
                itemsToDelete.map(async (itemId) => {
                    const item = items.find(i => i.id === itemId)
                    if (!item) return

                    try {
                        if (item.type === 'document') {
                            await permanentlyDeleteDocument(itemId)
                        } else {
                            await permanentlyDeleteFolder(itemId)
                        }
                    } catch (err) {
                        errors.push(itemId)
                        console.error(`Failed to delete item ${itemId}:`, err)
                    }
                })
            )

            const successCount = itemsToDelete.length - errors.length
            setSnackbarMessage(`${successCount} item(s) permanently deleted`)
            setSnackbarOpen(true)
            setSelectedItems(new Set())
            await loadTrash()

            if (errors.length > 0) {
                alert(`Failed to delete ${errors.length} item(s)`)
            }
        } catch (err) {
            console.error('Bulk delete failed:', err)
            alert('Failed to delete items. Please try again.')
        }
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (selectedItems.size === 0) return

        if (event.key === 'Delete') {
            event.preventDefault()
            handleBulkPermanentDelete()
        }
    }

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return (
            <Box p={3}>
                <Typography color="error">{error}</Typography>
            </Box>
        )
    }

    return (
        <Container maxWidth="xl" onKeyDown={handleKeyDown} tabIndex={0} sx={{ outline: 'none' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, height: 40 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link
                        component="button"
                        underline="hover"
                        color="inherit"
                        onClick={() => navigate(`/workspace/${workspaceId}/files`)}
                        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                    >
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Files
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        Trash
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 1 }}>
                    Trash
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Items in trash are permanently deleted after 7 days.
                </Typography>

                <Box sx={{ height: 32, display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrashSelectionToolbar
                        selectedCount={selectedItems.size}
                        onClearSelection={handleClearSelection}
                        onRestoreAll={handleBulkRestore}
                        onPermanentDeleteAll={handleBulkPermanentDelete}
                        onSelectAll={handleSelectAll}
                    />
                </Box>

                {items.length === 0 ? (
                    <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                        <Typography color="text.secondary">
                            Trash is empty.
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
                                    <TableCell width="25%">Location</TableCell>
                                    <TableCell width="20%">
                                        <TableSortLabel
                                            active={orderBy === 'deletedAt'}
                                            direction={orderBy === 'deletedAt' ? order : 'asc'}
                                            onClick={() => handleRequestSort('deletedAt')}
                                        >
                                            Deleted
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
                                {items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        hover
                                        selected={selectedItems.has(item.id)}
                                        onClick={(e) => handleRowClick(item.id, e)}
                                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {item.type === 'folder' ? <FolderIcon color="action" /> : <ArticleIcon color="action" />}
                                                {item.name}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {item.location || 'Root'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatDate(item.deletedAt)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {formatSize(item.size)}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            <Dialog
                open={bulkDeleteDialogOpen}
                onClose={() => setBulkDeleteDialogOpen(false)}
            >
                <DialogTitle>Confirm Bulk Permanent Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to permanently delete {selectedItems.size} item(s)? This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmBulkPermanentDelete} color="error" variant="contained">
                        Delete Forever
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteDialogOpen}
                onClose={cancelPermanentDelete}
            >
                <DialogTitle>Confirm Permanent Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {itemToDelete?.type === 'folder'
                            ? 'Are you sure you want to permanently delete this folder and all its contents? This cannot be undone.'
                            : 'Are you sure you want to permanently delete this document? This cannot be undone.'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelPermanentDelete}>Cancel</Button>
                    <Button onClick={confirmPermanentDelete} color="error" variant="contained">
                        Delete Forever
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    )
}
