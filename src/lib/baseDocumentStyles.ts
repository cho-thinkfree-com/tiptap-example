import type { SxProps, Theme } from '@mui/material';

/**
 * Base styles for the document content (Editor and Viewer).
 * These styles are applied to the ProseMirror content area.
 * 
 * Currently, this is minimal to match the default Editor behavior (MUI body1 + User Agent defaults).
 * Centralizing it here allows for easy global style updates.
 */
export const baseDocumentStyles: SxProps<Theme> = {
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
    '& h1, & h2, & h3, & h4, & h5, & h6': {
        // marginTop: '1em',
        // marginBottom: '0.5em',
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

    // Image border styles (thin: 얇은 테두리, medium: 굵은 테두리)
    '& img[data-border="thin"]': {
        border: '1px solid #ccc',
    },
    '& img[data-border="medium"]': {
        border: '3px solid #666',
    },
    '& img[data-border-radius="rounded"]': {
        borderRadius: '8px',
    },
    '& img[data-border-radius="circle"]': {
        borderRadius: '9999px',
    },
};
