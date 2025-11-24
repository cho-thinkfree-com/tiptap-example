import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    Typography,
    Alert,
    CircularProgress,
} from '@mui/material'
import { useEffect, useState } from 'react'
import {
    createShareLink,
    getShareLinks,
    revokeShareLink,
    type ShareLinkResponse,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

interface ShareDialogProps {
    open: boolean
    onClose: () => void
    documentId: string
}

export default function ShareDialog({ open, onClose, documentId }: ShareDialogProps) {
    const { tokens } = useAuth()
    const [loading, setLoading] = useState(false)
    const [shareLink, setShareLink] = useState<ShareLinkResponse['shareLink'] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const fetchLink = async () => {
        if (!tokens) return
        setLoading(true)
        try {
            const links = await getShareLinks(documentId, tokens.accessToken)
            // For now, we assume one active link per document for simplicity in this UI
            const activeLink = links.find(l => !l.revokedAt)
            setShareLink(activeLink || null)
        } catch (err) {
            console.error(err)
            setError('Failed to load share link')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchLink()
            setError(null)
            setCopied(false)
        }
    }, [open, documentId, tokens])

    const handleCreate = async () => {
        if (!tokens) return
        setLoading(true)
        try {
            const result = await createShareLink(documentId, tokens.accessToken)
            setShareLink(result.shareLink)
        } catch (err) {
            setError('Failed to create share link')
        } finally {
            setLoading(false)
        }
    }

    const handleRevoke = async () => {
        if (!tokens || !shareLink) return
        setLoading(true)
        try {
            await revokeShareLink(shareLink.id, tokens.accessToken)
            setShareLink(null)
        } catch (err) {
            setError('Failed to revoke link')
        } finally {
            setLoading(false)
        }
    }

    const handleCopy = () => {
        if (!shareLink) return
        const url = `${window.location.origin}/share/${shareLink.token}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const shareUrl = shareLink ? `${window.location.origin}/share/${shareLink.token}` : ''

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Share Document</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {loading && !shareLink ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : !shareLink ? (
                    <Box sx={{ py: 2, textAlign: 'center' }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Publish this document to the web to share it with others.
                        </Typography>
                        <Button variant="contained" onClick={handleCreate}>
                            Publish to Web
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Anyone with this link can view this document.
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <TextField
                                fullWidth
                                value={shareUrl}
                                InputProps={{
                                    readOnly: true,
                                }}
                                size="small"
                            />
                            <Button variant="outlined" onClick={handleCopy}>
                                {copied ? 'Copied!' : 'Copy'}
                            </Button>
                        </Box>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                            <Button color="error" onClick={handleRevoke}>
                                Unpublish
                            </Button>
                        </Box>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}
