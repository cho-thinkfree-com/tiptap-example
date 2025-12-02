import { Breadcrumbs, Link, Typography, Tooltip, Menu, MenuItem } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import FolderIcon from '@mui/icons-material/Folder';
import { useState } from 'react';
import type { FileSystemEntry } from '../../lib/api';

interface CollapsibleBreadcrumbsProps {
    ancestors: FileSystemEntry[];
    currentFolder: FileSystemEntry | null;
    onNavigate: (folderId: string | null) => void;
    // Drag and drop handlers
    dragOverId?: string | null;
    onDragOver?: (e: React.DragEvent, folderId: string | 'root') => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (
        e: React.DragEvent,
        targetFolderId: string | null,
        items: Array<{ id: string; type: string; parentId: string | null }>,
        selectedIds: Set<string>
    ) => void;
    items?: Array<{ id: string; type: string; parentId: string | null }>;
    selectedIds?: Set<string>;
}

const CollapsibleBreadcrumbs = ({
    ancestors,
    currentFolder,
    onNavigate,
    dragOverId,
    onDragOver,
    onDragLeave,
    onDrop,
    items = [],
    selectedIds = new Set(),
}: CollapsibleBreadcrumbsProps) => {
    const [dropdownAnchor, setDropdownAnchor] = useState<null | HTMLElement>(null);

    const handleDropdownOpen = (event: React.MouseEvent<HTMLElement>) => {
        setDropdownAnchor(event.currentTarget);
    };

    const handleDropdownClose = () => {
        setDropdownAnchor(null);
    };

    const handleDropdownItemClick = (folderId: string) => {
        onNavigate(folderId);
        handleDropdownClose();
    };

    // Determine which ancestors to show and which to collapse
    // Strategy: 
    // - If 3 or fewer ancestors: show all
    // - If 4+ ancestors: show first, collapse middle ones into dropdown, show last
    // This ensures: Root > First > ... > Last > Current
    const COLLAPSE_THRESHOLD = 3;
    let visibleAncestors: FileSystemEntry[] = [];
    let collapsedAncestors: FileSystemEntry[] = [];

    if (ancestors.length <= COLLAPSE_THRESHOLD) {
        // Show all ancestors
        visibleAncestors = ancestors;
        collapsedAncestors = [];
    } else {
        // Show first and last, collapse middle ones
        visibleAncestors = [
            ancestors[0], // First ancestor
            ancestors[ancestors.length - 1], // Last ancestor
        ];
        collapsedAncestors = ancestors.slice(1, -1); // Middle ancestors
    }

    return (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
            {/* Root - Always visible */}
            <Tooltip title="Files" arrow>
                <Link
                    component="button"
                    underline="hover"
                    color="inherit"
                    onClick={() => onNavigate(null)}
                    onDragOver={onDragOver ? (e) => onDragOver(e, 'root') : undefined}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop ? (e) => onDrop(e, null, items, selectedIds) : undefined}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderRadius: 1,
                        px: 0.5,
                        py: 0.25,
                        border: '2px solid transparent',
                        borderColor: dragOverId === 'root' ? 'primary.main' : 'transparent',
                        bgcolor: dragOverId === 'root' ? 'action.hover' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                    Files
                </Link>
            </Tooltip>

            {/* First visible ancestor (when collapsing) */}
            {collapsedAncestors.length > 0 && visibleAncestors[0] && (
                <Tooltip title={visibleAncestors[0].name} arrow>
                    <Link
                        component="button"
                        underline="hover"
                        color="inherit"
                        onClick={() => onNavigate(visibleAncestors[0].id)}
                        onDragOver={onDragOver ? (e) => onDragOver(e, visibleAncestors[0].id) : undefined}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop ? (e) => onDrop(e, visibleAncestors[0].id, items, selectedIds) : undefined}
                        sx={{
                            cursor: 'pointer',
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                            border: '2px solid transparent',
                            borderColor: dragOverId === visibleAncestors[0].id ? 'primary.main' : 'transparent',
                            bgcolor: dragOverId === visibleAncestors[0].id ? 'action.hover' : 'transparent',
                            transition: 'all 0.2s',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                        }}
                    >
                        {visibleAncestors[0].name}
                    </Link>
                </Tooltip>
            )}

            {/* Collapsed ancestors dropdown */}
            {collapsedAncestors.length > 0 && (
                <>
                    <Tooltip title="Click to show hidden folders" arrow>
                        <Link
                            component="button"
                            underline="hover"
                            color="inherit"
                            onClick={handleDropdownOpen}
                            onDragOver={(e) => {
                                e.preventDefault();
                                // Auto-open dropdown when dragging over
                                if (!dropdownAnchor) {
                                    setDropdownAnchor(e.currentTarget);
                                }
                            }}
                            sx={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                px: 0.5,
                                py: 0.25,
                                borderRadius: 1,
                                border: '2px solid transparent',
                                borderColor: Boolean(dropdownAnchor) ? 'primary.main' : 'transparent',
                                bgcolor: Boolean(dropdownAnchor) ? 'action.hover' : 'transparent',
                                transition: 'all 0.2s',
                            }}
                        >
                            <MoreHorizIcon fontSize="small" />
                        </Link>
                    </Tooltip>
                    <Menu
                        anchorEl={dropdownAnchor}
                        open={Boolean(dropdownAnchor)}
                        onClose={handleDropdownClose}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'left',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                    >
                        {collapsedAncestors.map((ancestor) => (
                            <MenuItem
                                key={ancestor.id}
                                onClick={() => handleDropdownItemClick(ancestor.id)}
                                onDragOver={onDragOver ? (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDragOver(e, ancestor.id);
                                } : undefined}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop ? (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDrop(e, ancestor.id, items, selectedIds);
                                    handleDropdownClose();
                                } : undefined}
                                sx={{
                                    borderLeft: '3px solid transparent',
                                    borderColor: dragOverId === ancestor.id ? 'primary.main' : 'transparent',
                                    bgcolor: dragOverId === ancestor.id ? 'action.hover' : 'transparent',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <FolderIcon sx={{ mr: 1 }} fontSize="small" color="action" />
                                <Tooltip title={ancestor.name} arrow placement="right">
                                    <Typography
                                        sx={{
                                            maxWidth: '300px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {ancestor.name}
                                    </Typography>
                                </Tooltip>
                            </MenuItem>
                        ))}
                    </Menu>
                </>
            )}

            {/* Last visible ancestor (when collapsing) or all visible ancestors (when not collapsing) */}
            {collapsedAncestors.length > 0 && visibleAncestors[1] ? (
                // When collapsing, show only the last one (second element)
                <Tooltip title={visibleAncestors[1].name} arrow>
                    <Link
                        component="button"
                        underline="hover"
                        color="inherit"
                        onClick={() => onNavigate(visibleAncestors[1].id)}
                        onDragOver={onDragOver ? (e) => onDragOver(e, visibleAncestors[1].id) : undefined}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop ? (e) => onDrop(e, visibleAncestors[1].id, items, selectedIds) : undefined}
                        sx={{
                            cursor: 'pointer',
                            borderRadius: 1,
                            px: 0.5,
                            py: 0.25,
                            border: '2px solid transparent',
                            borderColor: dragOverId === visibleAncestors[1].id ? 'primary.main' : 'transparent',
                            bgcolor: dragOverId === visibleAncestors[1].id ? 'action.hover' : 'transparent',
                            transition: 'all 0.2s',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                        }}
                    >
                        {visibleAncestors[1].name}
                    </Link>
                </Tooltip>
            ) : (
                // When not collapsing, show all visible ancestors
                visibleAncestors.map((ancestor) => (
                    <Tooltip key={ancestor.id} title={ancestor.name} arrow>
                        <Link
                            component="button"
                            underline="hover"
                            color="inherit"
                            onClick={() => onNavigate(ancestor.id)}
                            onDragOver={onDragOver ? (e) => onDragOver(e, ancestor.id) : undefined}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop ? (e) => onDrop(e, ancestor.id, items, selectedIds) : undefined}
                            sx={{
                                cursor: 'pointer',
                                borderRadius: 1,
                                px: 0.5,
                                py: 0.25,
                                border: '2px solid transparent',
                                borderColor: dragOverId === ancestor.id ? 'primary.main' : 'transparent',
                                bgcolor: dragOverId === ancestor.id ? 'action.hover' : 'transparent',
                                transition: 'all 0.2s',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                            }}
                        >
                            {ancestor.name}
                        </Link>
                    </Tooltip>
                ))
            )}

            {/* Current folder - Always visible */}
            {currentFolder && (
                <Tooltip title={currentFolder.name} arrow>
                    <Typography
                        color="text.primary"
                        fontWeight="600"
                        sx={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                        }}
                    >
                        {currentFolder.name}
                    </Typography>
                </Tooltip>
            )}
        </Breadcrumbs>
    );
};

export default CollapsibleBreadcrumbs;
