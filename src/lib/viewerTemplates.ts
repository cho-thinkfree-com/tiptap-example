export type ViewerTemplate = 'original' | 'large' | 'article';

export interface TemplateConfig {
    fontFamily: string;
    fontSize: string;
    lineHeight: number;
    contentWidth: string;
    headingScale: number;
    paragraphSpacing: string;
}

export const VIEWER_TEMPLATES: Record<ViewerTemplate, TemplateConfig> = {
    original: {
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: 1.5,
        contentWidth: '950px',
        headingScale: 1,
        paragraphSpacing: '1em',
    },
    large: {
        fontFamily: 'inherit',
        fontSize: '24px',
        lineHeight: 1.6,
        contentWidth: '950px',
        headingScale: 1.3,
        paragraphSpacing: '1.2em',
    },
    article: {
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: '18px',
        lineHeight: 1.8,
        contentWidth: '780px',
        headingScale: 1.5,
        paragraphSpacing: '1.2em',
    },
};

import type { Theme } from '@mui/material';
import { getBaseDocumentStyles } from './baseDocumentStyles';

export const getTemplateStyles = (template: ViewerTemplate, theme: Theme) => {
    const baseStyles = getBaseDocumentStyles(theme);

    if (template === 'original') {
        return baseStyles;
    }

    const config = VIEWER_TEMPLATES[template];

    return {
        ...baseStyles, // Inherit base styles
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        lineHeight: config.lineHeight,
        '& p': {
            marginBottom: config.paragraphSpacing,
        },
        '& h1': {
            fontSize: `calc(${config.fontSize} * ${config.headingScale} * 2)`,
            lineHeight: 1.2,
            marginTop: '1.5em',
            marginBottom: '0.5em',
        },
        '& h2': {
            fontSize: `calc(${config.fontSize} * ${config.headingScale} * 1.6)`,
            lineHeight: 1.3,
            marginTop: '1.3em',
            marginBottom: '0.4em',
        },
        '& h3': {
            fontSize: `calc(${config.fontSize} * ${config.headingScale} * 1.3)`,
            lineHeight: 1.4,
            marginTop: '1.2em',
            marginBottom: '0.3em',
        },
        '& h4, & h5, & h6': {
            fontSize: `calc(${config.fontSize} * ${config.headingScale})`,
            lineHeight: 1.4,
            marginTop: '1em',
            marginBottom: '0.3em',
        },
        '& ul, & ol': {
            marginBottom: config.paragraphSpacing,
        },
        '& li': {
            marginBottom: `calc(${config.paragraphSpacing} * 0.5)`,
        },
        '& pre': {
            fontFamily: "'Roboto Mono', monospace",
            fontSize: '14px',
        },
        '& code': {
            fontFamily: "'Roboto Mono', monospace",
            fontSize: '0.9em',
        },
    };
};
