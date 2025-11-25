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
    const { tokens } = useAuth()
    const navigate = useNavigate()
    const [items, setItems] = useState<TrashItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [itemToDelete, setItemToDelete] = useState<TrashItem | null>(null)
    const [snackbarOpen, setSnackbarOpen] = useState(false)
    const [snackbarMessage, setSnackbarMessage] = useState('')

    const loadTrash = async () => {
        if (!workspaceId || !tokens?.accessToken) return

        try {
            setLoading(true)
            setError(null)
            const data = await listTrash(workspaceId, tokens.accessToken) as { documents: TrashDocument[], folders: TrashFolder[] }

            const combinedItems: TrashItem[] = [
                ...(data.folders || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    type: 'folder' as const,
                    deletedAt: f.deletedAt,
                    location: f.originalParentName || null,
                })),
                ...(data.documents || []).map(d => ({
                    id: d.id,
                    name: d.title,
                    type: 'document' as const,
                    deletedAt: d.deletedAt,
                    size: d.contentSize,
                    location: d.originalFolderName || null,
                }))
            ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())

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
    }, [workspaceId, tokens?.accessToken])

    const handleRestore = async (item: TrashItem) => {
        if (!tokens?.accessToken) {
            alert('Please log in to perform this action.')
            return
        }

        try {
            if (item.type === 'document') {
                await restoreDocument(item.id, tokens.accessToken)
            } else {
                await restoreFolder(item.id, tokens.accessToken)
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
        if (!tokens?.accessToken) {
            alert('Please log in to perform this action.')
            return
        }
        setItemToDelete(item)
        setDeleteDialogOpen(true)
    }

    const confirmPermanentDelete = async () => {
        if (!itemToDelete || !tokens?.accessToken) return

        setDeleteDialogOpen(false)

        try {
            if (itemToDelete.type === 'document') {
                await permanentlyDeleteDocument(itemToDelete.id, tokens.accessToken)
            } else {
                await permanentlyDeleteFolder(itemToDelete.id, tokens.accessToken)
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
        <Box p={3}>
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

            {items.length === 0 ? (
                <Box mt={4}>
                    <Typography color="text.secondary">Trash is empty</Typography>
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ mt: 3 }}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Location</TableCell>
                                <TableCell>Deleted</TableCell>
                                <TableCell>Size</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {item.type === 'folder' ? <FolderIcon color="action" /> : <ArticleIcon color="action" />}
                                        {item.name}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {item.location || 'Root'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{formatDate(item.deletedAt)}</TableCell>
                                    <TableCell>{formatSize(item.size)}</TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Restore">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleRestore(item)}
                                                color="primary"
                                            >
                                                <RestoreIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete Forever">
                                            <IconButton
                                                size="small"
                                                onClick={() => handlePermanentDelete(item)}
                                                color="error"
                                            >
                                                <DeleteForeverIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

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
