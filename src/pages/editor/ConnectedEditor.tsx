import { Alert, Box, CircularProgress, Snackbar, Avatar, Tooltip } from '@mui/material';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom'; // Import useSearchParams
import { useAuth } from '../../context/AuthContext';
import { renameFileSystemEntry, type FileSystemEntry, getFileSystemEntry, updateDocumentContent } from '../../lib/api';
import EditorLayout from '../../components/layout/EditorLayout';
import useEditorInstance from '../../editor/useEditorInstance';
import { useDebouncedCallback } from '../../lib/useDebounce';
import { broadcastSync } from '../../lib/syncEvents';
import { usePageTitle } from '../../hooks/usePageTitle';
import CloseOverlay from '../../components/editor/CloseOverlay';
import { useFileEvents } from '../../hooks/useFileEvents';
import { HocuspocusProvider } from '@hocuspocus/provider';
import Collaboration from '@tiptap/extension-collaboration';
// import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';

// Random color generator for cursors
const getRandomColor = () => {
    const colors = ['#958DF1', '#F98181', '#FBBC88', '#FAF594', '#70CFF8', '#94FADB', '#B9F18D'];
    return colors[Math.floor(Math.random() * colors.length)];
};

type ConnectedEditorProps = {
    document: FileSystemEntry;
    initialContent: any;
};

type CloseFlowState = null | 'saving' | 'success' | 'error';

// Standard Editor (REST API based)
const StandardEditorInternal = ({
    document: initialDocument,
    initialContent,
    onBlockLimitReached
}: {
    document: FileSystemEntry,
    initialContent: any,
    onBlockLimitReached: () => void
}) => {
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
    const [currentDocument, setCurrentDocument] = useState(initialDocument);
    const [closeFlowState, setCloseFlowState] = useState<CloseFlowState>(null);

    usePageTitle(currentDocument.name, saveStatus === 'unsaved' || saveStatus === 'saving');

    const handleSave = useCallback(async (content: any) => {
        setSaveStatus('saving');
        try {
            await updateDocumentContent(currentDocument.id, content);
            setSaveStatus('saved');
        } catch (err) {
            console.error('Save failed:', err);
            setSaveStatus('unsaved');
        }
    }, [currentDocument.id]);

    const debouncedSave = useDebouncedCallback(handleSave, 2000);

    const handleContentChange = useCallback((editor: any) => {
        setSaveStatus('unsaved');
        debouncedSave(editor.getJSON());
    }, [debouncedSave]);

    const editor = useEditorInstance({
        content: initialContent,
        shouldSetInitialContent: true,
        extensionOptions: {
            onBlockLimitReached,
        },
        onError: (err) => {
            console.error('Editor Error', err);
        }
    });

    const handleTitleSave = useCallback(async (newTitle: string) => {
        if (!newTitle.trim()) return;
        try {
            await renameFileSystemEntry(currentDocument.id, newTitle);
            setCurrentDocument(prev => ({ ...prev, name: newTitle }));

            broadcastSync({
                type: 'document-updated',
                workspaceId: currentDocument.workspaceId,
                folderId: currentDocument.parentId,
                documentId: currentDocument.id,
                data: { title: newTitle }
            });
        } catch (err) {
            console.error(err);
        }
    }, [currentDocument]);

    const debouncedTitleSave = useDebouncedCallback(handleTitleSave, 2000);

    const handleTitleChange = (newTitle: string) => {
        debouncedTitleSave(newTitle);
    };

    const handleClose = async () => {
        if (saveStatus === 'saved') {
            window.close();
            return;
        }

        setCloseFlowState('saving');
        // Force immediate save if needed, but for now rely on debounce or prompt
        // Ideally we would flush the debounce here.
        if (editor) {
            try {
                await updateDocumentContent(currentDocument.id, editor.getJSON());
                setCloseFlowState('success');
                setTimeout(() => window.close(), 500);
            } catch (e) {
                setCloseFlowState('error');
            }
        }
    };

    if (!editor) {
        return (
            <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <EditorLayout
                editor={editor}
                document={currentDocument}
                onContentChange={() => handleContentChange(editor)}
                onTitleChange={handleTitleChange}
                onClose={handleClose}
                saveStatus={saveStatus}
                initialWidth={'950px'}
            />
            <CloseOverlay
                open={closeFlowState !== null}
                state={closeFlowState || 'saving'}
                onCloseNow={() => window.close()}
                onDismiss={() => setCloseFlowState(null)}
            />
        </>
    );
};

// Collaborative Editor (Hocuspocus + Yjs)
const CollaborativeEditorInternal = ({
    document: initialDocument,
    provider,
    user,
    onBlockLimitReached
}: {
    document: FileSystemEntry,
    provider: HocuspocusProvider,
    user: any,
    onBlockLimitReached: () => void
}) => {
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
    const [currentDocument, setCurrentDocument] = useState(initialDocument);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [closeFlowState, setCloseFlowState] = useState<CloseFlowState>(null);

    // Update page title when document name changes
    usePageTitle(currentDocument.name, saveStatus === 'unsaved' || saveStatus === 'saving');

    // Provider Status & Awareness
    useEffect(() => {
        if (!provider) return;

        const updateStatus = (data: { status: string }) => {
            if (data.status === 'connected') setSaveStatus('saved');
            else if (data.status === 'connecting') setSaveStatus('saving');
            else if (data.status === 'disconnected') setSaveStatus('unsaved');
        };

        const updateAwareness = ({ states }: { states: any[] }) => {
            const users = states
                .filter((state: any) => state.clientId !== provider.document.clientID)
                .map((state: any) => state.user)
                .filter(Boolean);
            setActiveUsers(users);
        };

        provider.on('status', updateStatus);
        provider.on('awarenessUpdate', updateAwareness);

        return () => {
            provider.off('status', updateStatus);
            provider.off('awarenessUpdate', updateAwareness);
        };
    }, [provider]);

    // Listen for file updates
    useFileEvents({
        workspaceId: currentDocument.workspaceId,
        onFileUpdated: async (event) => {
            if (event.fileId === currentDocument.id) {
                try {
                    const updatedDoc = await getFileSystemEntry(currentDocument.id);
                    setCurrentDocument(prev => ({ ...prev, ...updatedDoc, shareLinks: updatedDoc.shareLinks }));
                } catch (error) {
                    console.error('Failed to update document metadata from event:', error);
                }
            }
        }
    });

    // Collaborative Extensions
    const collaborationExtensions = useMemo(() => {
        return [
            Collaboration.configure({
                document: provider.document,
                field: 'default',
            }),
            // CollaborationCursor.configure({
            //     provider: provider,
            //     user: {
            //         name: user?.legalName || 'User',
            //         color: getRandomColor(),
            //     }
            // }),
        ];
    }, [provider, user]);

    // Editor Instance
    const editor = useEditorInstance({
        waitForContent: false,
        shouldSetInitialContent: false, // Don't overwrite Yjs content
        extensions: collaborationExtensions,
        extensionOptions: {
            onBlockLimitReached,
        },
        onError: (err) => {
            console.error('Editor Error', err);
        }
    });

    // Handle Title Save (Still REST API for renaming)
    const handleTitleSave = useCallback(async (newTitle: string) => {
        if (!newTitle.trim()) return;
        try {
            await renameFileSystemEntry(currentDocument.id, newTitle);
            setCurrentDocument({ ...currentDocument, name: newTitle });

            // Broadcast document update to other tabs
            broadcastSync({
                type: 'document-updated',
                workspaceId: currentDocument.workspaceId,
                folderId: currentDocument.parentId,
                documentId: currentDocument.id,
                data: { title: newTitle }
            });
        } catch (err) {
            console.error(err);
        }
    }, [currentDocument]);

    const debouncedTitleSave = useDebouncedCallback(handleTitleSave, 2000);

    const handleContentChange = () => {
        // Handled by Yjs automatically
    };

    const handleTitleChange = (newTitle: string) => {
        debouncedTitleSave(newTitle);
    };

    const handleClose = async () => {
        if (saveStatus === 'saved') {
            window.close();
            return;
        }
        window.close();
    };

    const initialWidth = '950px';

    if (!editor) {
        return (
            <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <EditorLayout
                editor={editor}
                document={currentDocument}
                onContentChange={handleContentChange}
                onTitleChange={handleTitleChange}
                onClose={handleClose}
                saveStatus={saveStatus}
                initialWidth={initialWidth}
                headerExtra={
                    <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
                        {activeUsers.map((u, i) => (
                            <Tooltip key={i} title={u.name}>
                                <Avatar
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        fontSize: 12,
                                        bgcolor: u.color,
                                        border: '2px solid white'
                                    }}
                                >
                                    {u.name[0]?.toUpperCase()}
                                </Avatar>
                            </Tooltip>
                        ))}
                    </Box>
                }
            />
            <CloseOverlay
                open={closeFlowState !== null}
                state={closeFlowState || 'saving'}
                onCloseNow={() => window.close()}
                onDismiss={() => setCloseFlowState(null)}
            />
        </>
    );
};

const ConnectedEditor = ({ document, initialContent }: ConnectedEditorProps) => {
    const { isAuthenticated, user } = useAuth();
    const [blockLimitSnackbar, setBlockLimitSnackbar] = useState(false);
    const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
    const [searchParams] = useSearchParams();

    // Check mode
    const isCollabMode = searchParams.get('mode') === 'collaboration';

    // Setup Hocuspocus Provider (Only if in collab mode)
    useEffect(() => {
        if (!isCollabMode) return;
        if (!isAuthenticated || !user) return;
        if (provider) return;

        const ydoc = new Y.Doc();
        ydoc.on('update', (update, origin) => {
            console.log('[Client] YDoc Updated. Origin:', origin, 'Size:', update.length);
        });

        const newProvider = new HocuspocusProvider({
            url: import.meta.env.VITE_HOCUSPOCUS_URL || 'ws://localhost:9930',
            name: document.id,
            document: ydoc,
            onAuthenticationFailed: () => console.error('Authentication failed'),
        });

        newProvider.setAwarenessField('user', {
            name: user.legalName || user.email.split('@')[0],
            color: getRandomColor(),
            avatar: '',
        });

        setProvider(newProvider);

        return () => {
            newProvider.destroy();
            setProvider(null);
        };
    }, [isAuthenticated, document.id, user, isCollabMode]);

    const handleBlockLimitReached = useCallback(() => {
        setBlockLimitSnackbar(true);
    }, []);

    if (isCollabMode && !provider) {
        return (
            <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            {isCollabMode ? (
                <CollaborativeEditorInternal
                    document={document}
                    provider={provider!}
                    user={user}
                    onBlockLimitReached={handleBlockLimitReached}
                />
            ) : (
                <StandardEditorInternal
                    document={document}
                    initialContent={initialContent}
                    onBlockLimitReached={handleBlockLimitReached}
                />
            )}

            <Snackbar
                open={blockLimitSnackbar}
                autoHideDuration={4000}
                onClose={() => setBlockLimitSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setBlockLimitSnackbar(false)}
                    severity="error"
                    variant="filled"
                >
                    문서 블록 수가 1,000개 제한에 도달했습니다. 새 블록을 추가하려면 기존 블록을 삭제해주세요.
                </Alert>
            </Snackbar>
        </>
    );
};

export default ConnectedEditor;
