import { Alert, Box, CircularProgress, Snackbar, Avatar, Tooltip } from '@mui/material';
import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { renameFileSystemEntry, type FileSystemEntry, getFileSystemEntry, updateDocumentContent, getDocumentContent, getWorkspaceMemberProfile, type MembershipSummary } from '../../lib/api';
import EditorLayout from '../../components/layout/EditorLayout';
import useEditorInstance from '../../editor/useEditorInstance';
import { useDebouncedCallback } from '../../lib/useDebounce';
import { broadcastSync } from '../../lib/syncEvents';
import { usePageTitle } from '../../hooks/usePageTitle';
import CloseOverlay from '../../components/editor/CloseOverlay';
import { useFileEvents } from '../../hooks/useFileEvents';
import { HocuspocusProvider } from '@hocuspocus/provider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import * as Y from 'yjs';
import { useDocumentLock, type LockStatus } from '../../hooks/useDocumentLock';
import { LockBanner, StealDialog } from '../../components/editor/LockComponents';
import { HOCUSPOCUS_URL } from '../../lib/env';

// Random color generator for cursors
const getRandomColor = () => {
    const colors = [
        '#ef5350', // Red 400
        '#ec407a', // Pink 400
        '#ab47bc', // Purple 400
        '#7e57c2', // Deep Purple 400
        '#5c6bc0', // Indigo 400
        '#42a5f5', // Blue 400
        '#29b6f6', // Light Blue 400
        '#26c6da', // Cyan 400
        '#26a69a', // Teal 400
        '#66bb6a', // Green 400
        '#9ccc65', // Light Green 400
        '#d4e157', // Lime 400 (Check contrast) -> Maybe too light. Let's use 600s for dark text or 700s for white text?
        // User said "background is yellow, text is white... low contrast".
        // They want DARKER backgrounds so white text pops.
        // So I should pick 600/700 shades or similar vibrant but dark colors.

        '#d32f2f', // Red 700
        '#c2185b', // Pink 700
        '#7b1fa2', // Purple 700
        '#512da8', // Deep Purple 700
        '#303f9f', // Indigo 700
        '#1976d2', // Blue 700
        '#0288d1', // Light Blue 700
        '#0097a7', // Cyan 700
        '#00796b', // Teal 700
        '#388e3c', // Green 700
        '#689f38', // Light Green 700
        '#afb42b', // Lime 700
        '#fbc02d', // Yellow 700 (Darker yellow/orange)
        '#ffa000', // Amber 700
        '#f57c00', // Orange 700
        '#e64a19', // Deep Orange 700
        '#5d4037', // Brown 700
        '#616161', // Grey 700
        '#455a64'  // Blue Grey 700
    ];
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
    onBlockLimitReached,
    readOnly,
    lockBanner,
    alertMessage,
    countdown,
    onEarlyRelease,
    onRejectSteal,
    onAlertClose
}: {
    document: FileSystemEntry,
    initialContent: any,
    onBlockLimitReached: () => void,
    readOnly?: boolean,
    lockBanner?: React.ReactNode,
    // Props for Steal Alert & Early Release
    alertMessage?: { title: string; message: string; type: 'warning' | 'info' | 'error' } | null,
    countdown?: number | null,
    onEarlyRelease?: () => void,
    onRejectSteal?: () => void,
    onAlertClose?: () => void
}) => {
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
    const [currentDocument, setCurrentDocument] = useState(initialDocument);
    const [closeFlowState, setCloseFlowState] = useState<CloseFlowState>(null);

    usePageTitle(currentDocument.name, saveStatus === 'unsaved' || saveStatus === 'saving');

    const handleSave = useCallback(async (content: any) => {
        if (readOnly) return;
        setSaveStatus('saving');
        try {
            await updateDocumentContent(currentDocument.id, content);
            setSaveStatus('saved');
        } catch (err) {
            console.error('Save failed:', err);
            setSaveStatus('unsaved');
        }
    }, [currentDocument.id, readOnly]);

    const debouncedSave = useDebouncedCallback(handleSave, 5000);

    const handleContentChange = useCallback(({ editor, transaction }: { editor: any, transaction: any }) => {
        if (readOnly) return;
        if (!transaction.docChanged) return;

        setSaveStatus('unsaved');
        debouncedSave(editor.getJSON());
    }, [debouncedSave, readOnly]);

    const extensionOptions = useMemo(() => ({
        onBlockLimitReached,
    }), [onBlockLimitReached]);

    const editor = useEditorInstance({
        content: initialContent,
        shouldSetInitialContent: true,
        editable: !readOnly,
        extensionOptions,
        onError: (err) => {
            console.error('Editor Error', err);
        }
    });

    // Update editable state if readOnly prop changes
    useEffect(() => {
        if (editor) {
            editor.setEditable(!readOnly);
        }
    }, [editor, readOnly]);

    // Update content if initialContent changes (for viewers)
    useEffect(() => {
        if (editor && readOnly && initialContent) {
            const currentJSON = editor.getJSON();
            if (JSON.stringify(currentJSON) !== JSON.stringify(initialContent)) {
                editor.commands.setContent(initialContent, { emitUpdate: false });
            }
        }
    }, [editor, readOnly, initialContent]);

    const handleEarlyReleaseWithSave = async () => {
        if (editor && !readOnly) {
            // Force immediate save
            try {
                setSaveStatus('saving');
                await updateDocumentContent(currentDocument.id, editor.getJSON());
                setSaveStatus('saved');
            } catch (e) {
                console.error('Failed to save before early release', e);
            }
        }
        if (onEarlyRelease) {
            onEarlyRelease();
        }
    };

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

    const debouncedTitleSave = useDebouncedCallback(handleTitleSave, 5000);

    const handleTitleChange = (newTitle: string) => {
        if (readOnly) return;
        debouncedTitleSave(newTitle);
    };

    const handleClose = async () => {
        if (saveStatus === 'saved' || readOnly) {
            window.close();
            return;
        }

        setCloseFlowState('saving');
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

    // Determine banner content
    let topBanner = lockBanner;

    // Check for Steal Warning to override/append banner
    if (alertMessage?.type === 'warning' && countdown !== null) {
        topBanner = (
            <Box sx={{
                width: '100%',
                bgcolor: '#fff4e5', // Warning orange light
                color: '#663c00',
                p: '10px 24px',
                borderBottom: '1px solid #ffcca0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: '0.95rem',
                fontWeight: 500,
                zIndex: 10
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>⚠️ 다른 사용자가 편집 권한을 요청했습니다. <strong>{countdown}초</strong> 후 권한이 넘어갑니다.</span>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <button
                        onClick={handleEarlyReleaseWithSave}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#ed6c02',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        지금 반납 (허용)
                    </button>
                    <button
                        onClick={onRejectSteal}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            color: '#ed6c02', // Orange text
                            border: '1px solid #ed6c02',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        거절
                    </button>
                </Box>
            </Box>
        );
    }

    return (
        <>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {topBanner}
                <EditorLayout
                    editor={editor}
                    document={currentDocument}
                    onContentChange={handleContentChange}
                    onTitleChange={handleTitleChange}
                    onClose={handleClose}
                    saveStatus={saveStatus}
                    initialWidth={'950px'}
                    readOnly={readOnly}
                />
            </Box>
            <CloseOverlay
                open={closeFlowState !== null}
                state={closeFlowState || 'saving'}
                onCloseNow={() => window.close()}
                onDismiss={() => setCloseFlowState(null)}
            />

            <Snackbar
                open={!!alertMessage && alertMessage.type !== 'warning'} // Hide warning from snackbar
                autoHideDuration={6000}
                onClose={(_e, _reason) => {
                    if (onAlertClose) onAlertClose();
                }}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={alertMessage?.type || 'info'} onClose={onAlertClose}>
                    {alertMessage?.title && <strong>{alertMessage.title}: </strong>}
                    {alertMessage?.title === '편집 종료 중' && countdown !== null ? (
                        <span>편집 권한을 넘겨주는 중입니다. (저장 및 정리 중... {countdown}초)</span>
                    ) : (
                        alertMessage?.message
                    )}
                </Alert>
            </Snackbar>
        </>
    );
};

// Core Editor Component - Mounted only when provider and profile are ready
const CollaborativeEditorCore = ({
    document: initialDocument,
    provider,
    userProfile,
    onBlockLimitReached,
    lockBanner
}: {
    document: FileSystemEntry,
    provider: HocuspocusProvider,
    userProfile: MembershipSummary | { displayName: string, avatarUrl: string | null },
    onBlockLimitReached: () => void,
    lockBanner?: React.ReactNode
}) => {
    const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
    const [currentDocument, setCurrentDocument] = useState(initialDocument);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [closeFlowState, setCloseFlowState] = useState<CloseFlowState>(null);

    usePageTitle(currentDocument.name, saveStatus === 'unsaved' || saveStatus === 'saving');

    useEffect(() => {
        if (!provider) return;

        const updateStatus = (data: { status: string }) => {
            if (data.status === 'connected') setSaveStatus('saved');
            else if (data.status === 'connecting') setSaveStatus('saving');
            else if (data.status === 'disconnected') setSaveStatus('unsaved');
        };

        const updateAwareness = ({ states }: { states: any[] }) => {
            const myClientId = provider.document.clientID;
            const users = states
                .map((state: any) => ({
                    ...state.user,
                    isLocal: state.clientId === myClientId
                }))
                .filter((u: any) => u && u.name) // Filter out empty users
                .sort((a: any, b: any) => {
                    // Always put local user first
                    if (a.isLocal) return -1;
                    if (b.isLocal) return 1;
                    return 0;
                });
            setActiveUsers(users);
        };

        provider.on('status', updateStatus);
        provider.on('awarenessUpdate', updateAwareness);

        return () => {
            provider.off('status', updateStatus);
            provider.off('awarenessUpdate', updateAwareness);
        };
    }, [provider]);

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

    const extensionOptions = useMemo(() => ({
        onBlockLimitReached,
        history: false,
    }), [onBlockLimitReached]);

    const collaborationExtensions = useMemo(() => {
        return [
            Collaboration.configure({
                document: provider.document,
                field: 'default',
            }),
            CollaborationCaret.configure({
                provider: provider,
                user: {
                    name: userProfile.displayName,
                    color: getRandomColor(),
                    avatar: userProfile.avatarUrl || '',
                },
            }),
        ];
    }, [provider, userProfile]);

    const editor = useEditorInstance({
        waitForContent: false,
        shouldSetInitialContent: false,
        extensions: collaborationExtensions,
        extensionOptions,
        onError: (err) => {
            console.error('Editor Error', err);
        }
    });

    // Set awareness immediately on mount
    useEffect(() => {
        provider.setAwarenessField('user', {
            name: userProfile.displayName,
            color: getRandomColor(),
            avatar: userProfile.avatarUrl || '',
        });
    }, [provider, userProfile]);

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

    const debouncedTitleSave = useDebouncedCallback(handleTitleSave, 5000);

    const handleContentChange = () => {
        // Handled by Yjs automatically
    };

    const handleTitleChange = (newTitle: string) => {
        debouncedTitleSave(newTitle);
    };

    const handleClose = async () => {
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
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {lockBanner}
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
                            {activeUsers.length < 3 ? (
                                activeUsers.map((u, i) => (
                                    <Tooltip key={i} title={u.name}>
                                        <Avatar
                                            src={u.avatar}
                                            alt={u.name}
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
                                ))
                            ) : (
                                <Tooltip
                                    title={
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {activeUsers.map((u, i) => (
                                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar
                                                        src={u.avatar}
                                                        sx={{ width: 16, height: 16, fontSize: 8, bgcolor: u.color }}
                                                    >
                                                        {u.name[0]?.toUpperCase()}
                                                    </Avatar>
                                                    <span>{u.name}</span>
                                                </Box>
                                            ))}
                                        </Box>
                                    }
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {/* First User - Higher Z-Index */}
                                        {activeUsers[0] && (
                                            <Avatar
                                                src={activeUsers[0].avatar}
                                                alt={activeUsers[0].name}
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    fontSize: 12,
                                                    bgcolor: activeUsers[0].color,
                                                    border: '2px solid white',
                                                    zIndex: 2,
                                                    position: 'relative'
                                                }}
                                            >
                                                {activeUsers[0].name[0]?.toUpperCase()}
                                            </Avatar>
                                        )}
                                        {/* More Users Indicator - Lower Z-Index, Overlap */}
                                        <Avatar
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                fontSize: 12,
                                                bgcolor: '#e0e0e0',
                                                color: '#000',
                                                border: '2px solid white',
                                                ml: -1.5, // Overlap (approx 12px)
                                                zIndex: 1, // Behind first user
                                                position: 'relative',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ...
                                        </Avatar>
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
                    }
                />
            </Box>
            <CloseOverlay
                open={closeFlowState !== null}
                state={closeFlowState || 'saving'}
                onCloseNow={() => window.close()}
                onDismiss={() => setCloseFlowState(null)}
            />
        </>
    );
};

// Collaborative Editor Loader (Handles Profile Fetching & Provider Init)
const CollaborativeEditorInternal = ({
    document: initialDocument,
    provider: _unusedProvider, // We create provider internally now
    user,
    onBlockLimitReached,
    lockBanner
}: {
    document: FileSystemEntry,
    provider: any, // kept for prop signature compatibility if needed, but ignored
    user: any,
    onBlockLimitReached: () => void,
    lockBanner?: React.ReactNode
}) => {
    const { isAuthenticated } = useAuth();
    const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
    const [memberProfile, setMemberProfile] = useState<MembershipSummary | { displayName: string, avatarUrl: string | null } | null>(null);

    // Fetch workspace member profile
    useEffect(() => {
        let mounted = true;
        const fetchProfile = async () => {
            try {
                const profile = await getWorkspaceMemberProfile(initialDocument.workspaceId);
                if (mounted && profile) {
                    setMemberProfile(profile);
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch member profile', err);
            }

            // Fallback
            if (mounted) {
                setMemberProfile({
                    displayName: user.legalName || user.email.split('@')[0],
                    avatarUrl: null
                });
            }
        };
        fetchProfile();
        return () => { mounted = false; };
    }, [initialDocument.workspaceId, user]);

    // Init Provider
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        if (provider) return;

        // isBlocked check handled by parent (ConnectedEditor) passing logic?
        // ConnectedEditor passes `isCollabMode` check.
        // But `isBlocked` (standard lock) logic in ConnectedEditor returns early.

        const ydoc = new Y.Doc();
        const newProvider = new HocuspocusProvider({
            url: HOCUSPOCUS_URL,
            name: initialDocument.id,
            document: ydoc,
            onAuthenticationFailed: () => console.error('Authentication failed'),
        });

        setProvider(newProvider);

        return () => {
            newProvider.destroy();
            setProvider(null);
        };
    }, [isAuthenticated, initialDocument.id, user]);

    if (!provider || !memberProfile) {
        return (
            <Box sx={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <CollaborativeEditorCore
            document={initialDocument}
            provider={provider}
            userProfile={memberProfile}
            onBlockLimitReached={onBlockLimitReached}
            lockBanner={lockBanner}
        />
    );
};

const ConnectedEditor = ({ document, initialContent }: ConnectedEditorProps) => {
    const { isAuthenticated, user } = useAuth();
    const [blockLimitSnackbar, setBlockLimitSnackbar] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();

    // 1. Check intent from URL
    const isCollabMode = searchParams.get('mode') === 'collaboration';

    // State for forcing editor remount/refresh when content changes (e.g. after steal)
    const [editorVersion, setEditorVersion] = useState(0);
    const [editorContent, setEditorContent] = useState(initialContent);

    const handleLockAcquired = useCallback(async () => {
        // Fetch fresh content from server
        try {
            console.log('Lock acquired! Fetching fresh content...');
            // Use specific endpoint for content to ensure we get the full JSON body
            const freshContent = await getDocumentContent(document.id);

            if (freshContent) {
                setEditorContent(freshContent);
                setEditorVersion(prev => prev + 1); // Increment version to force remount/reset
                setAlertMessage({
                    title: '권한 획득 성공',
                    message: '편집 권한을 획득했습니다. 최신 내용으로 갱신되었습니다.',
                    type: 'info'
                });
            }
        } catch (e) {
            console.error('Failed to fetch fresh content after lock acquisition', e);
        }
    }, [document.id]);

    // 2. Setup Lock Hook
    // If IS collab mode, we still want to 'join' status but NOT auto-acquire 'standard' lock.
    const {
        status,
        lockHolder,
        requestSteal,
        alertMessage,
        setAlertMessage,
        stealState,
        stealErrorMessage,
        countdown,
        earlyRelease,
        rejectSteal,
        cancelSteal,
        queuePosition
    } = useDocumentLock({
        docId: document.id,
        workspaceId: document.workspaceId,
        displayName: user?.legalName || user?.email || 'Unknown User',
        enabled: !isCollabMode, // Only acquire if NOT in collab mode
        onLockAcquired: handleLockAcquired
    });

    // Track previous status to detect potential content updates
    const prevStatusRef = useRef<LockStatus>(status);
    const prevHolderRef = useRef<string | undefined>(lockHolder?.socketId);

    useEffect(() => {
        const checkContentUpdate = async () => {
            // If we are NOT the holder (viewing), and lock changed owner or released
            if (status !== 'acquired' && status !== 'loading') {
                // Check if lock ownership changed (e.g. A -> B, or A -> Idle)
                // This usually implies a save might have happened.
                const holderChanged = prevHolderRef.current !== lockHolder?.socketId;
                const statusChanged = prevStatusRef.current !== status;

                if (holderChanged || (statusChanged && prevStatusRef.current === 'acquired')) {
                    // Fetch latest content
                    try {
                        const freshContent = await getDocumentContent(document.id);
                        if (freshContent) {
                            console.log('Detected lock change, updating viewer content...');
                            setEditorContent(freshContent);
                            // We don't increment version here because we want to update IN PLACE via the new useEffect in StandardEditorInternal
                            // But incrementing version would also work (remount).
                            // In-place update is smoother.
                        }
                    } catch (e) {
                        console.error('Failed to update viewer content', e);
                    }
                }
            }
            prevStatusRef.current = status;
            prevHolderRef.current = lockHolder?.socketId;
        };

        checkContentUpdate();
    }, [status, lockHolder?.socketId, document.id]);

    // 3. Setup Hocuspocus (Only if intended Collab Mode AND NOT Blocked by Standard Lock)
    // This logic is now handled internally by CollaborativeEditorInternal
    // const isBlocked = status === 'locked_standard'; // This check is still relevant for rendering decisions

    const handleBlockLimitReached = useCallback(() => {
        setBlockLimitSnackbar(true);
    }, []);

    const handleSwitchToCollab = () => {
        setSearchParams(prev => {
            prev.set('mode', 'collaboration');
            return prev;
        });
        window.location.reload();
    };

    const handleSwitchToStandard = () => {
        // If we want to switch to Standard AND Steal
        setSearchParams(prev => {
            prev.delete('mode');
            return prev;
        });
        // We might want to trigger steal immediately? But simpler to reload and let user click 'Steal'.
        window.location.reload();
    };

    // --- Decision Logic for Viewing Mode ---

    // Case 1: Intended Standard Mode
    if (!isCollabMode) {
        // Locked by other?
        const isLockedByStandard = status === 'locked_standard';
        const isLockedByCollab = status === 'locked_collab';
        const isLoading = status === 'loading';
        const isLocked = isLockedByStandard || isLockedByCollab || isLoading;

        if (isLoading && !editorContent) {
            return (
                <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress />
                </Box>
            );
        }

        return (
            <>
                <StandardEditorInternal
                    key={editorVersion}
                    document={document}
                    initialContent={editorContent}
                    onBlockLimitReached={handleBlockLimitReached}
                    readOnly={isLocked}
                    lockBanner={
                        isLocked ? (
                            <LockBanner
                                holderName={lockHolder?.displayName || 'Unknown'}
                                mode={isLockedByCollab ? 'collab' : 'standard'}
                                currentMode="standard"
                                onSteal={requestSteal}
                                onJoinCollab={handleSwitchToCollab}
                            />
                        ) : undefined
                    }
                    alertMessage={alertMessage}
                    countdown={countdown}
                    onEarlyRelease={earlyRelease}
                    onRejectSteal={rejectSteal}
                    onAlertClose={() => setAlertMessage(null)}
                />

                <StealDialog
                    open={stealState !== 'none'}
                    stealState={stealState}
                    countdown={countdown}
                    holderName={lockHolder?.displayName || 'Unknown'}
                    errorMessage={stealErrorMessage}
                    onCancel={cancelSteal}
                    queuePosition={queuePosition}
                />

                <Snackbar
                    open={blockLimitSnackbar}
                    autoHideDuration={4000}
                    onClose={() => setBlockLimitSnackbar(false)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity="error" variant="filled">
                        문서 블록 수가 1,000개 제한에 도달했습니다. 새 블록을 추가하려면 기존 블록을 삭제해주세요.
                    </Alert>
                </Snackbar>
            </>
        );
    }

    // Case 2: Intended Collab Mode
    if (isCollabMode) {
        // Locked by Standard?
        if (status === 'locked_standard') {
            // Blocked. Show ReadOnly Standard + Banner
            return (
                <>
                    <StandardEditorInternal
                        document={document}
                        initialContent={initialContent}
                        onBlockLimitReached={handleBlockLimitReached}
                        readOnly={true}
                        lockBanner={
                            <LockBanner
                                holderName={lockHolder?.displayName || 'Unknown'}
                                mode="standard"
                                currentMode="collab"
                                onSteal={handleSwitchToStandard} // Switch to Standard to attempt steal
                            />
                        }
                    />
                </>
            );
        }

        // Otherwise (idle or locked_collab), allow Hocuspocus
        // CollaborativeEditorInternal now handles provider creation and loading
        return (
            <>
                {/* Optional: Show banner if we are sole user vs joining existing? No need. */}
                <CollaborativeEditorInternal
                    document={document}
                    provider={null}
                    user={user}
                    onBlockLimitReached={handleBlockLimitReached}
                />
                <Snackbar
                    open={blockLimitSnackbar}
                    autoHideDuration={4000}
                    onClose={() => setBlockLimitSnackbar(false)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert severity="error" variant="filled">
                        문서 블록 수가 1,000개 제한에 도달했습니다.
                    </Alert>
                </Snackbar>
            </>
        );
    }

    return null;
};

export default ConnectedEditor;
