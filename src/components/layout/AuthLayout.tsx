import { Box, Typography, Container } from '@mui/material';
import type { ReactNode } from 'react';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LanguageSelector from '../common/LanguageSelector';

interface AuthLayoutProps {
    children: ReactNode;
    title: string;
    subtitle?: string;
}

const AuthLayout = ({ children, title, subtitle }: AuthLayoutProps) => {
    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
            {/* Left Side - Branding */}
            <Box
                sx={{
                    flex: 1,
                    display: { xs: 'none', md: 'flex' },
                    flexDirection: 'column',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #312e81 0%, #1e3a8a 100%)', // Deep Indigo to Dark Blue
                    color: 'common.white',
                    p: 8,
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 600, mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 6 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 48, color: 'common.white' }} />
                        <Typography variant="h4" fontWeight="800" color="inherit" sx={{ letterSpacing: '-0.02em' }}>
                            ododocs
                        </Typography>
                    </Box>

                    <Typography variant="h2" fontWeight="800" sx={{ mb: 3, lineHeight: 1.1, color: 'common.white' }}>
                        Write, Collaborate, Publish.
                    </Typography>

                    <Typography variant="h5" sx={{ mb: 6, opacity: 0.8, fontWeight: 500, lineHeight: 1.6, color: 'common.white' }}>
                        The all-in-one workspace for your documentation.
                        Simple enough for notes, powerful enough for knowledge bases.
                    </Typography>

                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        p: 4,
                        borderRadius: 4,
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
                    }}>
                        {[
                            { title: 'Real-time Collaboration', desc: 'Edit documents together with your team, instantly.' },
                            { title: 'Block-based Editing', desc: 'Focus on content with a distraction-free, modern editor.' },
                            { title: 'Smart Organization', desc: 'Keep everything structured with nested workspaces and folders.' }
                        ].map((feature, index) => (
                            <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                <Box
                                    sx={{
                                        mt: 0.5,
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        bgcolor: 'rgba(255,255,255,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                                </Box>
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="700" sx={{ color: 'common.white', mb: 0.5 }}>
                                        {feature.title}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: 'common.white', opacity: 0.7, lineHeight: 1.5 }}>
                                        {feature.desc}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>

                <Box sx={{ position: 'absolute', bottom: 40, left: 64, zIndex: 1 }}>
                    <Typography variant="caption" sx={{ opacity: 0.6, color: 'common.white' }}>
                        © 2025 ododocs. All rights reserved.
                    </Typography>
                </Box>

                {/* Decorative Elements */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '-20%',
                        right: '-10%',
                        width: '600px',
                        height: '600px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)',
                        borderRadius: '50%',
                        filter: 'blur(80px)',
                    }}
                />
            </Box>

            {/* Right Side - Form */}
            <Box
                sx={{
                    flex: { xs: 1, md: '0 0 500px', lg: '0 0 600px' },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    bgcolor: 'background.default',
                    p: 4,
                    position: 'relative',
                }}
            >
                <Box sx={{ position: 'absolute', top: 24, right: 24 }}>
                    <LanguageSelector />
                </Box>
                <Container maxWidth="xs">
                    <Box sx={{ mb: 4, textAlign: 'center' }}>
                        <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', mb: 2, color: 'primary.main' }}>
                            <AutoAwesomeIcon sx={{ fontSize: 40 }} />
                        </Box>
                        <Typography variant="h4" gutterBottom fontWeight="bold">
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography variant="body1" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                    {children}
                </Container>
            </Box>
        </Box>
    );
};

export default AuthLayout;
