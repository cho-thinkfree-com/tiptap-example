import { Box, CircularProgress, Link, List, ListItem, Popover, Tooltip, Typography } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import VisibilityIcon from '@mui/icons-material/Visibility';

import PersonIcon from '@mui/icons-material/Person';
import LinkIcon from '@mui/icons-material/Link';
import { useEffect, useRef, useState } from 'react';
import { slugify } from '../../lib/slug';
import { getAuthorPublicDocuments, type AuthorDocument } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import React from 'react';

export interface CurrentDocInfo {
    id?: string;
    title: string;
    viewCount?: number;
    createdAt: string | Date;
    accessType: 'private' | 'link' | 'public';
    authorName?: string;
}

interface AuthorInfoPopoverProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    token: string;
    handle?: string;
    authorName?: string;
    currentDocInfo?: CurrentDocInfo;
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

const AuthorInfoPopover = ({ open, anchorEl, onClose, token, handle, authorName, currentDocInfo }: AuthorInfoPopoverProps) => {
    const [documents, setDocuments] = useState<AuthorDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetchedHandle, setFetchedHandle] = useState<string | null>(null);

    const { strings } = useI18n();

    const fetchDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
            let result;
            if (handle) {
                result = await getAuthorPublicDocuments(handle, 'handle');
            } else {
                result = await getAuthorPublicDocuments(token, 'token');
            }
            setDocuments(result.documents);
            if (result.profile) {
                if (result.profile.blogHandle) {
                    setFetchedHandle(result.profile.blogHandle);
                }
            }
        } catch (err: any) {
            console.error('Failed to fetch author documents:', err);
            // Don't show error if we have currentDocInfo, just show current doc
            if (!currentDocInfo) {
                setError(err.message || 'Failed to load documents');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchDocuments();
        }
    }, [open]);

    const formatDate = (dateString: string | Date) => {
        const date = new Date(dateString);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Filter and sort documents
    // The API returns documents that are already filtered for public visibility
    const publicDocuments = documents
        .filter(doc => (doc as any).publicToken) // Ensure there is a token
        .sort((a: any, b: any) => {
            const dateA = new Date(a.updatedAt || a.createdAt).getTime();
            const dateB = new Date(b.updatedAt || b.createdAt).getTime();
            return dateB - dateA; // Most recent first
        });

    // Find current document based on token match OR ID match
    let currentDocument = publicDocuments.find((doc: any) =>
        doc.publicToken === token || (currentDocInfo?.id && doc.id === currentDocInfo.id)
    );

    // Fallback to currentDocInfo if not found in list (e.g. link-only shared doc)
    if (!currentDocument && currentDocInfo) {
        currentDocument = {
            isCurrentDocument: true,
            id: currentDocInfo.id,
            title: currentDocInfo.title,
            viewCount: currentDocInfo.viewCount,
            createdAt: currentDocInfo.createdAt,
            publicToken: token,
            shareLink: {
                accessType: currentDocInfo.accessType,
                token: token
            },
            authorName: currentDocInfo.authorName
        } as any;
    }

    // Use authorName from API response if not provided as prop
    // Note: API might not return authorName in document object, but we have profile in result
    const displayAuthorName = authorName || (currentDocument as any)?.authorName || '작성자';

    // Helper to generate document URL
    const getDocumentUrl = (doc: any) => {
        const titleSlug = slugify(doc.title);
        const docToken = doc.publicToken;
        const effectiveHandle = handle || fetchedHandle;

        if (effectiveHandle) {
            return `/blog/${effectiveHandle}/documents/${docToken}/${titleSlug}`;
        }
        return `/public/${docToken}/${titleSlug}`;
    };

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
                                    {(currentDocument as any).shareLink?.accessType === 'public' ? (
                                        <PublicIcon sx={{ fontSize: 14 }} />
                                    ) : (
                                        <LinkIcon sx={{ fontSize: 14 }} />
                                    )}
                                    {strings.editor?.author?.currentDocument || '현재 문서'}
                                </Typography>
                                <Box sx={{ pl: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ConditionalTooltip title={(currentDocument as any).title}>
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
                                                {(currentDocument as any).title}
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
                                            <span>{(currentDocument as any).viewCount?.toLocaleString() || 0}</span>
                                            <span>•</span>
                                            <span>{formatDate((currentDocument as any).createdAt)}</span>
                                        </Typography>
                                    </Box>
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
                                    {publicDocuments.slice(0, 5).map((doc: any) => {
                                        const isCurrentDoc = doc.publicToken === token || (currentDocInfo?.id && doc.id === currentDocInfo.id);
                                        return (
                                            <ListItem
                                                key={doc.id}
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
                                                            bgcolor: 'action.selected',
                                                        }}
                                                    >
                                                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <ConditionalTooltip title={doc.title}>
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
                                                                    {doc.title}
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
                                                                <span>{doc.viewCount?.toLocaleString() || 0}</span>
                                                                <span>•</span>
                                                                <span>{formatDate(doc.createdAt)}</span>
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Link
                                                        href={getDocumentUrl(doc)}
                                                        underline="none"
                                                        color="inherit"
                                                        target="_blank"
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
                                                            <ConditionalTooltip title={doc.title}>
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
                                                                    {doc.title}
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
                                                                <span>{doc.viewCount?.toLocaleString() || 0}</span>
                                                                <span>•</span>
                                                                <span>{formatDate(doc.createdAt)}</span>
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
