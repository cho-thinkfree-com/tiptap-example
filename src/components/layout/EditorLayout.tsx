import { AppBar, Box, Button, Drawer, IconButton, TextField, Toolbar, Tooltip, Typography } from '@mui/material';
import { RichTextEditorProvider } from 'mui-tiptap';
import MenuIcon from '@mui/icons-material/Menu';
import ShareIcon from '@mui/icons-material/Share';
import EditorToolbar from '../editor/EditorToolbar';
import EditorContentArea from '../editor/EditorContentArea';
import EditorTableOfContents from '../editor/EditorTableOfContents';
import { type FileSystemEntry } from '../../lib/api';
import type { Editor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import ShareDialog from '../editor/ShareDialog';
import { useI18n } from '../../lib/i18n';
import EditorWidthSelector from '../editor/EditorWidthSelector';
import ViewerTemplateSelector from '../editor/ViewerTemplateSelector';
import type { ViewerTemplate } from '../../lib/viewerTemplates';
import AuthorInfoButton from '../viewer/AuthorInfoButton';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import LinkIcon from '@mui/icons-material/Link';

interface EditorLayoutProps {
    editor: Editor | null;
    document: FileSystemEntry;
    onContentChange: () => void;
    onTitleChange: (newTitle: string) => void;
    onClose: () => void;
    saveStatus: 'saved' | 'unsaved' | 'saving';
    readOnly?: boolean;
    initialWidth?: string;
    shareToken?: string;
    authorHandle?: string;
    authorName?: string;
    accessType?: 'private' | 'link' | 'public';
    headerExtra?: React.ReactNode;
}

// Adaptive title component that reduces font size when overflowing
const AdaptiveTitle = ({ title }: { title: string }) => {
    const [fontSize, setFontSize] = useState('1.5rem');
    const [isOverflowed, setIsOverflowed] = useState(false);
    const titleRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Reset font size only when title changes
        setFontSize('1.5rem');
        setIsOverflowed(false);
    }, [title]);

    useEffect(() => {
        const checkOverflow = () => {
            const element = titleRef.current;
            if (!element) return;

            // Check current overflow state WITHOUT resetting font size
            const isOverflowing = element.scrollWidth > element.clientWidth;

            if (isOverflowing && fontSize === '1.5rem') {
                // Only reduce if currently at full size
                setFontSize('1.2rem');

                // Check again after font size change
                setTimeout(() => {
                    if (!element) return;
                    const stillOverflowing = element.scrollWidth > element.clientWidth;
                    setIsOverflowed(stillOverflowing);
                }, 50);
            } else if (isOverflowing && fontSize === '1.2rem') {
                // Already reduced, just update overflow state
                setIsOverflowed(true);
            } else {
                // Not overflowing
                setIsOverflowed(false);
            }
        };

        // Initial check after a brief delay
        const initialTimer = setTimeout(checkOverflow, 50);

        // Listen to window resize
        window.addEventListener('resize', checkOverflow);

        // Use ResizeObserver to detect container width changes
        const resizeObserver = new ResizeObserver(() => {
            checkOverflow();
        });

        if (titleRef.current) {
            resizeObserver.observe(titleRef.current);
        }

        return () => {
            clearTimeout(initialTimer);
            window.removeEventListener('resize', checkOverflow);
            resizeObserver.disconnect();
        };
    }, [fontSize, title]);

    return (
        <Tooltip title={title} placement="bottom" disableHoverListener={!isOverflowed}>
            <Typography
                ref={titleRef}
                sx={{
                    fontSize,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'text.primary',
                    pointerEvents: 'auto',
                    flexGrow: 1,
                    mr: 2,
                    transition: 'font-size 0.2s ease',
                    position: 'relative',
                    // Gradient fade effect when overflowed
                    ...(isOverflowed && {
                        maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                    }),
                }}
            >
                {title}
            </Typography>
        </Tooltip>
    );
};

const EditorLayout = ({ editor, document, onContentChange, onTitleChange, onClose, saveStatus, readOnly = false, initialWidth = '950px', shareToken, authorHandle, authorName, accessType = 'link', headerExtra }: EditorLayoutProps) => {
    const [tocOpen, setTocOpen] = useState(false);
    const [localTitle, setLocalTitle] = useState(document.name);
    const [shareOpen, setShareOpen] = useState(false);
    const [hasHeadings, setHasHeadings] = useState(false);
    const [showSavedStatus, setShowSavedStatus] = useState(true);
    const [viewerWidth, setViewerWidth] = useState(initialWidth);
    const [viewerTemplate, setViewerTemplate] = useState<ViewerTemplate>('original');
    const [publicStatus, setPublicStatus] = useState<'none' | 'public' | 'link' | 'expired'>('none');
    const { strings } = useI18n();

    useEffect(() => {
        setLocalTitle(document.name);
    }, [document.name]);

    useEffect(() => {
        setViewerWidth(initialWidth);
    }, [initialWidth]);

    // Check public status
    const checkPublicStatus = async () => {
        if (readOnly) return;
        try {
            const links = document.shareLinks || [];
            const activeLink = links.find((l: any) => !l.revokedAt);

            if (!activeLink) {
                setPublicStatus('none');
                return;
            }

            if (activeLink.expiresAt && new Date(activeLink.expiresAt) <= new Date()) {
                setPublicStatus('expired');
            } else {
                if (activeLink.accessType === 'public') {
                    setPublicStatus('public');
                } else {
                    setPublicStatus('link');
                }
            }
        } catch (error) {
            console.error('Failed to check public status:', error);
        }
    };

    useEffect(() => {
        checkPublicStatus();
    }, [document, shareOpen, readOnly]);

    // Auto-hide "Saved" status after 2 seconds
    useEffect(() => {
        if (saveStatus === 'saved') {
            setShowSavedStatus(true);
            const timer = setTimeout(() => {
                setShowSavedStatus(false);
            }, 2000);
            return () => clearTimeout(timer);
        } else {
            setShowSavedStatus(true);
        }
    }, [saveStatus]);

    useEffect(() => {
        if (editor) {
            editor.on('update', onContentChange);

            // Check for headings
            const checkHeadings = () => {
                let found = false;
                editor.state.doc.descendants((node) => {
                    if (node.type.name === 'heading') {
                        found = true;
                        return false; // Stop searching
                    }
                    return true;
                });
                setHasHeadings(found);
            };

            checkHeadings();
            editor.on('update', checkHeadings);

            return () => {
                editor.off('update', onContentChange);
                editor.off('update', checkHeadings);
            };
        }
    }, [editor, onContentChange]);

    const getSaveStatusText = () => {
        switch (saveStatus) {
            case 'saving':
                return 'Saving...';
            case 'saved':
                return 'Saved';
            default:
                return 'Unsaved changes';
        }
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;

        // Update local state immediately for responsive UI
        setLocalTitle(newTitle);

        // Call onTitleChange directly (debouncing handled in ConnectedEditor)
        if (newTitle.trim() && newTitle !== document.name) {
            onTitleChange(newTitle);
        }
    };

    const handleTitleBlur = () => {
        // If title is empty on blur, revert to document title
        if (!localTitle.trim()) {
            setLocalTitle(document.name);
        } else if (localTitle !== document.name) {
            // Save immediately on blur if changed
            onTitleChange(localTitle);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            // Revert to original title on ESC
            setLocalTitle(document.name);
            (e.target as HTMLInputElement).blur();
        }
    };


    return (
        <RichTextEditorProvider editor={editor}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                <AppBar position="static" color="default" elevation={1}>
                    <Toolbar sx={{ px: { xs: 2, sm: 4, lg: 6 } }}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="목차 열기"
                            onClick={() => setTocOpen(!tocOpen)}
                            sx={{
                                mr: readOnly ? 3 : 2, // More spacing in viewer mode
                                zIndex: 1, // Ensure it stays above the overlay
                            }}
                        >
                            <MenuIcon />
                        </IconButton>

                        {!readOnly && (
                            <Box
                                component="img"
                                src="/odocs-logo-small.png"
                                alt="odocs"
                                sx={{
                                    height: 24,
                                    mr: 2,
                                    display: 'block'
                                }}
                            />
                        )}

                        {/* Viewer Mode Title Overlay */}
                        {readOnly && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none', // Allow clicks to pass through to underlying buttons
                                    zIndex: 0
                                }}
                            >
                                <Box
                                    sx={{
                                        width: '100%',
                                        maxWidth: viewerWidth, // Use viewerWidth
                                        px: '48px', // Match EditorContentArea padding
                                        pl: '72px', // Extra left padding to avoid TOC button overlap
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        alignItems: 'center',
                                        position: 'relative', // For absolute positioning of children if needed
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src="/odocs-logo-small.png"
                                        alt="odocs"
                                        sx={{
                                            height: 24,
                                            mr: 2,
                                            display: 'block'
                                        }}
                                    />
                                    <AdaptiveTitle title={localTitle} />

                                    {/* Viewer Width Selector */}
                                    <Box sx={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center' }}>
                                        <EditorWidthSelector
                                            editor={null}
                                            readOnly={true}
                                            value={viewerWidth}
                                            onChange={setViewerWidth}
                                            initialWidth={initialWidth}
                                        />
                                        <ViewerTemplateSelector
                                            value={viewerTemplate}
                                            onChange={setViewerTemplate}
                                        />
                                        {(shareToken || authorHandle) && (
                                            <AuthorInfoButton
                                                token={shareToken || ''}
                                                handle={authorHandle}
                                                authorName={authorName || document.lastModifiedBy || undefined}
                                                document={document}
                                                accessType={accessType}
                                            />
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', zIndex: 1 }}>
                            {!readOnly && (
                                <>
                                    <TextField
                                        value={localTitle}
                                        onChange={handleTitleChange}
                                        onBlur={handleTitleBlur}
                                        onKeyDown={handleKeyDown}
                                        placeholder={document.name}
                                        variant="standard"
                                        InputProps={{
                                            disableUnderline: true,
                                            sx: {
                                                fontSize: '1.5rem',
                                                fontWeight: 700,
                                            }
                                        }}
                                        sx={{ minWidth: 200 }}
                                    />
                                    {publicStatus === 'public' && (
                                        <Tooltip title="Published to web">
                                            <PublicIcon
                                                color="success"
                                                fontSize="small"
                                                sx={{ ml: 1 }}
                                            />
                                        </Tooltip>
                                    )}
                                    {publicStatus === 'link' && (
                                        <Tooltip title="Shared via link">
                                            <LinkIcon
                                                color="primary"
                                                fontSize="small"
                                                sx={{ ml: 1 }}
                                            />
                                        </Tooltip>
                                    )}
                                    {publicStatus === 'expired' && (
                                        <Tooltip title="Public link expired">
                                            <PublicOffIcon
                                                color="disabled"
                                                fontSize="small"
                                                sx={{ ml: 1 }}
                                            />
                                        </Tooltip>
                                    )}
                                </>
                            )}

                            {!readOnly && (saveStatus !== 'saved' || showSavedStatus) && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        ml: 2,
                                        whiteSpace: 'nowrap',
                                        pt: 1 // Align baseline with title roughly
                                    }}
                                >
                                    {getSaveStatusText()}
                                </Typography>
                            )}

                            {localTitle !== document.name && (
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        ml: 2,
                                        fontSize: '0.75rem',
                                        whiteSpace: 'nowrap',
                                        pt: 1
                                    }}
                                >
                                    ESC to cancel
                                </Typography>
                            )}
                        </Box>
                        {!readOnly && (
                            <Box sx={{ mr: 2, display: { xs: 'none', md: 'block' } }}>
                                <EditorWidthSelector editor={editor} onContentChange={onContentChange} initialWidth={initialWidth} />
                            </Box>
                        )}
                        {!readOnly && headerExtra}
                        {!readOnly && (
                            <Button
                                color="primary"
                                variant="outlined"
                                onClick={() => setShareOpen(true)}
                                sx={{ mr: 1 }}
                                startIcon={<ShareIcon />}
                            >
                                {strings.editor.title.share || 'Share'}
                            </Button>
                        )}
                        {!readOnly && (
                            <Button color="primary" variant="contained" onClick={onClose}>
                                Close
                            </Button>
                        )}
                    </Toolbar>
                </AppBar>
                <ShareDialog
                    open={shareOpen}
                    onClose={() => setShareOpen(false)}
                    documentId={document.id}
                    document={document}
                />
                {!readOnly && (
                    <Box sx={{
                        zIndex: 2,
                        position: 'relative',
                        backgroundColor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider'
                    }}>
                        <EditorToolbar
                            showTableOfContentsToggle={false}
                            tableOfContentsOpen={tocOpen}
                            onToggleTableOfContents={() => setTocOpen(!tocOpen)}
                            document={document}
                        />
                    </Box>
                )}
                <Box sx={{
                    flexGrow: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 0,
                    px: 0,
                }}>
                    <EditorContentArea
                        readOnly={readOnly}
                        initialWidth={initialWidth}
                        overrideWidth={readOnly ? viewerWidth : undefined}
                        viewerTemplate={readOnly ? viewerTemplate : undefined}
                    />
                </Box>
                <Drawer
                    anchor="left"
                    open={tocOpen}
                    onClose={() => setTocOpen(false)}
                    variant="temporary"
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: 280,
                            boxSizing: 'border-box',
                            p: 2,
                        },
                    }}
                >
                    <EditorTableOfContents onClose={() => setTocOpen(false)} readOnly={readOnly} />
                </Drawer>
            </Box>
        </RichTextEditorProvider >
    );
};

export default EditorLayout;
