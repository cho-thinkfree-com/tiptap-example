import { useState, useCallback } from 'react';
import { moveFileSystemEntry } from '../lib/api';

interface DragAndDropOptions {
    onMoveComplete?: () => void;
    onMoveError?: (error: Error) => void;
}

export function useDragAndDrop(options: DragAndDropOptions = {}) {
    const [draggedItemIds, setDraggedItemIds] = useState<string[]>([]);
    const [dragOverId, setDragOverId] = useState<string | null>(null);

    const handleDragStart = useCallback((e: React.DragEvent, itemId: string, selectedIds: Set<string>) => {
        // If dragging a selected item, drag all selected items
        // Otherwise, just drag the single item
        const itemsToDrag = selectedIds.has(itemId)
            ? Array.from(selectedIds)
            : [itemId];

        setDraggedItemIds(itemsToDrag);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(itemsToDrag));

        // Add a slight opacity to the drag image
        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '0.5';
        }
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        setDraggedItemIds([]);
        setDragOverId(null);

        if (e.currentTarget instanceof HTMLElement) {
            e.currentTarget.style.opacity = '1';
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, targetId?: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (targetId) {
            setDragOverId(targetId);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear if we're leaving the element completely
        if (e.currentTarget === e.target) {
            setDragOverId(null);
        }
    }, []);

    const handleDrop = useCallback(async (
        e: React.DragEvent,
        targetFolderId: string | null,
        allItems: Array<{ id: string; type: string; parentId: string | null }>,
        _selectedIds: Set<string>
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverId(null);

        try {
            const draggedIds = JSON.parse(e.dataTransfer.getData('text/plain')) as string[];

            // Validate the drop
            for (const draggedId of draggedIds) {
                const draggedItem = allItems.find(item => item.id === draggedId);

                if (!draggedItem) {
                    continue;
                }

                // Can't drop onto itself
                if (draggedId === targetFolderId) {
                    console.warn('Cannot drop item onto itself');
                    continue;
                }

                // Can't drop into current parent (no-op)
                if (draggedItem.parentId === targetFolderId) {
                    console.warn('Item is already in this folder');
                    continue;
                }

                // If dropping onto a folder, prevent dropping a folder into its own descendants
                if (draggedItem.type === 'folder' && targetFolderId) {
                    const isDescendant = (potentialDescendantId: string, ancestorId: string): boolean => {
                        let current = allItems.find(item => item.id === potentialDescendantId);
                        while (current?.parentId) {
                            if (current.parentId === ancestorId) {
                                return true;
                            }
                            current = allItems.find(item => item.id === current!.parentId);
                        }
                        return false;
                    };

                    if (isDescendant(targetFolderId, draggedId)) {
                        console.warn('Cannot drop folder into its own descendant');
                        continue;
                    }
                }

                // Move the item
                await moveFileSystemEntry(draggedId, targetFolderId);
            }

            // Clear selection after successful move
            setDraggedItemIds([]);

            // Notify completion
            if (options.onMoveComplete) {
                options.onMoveComplete();
            }
        } catch (error) {
            console.error('Failed to move items:', error);
            if (options.onMoveError && error instanceof Error) {
                options.onMoveError(error);
            }
        }
    }, [options]);

    const isDragging = draggedItemIds.length > 0;

    return {
        draggedItemIds,
        dragOverId,
        isDragging,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
