import { AppBar, Box, Button, Drawer, IconButton, TextField, Toolbar, Typography } from '@mui/material';
import { RichTextEditorProvider } from 'mui-tiptap';
import MenuIcon from '@mui/icons-material/Menu';
import EditorToolbar from '../editor/EditorToolbar';
import EditorWorkspace from '../editor/EditorWorkspace';
import EditorTableOfContents from '../editor/EditorTableOfContents';
import type { DocumentSummary } from '../../lib/api';
import type { Editor } from '@tiptap/react';
import { useEffect, useState } from 'react';
import ShareDialog from '../editor/ShareDialog';

interface EditorLayoutProps {
    editor: Editor | null;
    document: DocumentSummary;
    onContentChange: () => void;
    onTitleChange: (newTitle: string) => void;
    onClose: () => void;
    saveStatus: 'saved' | 'unsaved' | 'saving';
    readOnly?: boolean;
}

const EditorLayout = ({ editor, document, onContentChange, onTitleChange, onClose, saveStatus, readOnly = false }: EditorLayoutProps) => {
    const [tocOpen, setTocOpen] = useState(false);
    const [localTitle, setLocalTitle] = useState(document.title);
    const [shareOpen, setShareOpen] = useState(false);
    const [hasHeadings, setHasHeadings] = useState(false);

    useEffect(() => {
        setLocalTitle(document.title);
    }, [document.title]);

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
        if (newTitle.trim() && newTitle !== document.title) {
            onTitleChange(newTitle);
        }
    };

    const handleTitleBlur = () => {
        // If title is empty on blur, revert to document title
        if (!localTitle.trim()) {
            setLocalTitle(document.title);
        } else if (localTitle !== document.title) {
            // Save immediately on blur if changed
            onTitleChange(localTitle);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            // Revert to original title on ESC
            setLocalTitle(document.title);
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
                                mr: 2,
                                visibility: (readOnly && !hasHeadings) ? 'hidden' : 'visible'
                            }}
                        >
                            <MenuIcon />
                        </IconButton>
                        {readOnly ? (
                            <Typography
                                sx={{
                                    fontSize: '2rem',
                                    fontWeight: 700,
                                    flexGrow: 1,
                                }}
                            >
                                {localTitle}
                            </Typography>
                        ) : (
                            <TextField
                                value={localTitle}
                                onChange={handleTitleChange}
                                onBlur={handleTitleBlur}
                                onKeyDown={handleKeyDown}
                                placeholder={document.title}
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: {
                                        fontSize: '2rem',
                                        fontWeight: 700,
                                    }
                                }}
                                sx={{ flexGrow: 1 }}
                            />
                        )}
                        {localTitle !== document.title && (
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    ml: 2,
                                    fontSize: '0.75rem',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                ESC to cancel
                            </Typography>
                        )}
                        {!readOnly && (
                            <Typography variant="body2" sx={{ mr: 1, ml: 2 }}>
                                {getSaveStatusText()}
                            </Typography>
                        )}
                        {!readOnly && (
                            <Button color="primary" variant="outlined" onClick={() => setShareOpen(true)} sx={{ mr: 1 }}>
                                Share
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
                />
                {!readOnly && (
                    <EditorToolbar
                        showTableOfContentsToggle={false}
                        tableOfContentsOpen={tocOpen}
                        onToggleTableOfContents={() => setTocOpen(!tocOpen)}
                    />
                )}
                <Box sx={{
                    flexGrow: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    p: 3,
                    px: { xs: 2, sm: 4, lg: 6 },
                }}>
                    <EditorWorkspace />
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
                    <EditorTableOfContents />
                </Drawer>
            </Box>
        </RichTextEditorProvider>
    );
};

export default EditorLayout;
