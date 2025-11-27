import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShareLink, type DocumentSummary, type DocumentRevision } from '../../lib/api';
import EditorLayout from '../../components/layout/EditorLayout';
import useEditorInstance from '../../editor/useEditorInstance';
import { useSEO } from '../../hooks/useSEO';

interface ViewerPageProps {
    isPublic?: boolean;
}

const ViewerPage = ({ isPublic = false }: ViewerPageProps) => {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [password, setPassword] = useState('');
    const [document, setDocument] = useState<DocumentSummary | null>(null);
    const [revision, setRevision] = useState<DocumentRevision | null>(null);

    const editor = useEditorInstance({
        content: revision?.content,
        editable: false, // Read-only for now
    });

    useEffect(() => {
        if (editor && revision?.content) {
            editor.commands.setContent(revision.content);

            // Restore doc attributes if needed
            if (
                typeof revision.content === 'object' &&
                revision.content !== null &&
                'attrs' in revision.content &&
                (revision.content as any).attrs
            ) {
                const attrs = (revision.content as any).attrs;
                if (attrs['x-odocs-layoutWidth']) {
                    editor.commands.updateAttributes('doc', {
                        'x-odocs-layoutWidth': attrs['x-odocs-layoutWidth']
                    });
                }
            }
        }
    }, [editor, revision]);

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
        title: document?.title || 'Shared Document',
        description: revision ? getTextContent(revision.content) : 'View shared document on ododocs',
        author: document?.lastModifiedBy || undefined,
        publishedTime: document?.createdAt,
        modifiedTime: revision?.createdAt,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        type: 'article',
        robots: isPublic ? 'index, follow' : 'noindex, nofollow',
    });


    const fetchDocument = async (pwd?: string) => {
        if (!token) return;
        console.log('[ViewerPage] Fetching document with token:', token);
        setLoading(true);
        setError(null);
        try {
            const result = await resolveShareLink(token, pwd);
            console.log('[ViewerPage] API response:', result);
            setDocument(result.document);
            setRevision(result.revision);
            setPasswordRequired(false);
            console.log('[ViewerPage] Document and revision set successfully');
        } catch (err: any) {
            console.error('[ViewerPage] Error fetching document:', err);
            console.error('[ViewerPage] Error message:', err.message);
            console.error('[ViewerPage] Error stack:', err.stack);
            if (err.message === 'Share link password required or incorrect' || err.message?.includes('password')) {
                setPasswordRequired(true);
                setError('Password required');
            } else {
                setError(err.message || 'Failed to load document');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocument();
    }, [token]);

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
                            type="password"
                            label="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {error && error !== 'Password required' && (
                            <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
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
                document={document}
                onContentChange={() => { }}
                onTitleChange={() => { }}
                onClose={() => { }} // No close action for public view? Or maybe redirect to home?
                saveStatus="saved"
                readOnly={true}
                initialWidth={initialWidth}
                shareToken={token}
            />
        </Box>
    );
};

export default ViewerPage;
