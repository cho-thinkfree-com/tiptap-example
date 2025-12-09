import { createTheme, alpha } from '@mui/material/styles';

// Slate/Zinc Palette
const slate = {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
};

const violet = {
    500: '#6366f1',
    600: '#4f46e5',
};

export const baseTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: violet[600],
            light: violet[500],
            dark: '#4338ca',
            contrastText: '#ffffff',
        },
        secondary: {
            main: slate[800],
            light: slate[700],
            dark: slate[900],
            contrastText: '#ffffff',
        },
        background: {
            default: '#ffffff',
            paper: '#ffffff',
        },
        text: {
            primary: slate[900],
            secondary: slate[500],
        },
        divider: slate[200],
        action: {
            hover: alpha(slate[900], 0.04),
            selected: alpha(slate[900], 0.08),
            disabled: alpha(slate[900], 0.26),
            disabledBackground: alpha(slate[900], 0.12),
        },
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: {
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: slate[900],
        },
        h2: {
            fontSize: '2.25rem',
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: slate[900],
        },
        h3: {
            fontSize: '1.75rem',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: slate[900],
        },
        h4: {
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: slate[900],
        },
        h5: {
            fontSize: '1.25rem',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: slate[900],
        },
        h6: {
            fontSize: '1rem',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: slate[900],
        },
        subtitle1: {
            fontSize: '1rem',
            fontWeight: 500,
            color: slate[600],
        },
        subtitle2: {
            fontSize: '0.875rem',
            fontWeight: 500,
            color: slate[600],
        },
        body1: {
            fontSize: '1rem',
            lineHeight: 1.6,
            color: slate[700],
        },
        body2: {
            fontSize: '0.875rem',
            lineHeight: 1.57,
            color: slate[600],
        },
        button: {
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: '-0.01em',
        },
    },
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: '#ffffff',
                    color: slate[900],
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: 'none',
                    },
                    padding: '8px 16px',
                },
                containedPrimary: {
                    backgroundColor: slate[900],
                    color: '#ffffff',
                    '&:hover': {
                        backgroundColor: slate[800],
                    },
                },
                outlined: {
                    borderColor: slate[300],
                    color: slate[700],
                    '&:hover': {
                        borderColor: slate[400],
                        backgroundColor: slate[50],
                        color: slate[900],
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    border: `1px solid ${slate[200]}`,
                    backgroundImage: 'none',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                },
                elevation2: {
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                            borderColor: slate[200],
                        },
                        '&:hover fieldset': {
                            borderColor: slate[300],
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: slate[900],
                            borderWidth: 1,
                        },
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${slate[100]}`,
                    padding: '16px',
                },
                head: {
                    fontWeight: 600,
                    color: slate[500],
                    backgroundColor: slate[50],
                    borderBottom: `1px solid ${slate[200]}`,
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: `inset 0 -1px 0 0 ${slate[200]}`,
                    color: slate[900],
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: slate[50],
                    borderRight: `1px solid ${slate[200]}`,
                },
            },
        },
    },
});
