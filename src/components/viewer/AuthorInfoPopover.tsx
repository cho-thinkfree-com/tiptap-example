import { Box, CircularProgress, Link, List, ListItem, Popover, Tooltip, Typography } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import { useEffect, useRef, useState } from 'react';
import { getAuthorPublicDocuments, type AuthorDocument } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import React from 'react';

interface AuthorInfoPopoverProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    token: string;
    authorName?: string;
}

// Component that only shows tooltip when text is truncated
const ConditionalTooltip = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const [isOverflowed, setIsOverflowed] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = textRef.current;
        if (element) {
            const child = element.firstElementChild as HTMLElement;
            if (child) {
                setIsOverflowed(child.scrollWidth > child.clientWidth);
            }
        }
    }, [title]);

    return (
        <Tooltip title={title} placement="top" disableHoverListener={!isOverflowed}>
            <span ref={textRef} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                {children}
            </span>
        </Tooltip>
    );
};

const AuthorInfoPopover = ({ open, anchorEl, onClose, token, authorName }: AuthorInfoPopoverProps) => {
    const [documents, setDocuments] = useState<AuthorDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { strings } = useI18n();

    useEffect(() => {
        if (open && documents.length === 0) {
            fetchDocuments();
        }
    }, [open]);

    const fetchDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getAuthorPublicDocuments(token);
            setDocuments(result.documents);
        } catch (err: any) {
            console.error('Failed to fetch author documents:', err);
            setError(err.message || 'Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    const publicDocuments = documents
        .filter(doc => doc.shareLink && doc.shareLink.isPublic)
        .sort((a, b) => {
            const dateA = new Date(a.document.updatedAt || a.document.createdAt).getTime();
            const dateB = new Date(b.document.updatedAt || b.document.createdAt).getTime();
            return dateB - dateA; // Most recent first
        });
    const currentDocument = documents.find(doc => doc.isCurrentDocument);

    // Use authorName from API response if not provided as prop
    const displayAuthorName = authorName || currentDocument?.authorName || '작성자';

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
            sx={{
                '& .MuiPopover-paper': {
                    width: 420,
                    maxHeight: 500,
                },
            }}
        >
            <Box sx={{ p: 1.5 }}>
                {/* Author Header */}
                <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <PersonIcon fontSize="small" />
                        {displayAuthorName}
                    </Typography>
                </Box>

                {/* Loading State */}
                {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}

                {/* Error State */}
                {error && (
                    <Typography color="error" variant="body2" sx={{ py: 2 }}>
                        {error}
                    </Typography>
                )}

                {/* Documents List */}
                {!loading && !error && (
                    <>
                        {/* Current Document */}
                        {currentDocument && (
                            <Box sx={{ mb: 1.5, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                                    {currentDocument.shareLink.isPublic ? (
                                        <VisibilityIcon sx={{ fontSize: 14 }} />
                                    ) : (
                                        <LockIcon sx={{ fontSize: 14 }} />
                                    )}
                                    {strings.editor?.author?.currentDocument || '현재 문서'}
                                </Typography>
                                <Box sx={{ pl: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ConditionalTooltip title={currentDocument.document.title}>
                                            <Typography
                                                variant="body2"
                                                fontWeight={600}
                                                sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    flex: 1,
                                                    minWidth: 0,
                                                }}
                                            >
                                                {currentDocument.document.title}
                                            </Typography>
                                        </ConditionalTooltip>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                display: 'flex',
                                                gap: 0.5,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <span>{currentDocument.document.viewCount?.toLocaleString() || 0}</span>
                                            <span>•</span>
                                            <span>{formatDate(currentDocument.document.createdAt)}</span>
                                        </Typography>
                                    </Box>
                                    {!currentDocument.shareLink.isPublic && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                                            링크가 있는 사람만 볼 수 있습니다
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        )}

                        {/* Public Documents */}
                        {publicDocuments.length > 0 && (
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                                    <PublicIcon sx={{ fontSize: 14 }} />
                                    {strings.editor?.author?.publicDocuments || '공개 문서'} ({publicDocuments.length})
                                </Typography>
                                <List dense disablePadding>
                                    {publicDocuments.slice(0, 5).map((doc) => {
                                        const isCurrentDoc = doc.isCurrentDocument;
                                        return (
                                            <ListItem
                                                key={doc.document.id}
                                                disablePadding
                                                sx={{
                                                    mb: 0.25,
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    },
                                                }}
                                            >
                                                {isCurrentDoc ? (
                                                    <Box
                                                        sx={{
                                                            width: '100%',
                                                            p: 0.75,
                                                            borderRadius: 0.75,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            cursor: 'default',
                                                        }}
                                                    >
                                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <ConditionalTooltip title={doc.document.title}>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        fontWeight: 500,
                                                                        flex: 1,
                                                                        minWidth: 0,
                                                                    }}
                                                                >
                                                                    {doc.document.title}
                                                                </Typography>
                                                            </ConditionalTooltip>
                                                            <VisibilityIcon
                                                                sx={{
                                                                    fontSize: 16,
                                                                    color: 'primary.main',
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                    display: 'flex',
                                                                    gap: 0.5,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                <span>{doc.document.viewCount?.toLocaleString() || 0}</span>
                                                                <span>•</span>
                                                                <span>{formatDate(doc.document.createdAt)}</span>
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Link
                                                        href={doc.shareLink.isPublic
                                                            ? `/public/${doc.shareLink.token}/${encodeURIComponent(doc.document.title.substring(0, 30))}`
                                                            : `/share/${doc.shareLink.token}/${encodeURIComponent(doc.document.title.substring(0, 30))}`
                                                        }
                                                        underline="none"
                                                        color="inherit"
                                                        sx={{
                                                            width: '100%',
                                                            p: 0.75,
                                                            borderRadius: 0.75,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                        }}
                                                    >
                                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <ConditionalTooltip title={doc.document.title}>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        whiteSpace: 'nowrap',
                                                                        fontWeight: 400,
                                                                        flex: 1,
                                                                        minWidth: 0,
                                                                    }}
                                                                >
                                                                    {doc.document.title}
                                                                </Typography>
                                                            </ConditionalTooltip>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                    display: 'flex',
                                                                    gap: 0.5,
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                <span>{doc.document.viewCount?.toLocaleString() || 0}</span>
                                                                <span>•</span>
                                                                <span>{formatDate(doc.document.createdAt)}</span>
                                                            </Typography>
                                                        </Box>
                                                    </Link>
                                                )}
                                            </ListItem>
                                        );
                                    })}
                                </List>
                                {publicDocuments.length > 5 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block', pl: 0.75 }}>
                                        +{publicDocuments.length - 5}개 더 보기
                                    </Typography>
                                )}
                            </Box>
                        )}

                        {/* No Public Documents */}
                        {publicDocuments.length === 0 && !currentDocument && (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                {strings.editor?.author?.noPublicDocuments || '공개 문서가 없습니다'}
                            </Typography>
                        )}
                    </>
                )}
            </Box>
        </Popover>
    );
};

export default AuthorInfoPopover;
