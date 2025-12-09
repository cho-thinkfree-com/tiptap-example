import type { SxProps, Theme } from '@mui/material';

/**
 * Base styles for the document content (Editor and Viewer).
 * These styles are applied to the ProseMirror content area.
 * 
 * Currently, this is minimal to match the default Editor behavior (MUI body1 + User Agent defaults).
 * Centralizing it here allows for easy global style updates.
 */
/**
 * Base styles for the document content (Editor and Viewer).
 * These styles are applied to the ProseMirror content area.
 * 
 * We now pull typography settings directly from the active MUI Theme
 * to ensure consistency across the application.
 * Editor-specific layout (like margins) are applied here.
 */
export const getBaseDocumentStyles = (theme: Theme): SxProps<Theme> => ({
    // Typography defaults
    // We explicitly set these to ensure consistency between Editor and Viewer
    // even if the Viewer is rendered in a different context.

    // Default paragraph styles
    '& p': {
        // Use browser/MUI default or define explicit base styles here
        // marginBottom: '1em', 
        // lineHeight: 1.5,
    },

    // Default heading styles
    '& h1': {
        ...theme.typography.h1,
        marginTop: '0.6em',
        marginBottom: '0.3em',
    },
    '& h2': {
        ...theme.typography.h2,
        marginTop: '0.6em',
        marginBottom: '0.3em',
        // fontSize is now inherited from theme.typography.h2
    },
    '& h3': {
        ...theme.typography.h3,
        marginTop: '0.6em',
        marginBottom: '0.3em',
    },
    '& h4': {
        ...theme.typography.h4,
        marginTop: '0.5em',
        marginBottom: '0.25em',
    },
    '& h5': {
        ...theme.typography.h5,
        marginTop: '0.4em',
        marginBottom: '0.2em',
    },
    '& h6': {
        ...theme.typography.h6,
        marginTop: '0.4em',
        marginBottom: '0.2em',
    },

    // List styles
    '& ul, & ol': {
        // paddingLeft: '1.5em',
    },

    // Code block styles
    '& pre': {
        // background: '#f5f5f5',
        // padding: '0.75em 1em',
        // borderRadius: '4px',
    },

    // Table cell styles - minimum width for better usability
    '& table td, & table th': {
        minWidth: '120px',
    },

    // Image border styles (thin: 얇은 테두리, medium: 굵은 테두리)
    '& img[data-border="thin"]': {
        boxShadow: '0 0 0 1px #ccc',
    },
    '& img[data-border="medium"]': {
        boxShadow: '0 0 0 3px #666',
    },
    '& img[data-border-radius="rounded"]': {
        borderRadius: '8px',
    },
    '& img[data-border-radius="circle"]': {
        borderRadius: '9999px',
    },

    // Resizable image styles
    '& .image-resizer': {
        display: 'inline-flex',
        position: 'relative',
        flexGrow: 0,
        '& img': {
            display: 'block',
        },
    },
    '& .image-resizer .resize-trigger': {
        position: 'absolute',
        right: -6,
        bottom: -6,
        width: 12,
        height: 12,
        background: '#1976d2',
        borderRadius: '50%',
        cursor: 'nwse-resize',
        opacity: 0,
        transition: 'opacity 0.2s',
    },
    '& .image-resizer:hover .resize-trigger': {
        opacity: 1,
    },
    '& .image-resizer.resizing .resize-trigger': {
        opacity: 1,
    },
});
