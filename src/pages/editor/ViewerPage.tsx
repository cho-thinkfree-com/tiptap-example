import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShareLink, type DocumentSummary, type DocumentRevision } from '../../lib/api';
import EditorLayout from '../../components/layout/EditorLayout';
import useEditorInstance from '../../editor/useEditorInstance';
import { useSEO } from '../../hooks/useSEO';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { processContentForLoad } from '../../lib/editorUtils';

interface ViewerPageProps {
    documentNumber?: string;
    token?: string;
}

const ViewerPage = ({ documentNumber: propDocNum, token: propToken }: ViewerPageProps) => {
    const params = useParams<{ token?: string; handle?: string; documentNumber?: string }>();
    const token = propToken || params.token;
    const documentNumber = propDocNum || params.documentNumber;
    const { handle } = params;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [document, setDocument] = useState<DocumentSummary | null>(null);
    const [revision, setRevision] = useState<DocumentRevision | null>(null);
    const [accessType, setAccessType] = useState<'private' | 'link' | 'public'>('link');
    const [resolvedContent, setResolvedContent] = useState<any>(null);

    const editor = useEditorInstance({
        content: resolvedContent,
        editable: false, // Read-only for now
        waitForContent: true,
    });

    // Resolve asset URLs when revision changes
    useEffect(() => {
        const resolveAssets = async () => {
            if (revision?.content && document) {
                try {
                    const resolved = await processContentForLoad(
                        revision.content,
                        document.workspaceId,
                        document.id,
                        token // Pass share token for asset resolution
                    );
                    setResolvedContent(resolved);
                } catch (err) {
                    console.error('Failed to resolve assets:', err);
                    setResolvedContent(revision.content); // Fallback to unresolved content
                }
            }
        };
        resolveAssets();
    }, [revision, document, token]);

    // Extract text content for description
    const getTextContent = (content: any): string => {
        if (!content) return '';

        let text = '';
        const traverse = (node: any) => {
            if (node.type === 'text') {
                text += node.text + ' ';
            } else if (node.content) {
                node.content.forEach(traverse);
            }
        };

        if (content.content) {
            content.content.forEach(traverse);
        }

        return text.trim().substring(0, 160); // Limit to 160 characters for meta description
    };

    // SEO metadata
    useSEO({
        title: document?.name || 'Shared Document', // Fixed title property access
        description: revision ? getTextContent(revision.content) : 'View shared document on ododocs',
        author: (document as any)?.creator?.displayName || (document as any)?.creator?.account?.legalName || document?.lastModifiedBy || undefined,
        publishedTime: document?.createdAt,
        modifiedTime: revision?.createdAt,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        type: 'article',
        robots: accessType === 'public' ? 'index, follow' : 'noindex, nofollow',
    });


    const fetchDocument = async (pwd?: string) => {
        if (!token && (!handle || !documentNumber)) return;

        console.log('[ViewerPage] Fetching document...');
        setLoading(true);
        setError(null);
        try {
            let result;
            if (token) {
                console.log('[ViewerPage] Using token:', token);
                result = await resolveShareLink(token, pwd);
            } else if (handle && documentNumber) {
                console.log('[ViewerPage] Using handle/documentNumber:', handle, documentNumber);
                // Dynamically import to avoid circular dependency if any, though api.ts is safe
                const { getBlogDocument } = await import('../../lib/api');
                result = await getBlogDocument(handle, documentNumber);
            }

            if (result) {
                console.log('[ViewerPage] API response:', result);
                // Handle both legacy { document, revision } and new { file, shareLink } formats
                const doc = result.document || result.file;
                const rev = result.revision || result.file?.currentRevision;

                console.log('[ViewerPage] Parsed doc:', doc);
                console.log('[ViewerPage] Parsed rev:', rev);

                // Add shareLink information to document if available
                if (result.shareLink && doc) {
                    doc.shareLinks = [{
                        token: token,
                        accessType: result.shareLink.accessType,
                        requiresPassword: result.shareLink.requiresPassword,
                        expiresAt: result.shareLink.expiresAt,
                        accessLevel: result.shareLink.accessLevel,
                    }];
                    setAccessType(result.shareLink.accessType);
                }

                setDocument(doc);
                setRevision(rev);
                setPasswordRequired(false);
                console.log('[ViewerPage] Document and revision set successfully');
            }
        } catch (err: any) {
            console.error('[ViewerPage] Error fetching document:', err);
            console.error('[ViewerPage] Error message:', err.message);
            console.error('[ViewerPage] Error stack:', err.stack);
            if (err.message === 'Share link password required or incorrect' || err.message?.includes('password')) {
                setPasswordRequired(true);
                // If password was provided but failed, show "incorrect password" error
                if (pwd) {
                    setError('Incorrect password. Please try again.');
                } else {
                    setError('Password required');
                }
            } else {
                setError(err.message || 'Failed to load document');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocument();
    }, [token, handle, documentNumber]);

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchDocument(password);
    };

    const fullPageBox = (child: React.ReactNode) => (
        <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {child}
        </Box>
    );

    if (loading && !document) {
        return fullPageBox(<CircularProgress />);
    }

    if (passwordRequired) {
        return (
            <Dialog open={true} maxWidth="xs" fullWidth>
                <form onSubmit={handlePasswordSubmit}>
                    <DialogTitle>Password Protected</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            This document is password protected. Please enter the password to view it.
                        </Typography>
                        <TextField
                            autoFocus
                            fullWidth
                            type={showPassword ? 'text' : 'password'}
                            label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle password visibility"
                                            onClick={() => setShowPassword(!showPassword)}
                                            onMouseDown={(e) => e.preventDefault()}
                                            edge="end"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                        {error && error !== 'Password required' && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button type="submit" variant="contained">Submit</Button>
                    </DialogActions>
                </form>
            </Dialog>
        );
    }

    if (error || !document) {
        return fullPageBox(<Alert severity="error">{error || 'Document not found'}</Alert>);
    }

    // Extract initial width from content
    const getInitialWidth = () => {
        if (!revision?.content) return '950px';
        try {
            const content = revision.content as any;
            return content.attrs?.['x-odocs-layoutWidth'] || '950px';
        } catch (e) {
            return '950px';
        }
    };

    const initialWidth = getInitialWidth();

    return (
        <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <EditorLayout
                editor={editor}
                document={document as any} // Cast to any to satisfy FileSystemEntry type requirement
                onContentChange={() => { }}
                onTitleChange={() => { }}
                onClose={() => { }} // No close action for public view? Or maybe redirect to home?
                saveStatus="saved"
                readOnly={true}
                initialWidth={initialWidth}
                shareToken={token}
                authorHandle={handle || (document as any).creator?.blogHandle}
                authorName={(document as any).creator?.displayName || (document as any).creator?.account?.legalName || document.lastModifiedBy || undefined}
                accessType={accessType}
            />
        </Box>
    );
};

export default ViewerPage;
