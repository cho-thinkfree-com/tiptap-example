import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShareLink, type DocumentSummary, type DocumentRevision } from '../../lib/api';
import EditorLayout from '../../components/layout/EditorLayout';
import useEditorInstance from '../../editor/useEditorInstance';
import { usePageTitle } from '../../hooks/usePageTitle';

const SharedDocumentPage = () => {
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
        }
    }, [editor, revision]);

    usePageTitle(document?.title || 'Shared Document');

    const fetchDocument = async (pwd?: string) => {
        if (!token) return;
        console.log('[SharedDocumentPage] Fetching document with token:', token);
        setLoading(true);
        setError(null);
        try {
            const result = await resolveShareLink(token, pwd);
            console.log('[SharedDocumentPage] API response:', result);
            setDocument(result.document);
            setRevision(result.revision);
            setPasswordRequired(false);
            console.log('[SharedDocumentPage] Document and revision set successfully');
        } catch (err: any) {
            console.error('[SharedDocumentPage] Error fetching document:', err);
            console.error('[SharedDocumentPage] Error message:', err.message);
            console.error('[SharedDocumentPage] Error stack:', err.stack);
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
            />
        </Box>
    );
};

export default SharedDocumentPage;
