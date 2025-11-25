import { Box, Breadcrumbs, Container, Link, Typography, Paper } from '@mui/material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { usePageTitle } from '../../hooks/usePageTitle';

const SharedDocumentsPage = () => {
    const { workspaceId } = useParams<{ workspaceId: string }>();

    usePageTitle('공유 문서함');

    return (
        <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
                    <Link component={RouterLink} underline="hover" color="inherit" to={`/workspace/${workspaceId}`} sx={{ display: 'flex', alignItems: 'center' }}>
                        <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                        Files
                    </Link>
                    <Typography color="text.primary" fontWeight="600" sx={{ display: 'flex', alignItems: 'center' }}>
                        공유 문서함
                    </Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
                    공유 문서함
                </Typography>
                <Paper sx={{ p: 6, textAlign: 'center', borderStyle: 'dashed', bgcolor: 'transparent' }}>
                    <Typography color="text.secondary" variant="h6">
                        Coming Soon
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 2 }}>
                        공유 문서함 기능이 곧 제공될 예정입니다.
                    </Typography>
                </Paper>
            </Box>
        </Container>
    );
};

export default SharedDocumentsPage;
