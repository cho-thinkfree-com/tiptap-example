import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Container,
    Typography,
    Skeleton,
    Grid,
    Pagination,
} from '@mui/material';
import { slugify } from '../../lib/slug';
import {
    getWorkspaceMemberPublicProfile,
    getWorkspaceMemberPublicDocuments,
    getBlogByHandle,
    type MembershipSummary,
    type DocumentSummary,
} from '../../lib/api';
import { getThemeById, DEFAULT_THEME_ID } from '../../components/blog/themeRegistry';
import ThemeSelector from '../../components/blog/ThemeSelector';

const BlogLandingPage = () => {
    const { workspaceId, profileId, handle } = useParams<{ workspaceId: string; profileId: string; handle: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [profile, setProfile] = useState<MembershipSummary | null>(null);
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeThemeId, setActiveThemeId] = useState<string>(DEFAULT_THEME_ID);
    const [totalPages, setTotalPages] = useState(1);

    const page = parseInt(searchParams.get('page') || '1', 10);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                let profileData: MembershipSummary;
                let docsData: DocumentSummary[];
                let totalPagesData = 1;

                if (handle) {
                    const data = await getBlogByHandle(handle, page);
                    profileData = data.profile;
                    docsData = data.documents;
                    totalPagesData = data.pagination.totalPages;
                } else if (workspaceId && profileId) {
                    // Legacy route support (no pagination implemented for legacy yet)
                    const [pData, dData] = await Promise.all([
                        getWorkspaceMemberPublicProfile(workspaceId, profileId),
                        getWorkspaceMemberPublicDocuments(workspaceId, profileId)
                    ]);
                    profileData = pData;
                    docsData = dData.items;
                } else {
                    throw new Error('Invalid blog URL');
                }

                setProfile(profileData);
                setDocuments(docsData);
                setTotalPages(totalPagesData);
                setTotalPages(totalPagesData);

                // Theme Logic:
                // 1. Check localStorage for visitor preference
                // 2. Fallback to profile default
                // 3. Fallback to system default
                const savedTheme = handle ? localStorage.getItem(`blog_theme_${handle}`) : null;

                if (savedTheme) {
                    setActiveThemeId(savedTheme);
                } else if (profileData.blogTheme) {
                    setActiveThemeId(profileData.blogTheme);
                }
            } catch (err) {
                console.error('Failed to load blog data', err);
                setError('Failed to load blog. The user may not exist or has no public profile.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [workspaceId, profileId, handle, page]);

    const handleDocumentClick = (doc: DocumentSummary) => {
        if (handle && doc.documentNumber) {
            const titleSlug = slugify(doc.title);
            navigate(`/blog/${handle}/documents/${doc.documentNumber}/${titleSlug}`);
        } else {
            // Fallback for legacy route or if no handle
            if ((doc as any).publicToken) {
                navigate(`/public/${(doc as any).publicToken}`);
            } else {
                console.warn('Cannot navigate: no handle or public token available');
            }
        }
    };

    const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
        setSearchParams({ page: value.toString() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 8 }}>
                <Container maxWidth="md">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 8 }}>
                        <Skeleton variant="circular" width={120} height={120} sx={{ mb: 2 }} />
                        <Skeleton variant="text" width={200} height={40} />
                        <Skeleton variant="text" width={300} height={20} />
                    </Box>
                    <Grid container spacing={3}>
                        {[1, 2, 3, 4].map((i) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={i}>
                                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>
        );
    }

    if (error || !profile) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="error">{error || 'Profile not found'}</Typography>
            </Box>
        );
    }

    const ActiveThemeComponent = getThemeById(activeThemeId).component;

    return (
        <>
            <ActiveThemeComponent
                profile={profile}
                documents={documents}
                onDocumentClick={handleDocumentClick}
            />

            {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, bgcolor: 'background.default' }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                    />
                </Box>
            )}

            <ThemeSelector
                currentThemeId={activeThemeId}
                ownerDefaultThemeId={profile.blogTheme}
                onThemeChange={(newThemeId) => {
                    setActiveThemeId(newThemeId);
                    if (handle) {
                        // If the selected theme matches the owner's default, clear the preference
                        // so the visitor follows future updates by the owner.
                        if (newThemeId === profile.blogTheme) {
                            localStorage.removeItem(`blog_theme_${handle}`);
                        } else {
                            localStorage.setItem(`blog_theme_${handle}`, newThemeId);
                        }
                    }
                }}
            />
        </>
    );
};

export default BlogLandingPage;
