import { useState, useEffect, useRef } from 'react';
import { Box, Tooltip } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import PublicOffIcon from '@mui/icons-material/PublicOff';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TimerOffIcon from '@mui/icons-material/TimerOff';
import { getShareLinks } from '../../lib/api';
import { isAfter, parseISO } from 'date-fns';

interface FileShareIndicatorProps {
    fileId: string;
    shareLinks?: any[];
}

interface ShareStatus {
    hasActiveLink: boolean;
    accessType: 'private' | 'link' | 'public';
    isExpired: boolean;
    hasPassword: boolean;
    hasExpiration: boolean;
}

export default function FileShareIndicator({ fileId, shareLinks: initialShareLinks }: FileShareIndicatorProps) {
    const [status, setStatus] = useState<ShareStatus | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const checkStatus = async () => {
            try {
                let links = initialShareLinks;

                if (!links) {
                    const fetchedLinks = await getShareLinks(fileId);
                    if (!mountedRef.current) return;
                    links = fetchedLinks;
                }

                if (!links || !Array.isArray(links)) {
                    setStatus(null);
                    return;
                }

                const activeLink = links.find(l => !l.revokedAt);
                if (!activeLink) {
                    setStatus(null);
                    return;
                }

                const isExpired = activeLink.expiresAt && !isAfter(parseISO(activeLink.expiresAt), new Date());

                setStatus({
                    hasActiveLink: true,
                    accessType: activeLink.accessType || 'link',
                    isExpired: !!isExpired,
                    hasPassword: !!(activeLink.requiresPassword || activeLink.passwordHash),
                    hasExpiration: !!activeLink.expiresAt,
                });

            } catch (err) {
                console.error('Failed to check share status:', err);
                if (mountedRef.current) {
                    setStatus(null);
                }
            }
        };

        checkStatus();

        return () => {
            mountedRef.current = false;
        };
    }, [fileId, initialShareLinks]);

    if (!status) return null;

    const getTooltip = () => {
        const parts = [];
        if (status.accessType === 'public') {
            parts.push('Published to web');
        } else {
            parts.push('Link shared');
        }

        if (status.hasPassword) {
            parts.push('Password protected');
        }

        if (status.hasExpiration) {
            if (status.isExpired) {
                parts.push('Expired');
            } else {
                parts.push('Expires soon');
            }
        }

        return parts.join(' • ');
    };

    return (
        <Tooltip title={getTooltip()}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', ml: 1, verticalAlign: 'middle', gap: 0.5 }}>
                {/* Main Share Icon */}
                {status.accessType === 'public' ? (
                    status.isExpired ? (
                        <PublicOffIcon fontSize="small" color="action" />
                    ) : (
                        <PublicIcon fontSize="small" color="success" />
                    )
                ) : (
                    // Link shared (always show link icon if not public)
                    // If expired, show broken link or link off? User asked for "clock with slash" for expired time.
                    // But for the link itself, if it's expired, it's effectively off.
                    // User said: "Link shared -> Link icon always shown"
                    <LinkIcon fontSize="small" color={status.isExpired ? "action" : "primary"} />
                )}

                {/* Password Icon */}
                {status.hasPassword && !status.isExpired && (
                    <LockIcon fontSize="small" color="warning" sx={{ fontSize: '0.9rem' }} />
                )}

                {/* Expiration Icon */}
                {status.hasExpiration && (
                    status.isExpired ? (
                        <TimerOffIcon fontSize="small" color="error" sx={{ fontSize: '0.9rem' }} />
                    ) : (
                        <AccessTimeIcon fontSize="small" color="action" sx={{ fontSize: '0.9rem' }} />
                    )
                )}
            </Box>
        </Tooltip>
    );
}
