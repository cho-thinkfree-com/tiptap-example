import {
    Box,
    Container,
    Typography,
    Paper,
    Divider,
    Chip,
    Link,
    InputBase,
    IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { format } from 'date-fns';
import type { BlogThemeProps } from '../types';

const WikiTheme = ({ profile, documents, onDocumentClick }: BlogThemeProps) => {
    const themeColor = '#00a495'; // Namu Wiki green

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#f0f0f0' }}>
            {/* Wiki Header */}
            <Box sx={{ bgcolor: themeColor, color: 'white', py: 1, px: 2, boxShadow: 1 }}>
                <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="h5" fontWeight="bold" sx={{ fontFamily: 'sans-serif' }}>
                            {profile.displayName || 'WIKI'}
                        </Typography>
                    </Box>
                    <Paper
                        component="form"
                        sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 300, height: 36, bgcolor: 'rgba(255,255,255,0.9)' }}
                    >
                        <InputBase
                            sx={{ ml: 1, flex: 1, fontSize: '0.9rem' }}
                            placeholder="Search"
                            inputProps={{ 'aria-label': 'search wiki' }}
                        />
                        <IconButton type="button" sx={{ p: '5px' }} aria-label="search">
                            <SearchIcon fontSize="small" />
                        </IconButton>
                    </Paper>
                </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 4, display: 'flex', gap: 3 }}>
                {/* Main Content Area */}
                <Box sx={{ flex: 1 }}>
                    <Paper sx={{ p: 3, mb: 3, border: `1px solid ${themeColor}`, borderTop: `4px solid ${themeColor}` }}>
                        <Typography variant="h4" gutterBottom sx={{ borderBottom: '1px solid #ccc', pb: 1, mb: 3 }}>
                            {profile.displayName}
                            <Typography component="span" variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                                [Blog]
                            </Typography>
                        </Typography>

                        <Box sx={{ p: 2, bgcolor: '#f9f9f9', border: '1px solid #ddd', mb: 3 }}>
                            <Typography variant="body1">
                                {profile.blogDescription || 'This is a wiki-style knowledge base.'}
                            </Typography>
                        </Box>

                        <Typography variant="h5" sx={{
                            mt: 4,
                            mb: 2,
                            display: 'flex',
                            alignItems: 'center',
                            '&::before': {
                                content: '""',
                                display: 'block',
                                width: 6,
                                height: 24,
                                bgcolor: themeColor,
                                mr: 1
                            }
                        }}>
                            Recent Documents
                        </Typography>

                        <Divider sx={{ mb: 2 }} />

                        {documents.length === 0 ? (
                            <Typography color="text.secondary">No documents found.</Typography>
                        ) : (
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                {documents.map((doc) => (
                                    <Box component="li" key={doc.id} sx={{ mb: 1 }}>
                                        <Link
                                            component="button"
                                            onClick={() => onDocumentClick(doc)}
                                            sx={{
                                                color: themeColor,
                                                textDecoration: 'none',
                                                fontSize: '1.1rem',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                        >
                                            {doc.title}
                                        </Link>
                                        <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                            (Updated {format(new Date(doc.updatedAt), 'yyyy-MM-dd')})
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Box>

                {/* Sidebar (Right) */}
                <Box sx={{ width: 300, display: { xs: 'none', md: 'block' } }}>
                    <Paper sx={{ p: 2, mb: 2, border: '1px solid #ddd' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ color: themeColor, fontWeight: 'bold' }}>
                            Profile
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ textAlign: 'center', mb: 2 }}>
                            <Box
                                component="img"
                                src={profile.avatarUrl || 'https://via.placeholder.com/150'}
                                sx={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }}
                            />
                            <Typography variant="h6" sx={{ mt: 1 }}>{profile.displayName}</Typography>
                        </Box>
                    </Paper>

                    <Paper sx={{ p: 2, border: '1px solid #ddd' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ color: themeColor, fontWeight: 'bold' }}>
                            Tags
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {['Wiki', 'Docs', 'Info', 'Guide'].map((tag) => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" />
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
};

export default WikiTheme;
