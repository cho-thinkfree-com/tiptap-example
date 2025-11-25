import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    CircularProgress,
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
    Checkbox,
} from '@mui/material'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import FolderIcon from '@mui/icons-material/Folder'
import ArticleIcon from '@mui/icons-material/Article'
import HomeIcon from '@mui/icons-material/Home'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import { useAuth } from '../../context/AuthContext'
import { listTrash, restoreDocument, permanentlyDeleteDocument, restoreFolder, permanentlyDeleteFolder } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import TrashSelectionToolbar from '../../components/trash/TrashSelectionToolbar'

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
            const data = await listTrash(workspaceId, { sortBy: orderBy, sortOrder: order }) as { documents: TrashDocument[], folders: TrashFolder[] }

            // Convert to TrashItem format
            const folderItems: TrashItem[] = (data.folders || []).map(f => ({
                id: f.id,
                name: f.name,
                type: 'folder' as const,
                deletedAt: f.deletedAt,
                location: f.originalParentName || null,
            }));

            const documentItems: TrashItem[] = (data.documents || []).map(d => ({
                id: d.id,
                name: d.title,
                type: 'document' as const,
                deletedAt: d.deletedAt,
                size: d.contentSize,
                location: d.originalFolderName || null,
            }));

            // Sort folders and documents separately
            const sortedFolders = [...folderItems].sort((a, b) => {
                if (orderBy === 'name') {
                    return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                } else if (orderBy === 'deletedAt') {
                    return order === 'asc' ? new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime() : new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
                } else if (orderBy === 'size') {
                    // Folders don't have size, so sort by name (A-Z)
                    return a.name.localeCompare(b.name);
                }
                return 0;
            });

            const sortedDocuments = [...documentItems].sort((a, b) => {
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

            // Always keep folders first, then documents
            const combinedItems: TrashItem[] = [...sortedFolders, ...sortedDocuments];

            setItems(combinedItems)
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
        <Box p={3} onKeyDown={handleKeyDown} tabIndex={0}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
                <Link
                    component="button"
                    variant="body1"
                    onClick={() => navigate(`/workspace/${workspaceId}`)}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        textDecoration: 'none',
                        color: 'text.primary',
                        '&:hover': {
                            textDecoration: 'underline',
                        },
                    }}
                >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                    Files
                </Link>
                <Typography color="text.primary">Trash</Typography>
            </Breadcrumbs>

            <Typography variant="h4" gutterBottom>
                Trash
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Items in trash are permanently deleted after 7 days
            </Typography>

            <Box sx={{ height: 60, display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrashSelectionToolbar
                    selectedCount={selectedItems.size}
                    onClearSelection={handleClearSelection}
                    onRestoreAll={handleBulkRestore}
                    onPermanentDeleteAll={handleBulkPermanentDelete}
                    onSelectAll={handleSelectAll}
                />
            </Box>

            {items.length === 0 ? (
                <Box mt={4}>
                    <Typography color="text.secondary">Trash is empty</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ mt: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'name'}
                                        direction={orderBy === 'name' ? order : 'asc'}
                                        onClick={() => handleRequestSort('name')}
                                    >
                                        Name
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Location</TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={orderBy === 'deletedAt'}
                                        direction={orderBy === 'deletedAt' ? order : 'asc'}
                                        onClick={() => handleRequestSort('deletedAt')}
                                    >
                                        Deleted
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
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
                                    <TableCell>{formatDate(item.deletedAt)}</TableCell>
                                    <TableCell>{formatSize(item.size)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

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
        </Box>
    )
}
