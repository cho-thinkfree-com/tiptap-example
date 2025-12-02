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
    Radio,
    RadioGroup,
    FormControlLabel,
    Switch,
    InputAdornment,
    IconButton,
    Divider,
} from '@mui/material'
import { useEffect, useState } from 'react'
import {
    createShareLink,
    getShareLinks,
    revokeShareLink,
    updateFileSystemEntry,
    updateShareLink,
    type DocumentSummary,
    type FileSystemEntry,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { generateShareUrl } from '../../lib/shareUtils'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { Collapse } from '@mui/material'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { useFileEvents } from '../../hooks/useFileEvents'

interface ShareDialogProps {
    open: boolean
    onClose: () => void
    documentId?: string
    document?: DocumentSummary
    file?: FileSystemEntry
    onVisibilityChange?: (visibility: string) => void
}

export default function ShareDialog({ open, onClose, documentId: propDocumentId, document: propDocument, file, onVisibilityChange }: ShareDialogProps) {
    // Resolve document ID and object from either props
    const documentId = propDocumentId || file?.id || '';
    const document = propDocument || (file as unknown as DocumentSummary) || null;
    const { isAuthenticated, user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [shareLink, setShareLink] = useState<any | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [updating, setUpdating] = useState(false)

    // Password state
    const [passwordEnabled, setPasswordEnabled] = useState(false)
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [passwordError, setPasswordError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Expiration state
    const [expirationEnabled, setExpirationEnabled] = useState(false)
    const [expiresAt, setExpiresAt] = useState('')
    const [hasChanges, setHasChanges] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const DUMMY_PASSWORD = '●●●●●●●●●●●●'

    const fetchLink = async () => {
        if (!isAuthenticated) return
        setLoading(true)
        try {
            const links = await getShareLinks(documentId)
            // For now, we assume one active link per document for simplicity in this UI
            const activeLink = links.find(l => !l.revokedAt)
            setShareLink(activeLink || null)
            if (activeLink) {
                setPasswordEnabled(!!activeLink.passwordHash)
                setPassword('') // Don't show existing password (it's hashed)

                // Check if we should expand settings
                const hasPassword = !!activeLink.passwordHash
                const hasExpiration = !!activeLink.expiresAt
                if (hasPassword || hasExpiration) {
                    setExpanded(true)
                }
            }
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
            setPassword('')
            setPasswordError(null)
            setExpanded(false)
        }
    }, [open, documentId, isAuthenticated])

    // Listen for real-time share link updates
    useFileEvents({
        workspaceId: document?.workspaceId,
        onFileUpdated: (event) => {
            // Only refetch if this is the file being shown in the dialog
            if (event.fileId === documentId && event.updates.shareLinks) {
                console.log('[ShareDialog] Received shareLinks update, refetching');
                fetchLink();
            }
        },
    });

    const validatePassword = (pwd: string) => {
        if (pwd.length < 4 || pwd.length > 32) {
            return 'Password must be between 4 and 32 characters'
        }
        return null
    }

    const handleCreate = async () => {
        if (!isAuthenticated) return
        setLoading(true)
        try {
            // Create with default link-only access
            const result = await createShareLink(documentId, { accessType: 'link' })
            setShareLink(result)
            setPasswordEnabled(false)
            // Sync document metadata - default to not shared
            await updateFileSystemEntry(documentId, { isShared: false })
            onVisibilityChange?.('private')
        } catch (err) {
            setError('Failed to create share link')
        } finally {
            setLoading(false)
        }
    }

    const handleRevoke = async () => {
        if (!isAuthenticated || !shareLink) return
        setLoading(true)
        try {
            await revokeShareLink(shareLink.id)
            setShareLink(null)
            setPasswordEnabled(false)
            setPassword('')
            // Revert to not shared when unpublishing
            await updateFileSystemEntry(documentId, { isShared: false })
            onVisibilityChange?.('private')
        } catch (err) {
            setError('Failed to revoke link')
        } finally {
            setLoading(false)
        }
    }

    const handlePublicLevelChange = async (newAccessType: 'public' | 'link') => {
        if (!shareLink || updating) return
        setUpdating(true)
        try {
            const updates: any = { accessType: newAccessType }
            if (newAccessType === 'public') {
                updates.passwordHash = null // Clear password when making public
            }

            const updated = await updateShareLink(shareLink.id, updates)
            setShareLink(updated)

            if (newAccessType === 'public') {
                setPasswordEnabled(false)
                setPassword('')
            }

            // Sync document metadata - mark as shared if link exists
            await updateFileSystemEntry(documentId, { isShared: true })
        } catch (err) {
            setError('Failed to update public level')
        } finally {
            setUpdating(false)
        }
    }

    const handlePasswordToggle = async (enabled: boolean) => {
        if (!shareLink || updating) return

        // If disabling, we can just update immediately (assuming backend supports clearing password via update, 
        // but currently updateOptions doesn't support password update. 
        // Wait, the requirement says "Allow users to set a password".
        // My backend `updateOptions` ONLY supports `allowExternalEdit` and `accessType`.
        // To update password, I need to use `create` (which reactivates/updates if exists).
        // So I should call `createShareLink` again with the new password settings?
        // Yes, `ShareLinkService.create` handles reactivation/update.

        if (!enabled) {
            // To remove password, we might need a way. 
            // Currently `create` with empty password might not clear it if I implemented "keep existing if not provided".
            // Let's check `ShareLinkService.create`.
            // "const passwordHash = input.password ? await this.passwordHasher.hash(input.password) : existingShareLink.passwordHash"
            // It preserves existing if input.password is missing.
            // It doesn't seem to support clearing password.
            // I might need to update `ShareLinkService` to allow clearing password, or just leave it for now and focus on setting it.
            // Actually, if I want to disable password protection, I probably need to support it.
            // But for now, let's just support SETTING it.
            setPasswordEnabled(enabled)
            if (!enabled) {
                // If disabling in UI, we should probably clear it in backend.
                // But my backend doesn't support it yet.
                // I'll just hide the input for now.
            }
            return
        }

        setPasswordEnabled(true)
    }

    const handleUpdateSettings = async () => {
        if (!shareLink || updating) return

        setUpdating(true)
        try {
            const updates: any = {}

            // Handle password
            if (passwordEnabled) {
                const validationError = validatePassword(password)
                if (validationError) {
                    setPasswordError(validationError)
                    setUpdating(false)
                    return
                }
                if (password && password !== DUMMY_PASSWORD) {
                    updates.password = password
                }
            } else {
                // Password disabled - clear it
                updates.password = null
            }

            // Handle expiration
            if (expirationEnabled && expiresAt) {
                const userTimezone = user?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                const utcDate = fromZonedTime(expiresAt, userTimezone)
                updates.expiresAt = utcDate
            } else if (!expirationEnabled) {
                // Expiration disabled - clear it
                updates.expiresAt = null
            }

            const updated = await updateShareLink(shareLink.id, updates)
            setShareLink(updated)
            setPasswordError(null)
            setSuccessMessage('Settings updated successfully.')
            setTimeout(() => setSuccessMessage(null), 5000)

            // If password was set, replace with dummy
            if (passwordEnabled && password && password !== DUMMY_PASSWORD) {
                setPassword(DUMMY_PASSWORD)
            }
        } catch (err) {
            setError('Failed to update settings')
        } finally {
            setUpdating(false)
        }
    }

    const handleCopy = () => {
        if (!shareLink || !document) return
        const url = generateShareUrl(shareLink.token, document.name, shareLink.accessType)
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleToggleExpand = () => {
        setExpanded(!expanded)
    }

    const handleExpirationToggle = async (enabled: boolean) => {
        if (!shareLink || updating) return
        setExpirationEnabled(enabled)

        if (!enabled) {
            // Just disable in UI, will be cleared when Update Settings is clicked
            setExpiresAt('')
        } else {
            // Enable: Set default to 1 week from now
            const nextWeek = new Date()
            nextWeek.setDate(nextWeek.getDate() + 7)
            // Format in user's timezone
            const userTimezone = user?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            setExpiresAt(formatInTimeZone(nextWeek, userTimezone, "yyyy-MM-dd'T'HH:mm"))
        }
    }



    useEffect(() => {
        if (shareLink) {
            const hasPassword = !!shareLink.passwordHash || !!shareLink.requiresPassword
            setPasswordEnabled(hasPassword)
            if (hasPassword) {
                setPassword(DUMMY_PASSWORD)
            } else {
                setPassword('')
            }

            const hasExpiration = !!shareLink.expiresAt
            setExpirationEnabled(hasExpiration)
            if (hasExpiration) {
                const userTimezone = user?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                setExpiresAt(formatInTimeZone(new Date(shareLink.expiresAt), userTimezone, "yyyy-MM-dd'T'HH:mm"))
            } else {
                setExpiresAt('')
            }
        }
    }, [shareLink, user])

    // Track changes
    useEffect(() => {
        if (!shareLink) {
            setHasChanges(false)
            return
        }

        const originalHasPassword = !!shareLink.passwordHash || !!shareLink.requiresPassword
        const originalHasExpiration = !!shareLink.expiresAt

        console.log('[ShareDialog] Change detection:', {
            passwordEnabled,
            originalHasPassword,
            expirationEnabled,
            originalHasExpiration,
            expiresAt,
            shareLink_expiresAt: shareLink.expiresAt
        })

        // Check if password state changed
        const passwordChanged = passwordEnabled !== originalHasPassword ||
            (passwordEnabled && password && password !== DUMMY_PASSWORD)

        // Check if expiration state changed (simplified - just check if enabled state differs)
        let expirationChanged = expirationEnabled !== originalHasExpiration

        // If both are enabled, also check if the date changed
        if (expirationEnabled && originalHasExpiration && expiresAt && shareLink.expiresAt) {
            const currentDate = new Date(expiresAt)
            const originalDate = new Date(shareLink.expiresAt)

            // Compare dates (allow small differences due to timezone conversion)
            if (Math.abs(currentDate.getTime() - originalDate.getTime()) > 60000) { // 1 minute tolerance
                expirationChanged = true
            }
        }

        console.log('[ShareDialog] Changes detected:', {
            passwordChanged,
            expirationChanged,
            hasChanges: passwordChanged || expirationChanged
        })

        setHasChanges(passwordChanged || expirationChanged)
    }, [shareLink, passwordEnabled, password, expirationEnabled, expiresAt, user])

    const shareUrl = shareLink && document ? generateShareUrl(shareLink.token, document.name, shareLink.accessType) : ''

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
                        {/* View Count */}

                        <RadioGroup
                            value={shareLink.accessType === 'public' ? 'public' : 'link'}
                            onChange={(e) => handlePublicLevelChange(e.target.value as 'public' | 'link')}
                        >
                            <Box
                                sx={{
                                    border: '1px solid',
                                    borderColor: shareLink.accessType === 'public' ? 'primary.main' : 'divider',
                                    borderRadius: 1,
                                    p: 2,
                                    mb: 2,
                                    cursor: 'pointer',
                                    bgcolor: shareLink.accessType === 'public' ? 'action.hover' : 'transparent',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    }
                                }}
                                onClick={() => shareLink.accessType !== 'public' && handlePublicLevelChange('public')}
                            >
                                <FormControlLabel
                                    value="public"
                                    control={<Radio />}
                                    disabled={updating}
                                    label={
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>
                                                완전 공개
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                검색엔진에 노출되며 누구나 찾을 수 있습니다
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                                />
                                {shareLink.accessType !== 'public' && (passwordEnabled || expirationEnabled) && (
                                    <Alert severity="warning" sx={{ mt: 1, ml: 4 }}>
                                        '완전 공개'로 변경하면 기존 설정(비밀번호, 만료일)이 모두 삭제됩니다.
                                    </Alert>
                                )}
                            </Box>

                            <Box
                                sx={{
                                    border: '1px solid',
                                    borderColor: shareLink.accessType !== 'public' ? 'primary.main' : 'divider',
                                    borderRadius: 1,
                                    p: 2,
                                    cursor: 'pointer',
                                    bgcolor: shareLink.accessType !== 'public' ? 'action.hover' : 'transparent',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    }
                                }}
                                onClick={() => {
                                    if (shareLink.accessType === 'public') {
                                        handlePublicLevelChange('link');
                                    }
                                }}
                            >
                                <FormControlLabel
                                    value="link"
                                    control={<Radio />}
                                    disabled={updating}
                                    label={
                                        <Box>
                                            <Typography variant="body2" fontWeight={600}>
                                                링크만 공유
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                링크를 아는 사람만 접근할 수 있으며 검색엔진에 노출되지 않습니다
                                            </Typography>
                                        </Box>
                                    }
                                    sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
                                />

                                {shareLink.accessType !== 'public' && (
                                    <Box
                                        sx={{ mt: 2, pl: 4 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Divider sx={{ mb: 2 }} />
                                        <Box
                                            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
                                            onClick={handleToggleExpand}
                                        >
                                            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>More Settings</Typography>
                                            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                        </Box>

                                        <Collapse in={expanded}>
                                            <Box sx={{ pl: 1 }}>
                                                {/* Password Protection */}
                                                <Box sx={{ mb: 3 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="subtitle2">Password Protection</Typography>
                                                        <Switch
                                                            checked={passwordEnabled}
                                                            onChange={(e) => handlePasswordToggle(e.target.checked)}
                                                            disabled={updating || (shareLink && shareLink.accessType === 'public')}
                                                        />
                                                    </Box>
                                                    {passwordEnabled && (
                                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                type={showPassword ? 'text' : 'password'}
                                                                value={password}
                                                                onChange={(e) => setPassword(e.target.value)}
                                                                onFocus={() => {
                                                                    if (password === DUMMY_PASSWORD) {
                                                                        setPassword('')
                                                                    }
                                                                }}
                                                                placeholder={shareLink.requiresPassword ? "Change password..." : "Set password..."}
                                                                error={!!passwordError}
                                                                helperText={passwordError}
                                                                disabled={updating}
                                                                InputProps={{
                                                                    endAdornment: (
                                                                        <InputAdornment position="end">
                                                                            <IconButton
                                                                                aria-label="toggle password visibility"
                                                                                onClick={() => setShowPassword(!showPassword)}
                                                                                edge="end"
                                                                                size="small"
                                                                            >
                                                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                                                            </IconButton>
                                                                        </InputAdornment>
                                                                    ),
                                                                }}
                                                            />
                                                        </Box>
                                                    )}
                                                    {successMessage && (
                                                        <Alert severity="success" sx={{ mt: 1, mb: 1 }}>
                                                            {successMessage}
                                                        </Alert>
                                                    )}
                                                </Box>

                                                <Divider sx={{ my: 2 }} />

                                                {/* Expiration */}
                                                <Box sx={{ mb: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                        <Typography variant="subtitle2">Expiration Date</Typography>
                                                        <Switch
                                                            checked={expirationEnabled}
                                                            onChange={(e) => handleExpirationToggle(e.target.checked)}
                                                            disabled={updating}
                                                        />
                                                    </Box>
                                                    {expirationEnabled && (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                            {shareLink?.expiresAt && new Date(shareLink.expiresAt) <= new Date() && (
                                                                <Alert severity="error">
                                                                    This link has expired.
                                                                </Alert>
                                                            )}
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                type="datetime-local"
                                                                value={expiresAt}
                                                                onChange={(e) => setExpiresAt(e.target.value)}
                                                                disabled={updating}
                                                                helperText={`Timezone: ${user?.preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}`}
                                                            />
                                                        </Box>
                                                    )}
                                                </Box>

                                                {/* Update Settings Button */}
                                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Button
                                                        variant="contained"
                                                        onClick={handleUpdateSettings}
                                                        disabled={
                                                            updating ||
                                                            !hasChanges ||
                                                            (passwordEnabled && !!password && password !== DUMMY_PASSWORD && !!validatePassword(password))
                                                        }
                                                    >
                                                        Update Settings
                                                    </Button>
                                                </Box>
                                            </Box>
                                        </Collapse>
                                    </Box>
                                )}
                            </Box>
                        </RadioGroup>

                        {/* Share URL */}

                        <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 3 }}>
                            <TextField
                                fullWidth
                                value={shareUrl}
                                InputProps={{
                                    readOnly: true,
                                }}
                                size="small"
                                onClick={(e) => {
                                    const input = e.currentTarget.querySelector('input');
                                    if (input) {
                                        input.select();
                                        navigator.clipboard.writeText(shareUrl);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }
                                }}
                                sx={{ cursor: 'pointer' }}
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
