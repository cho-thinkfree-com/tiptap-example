import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { createDocument } from '../lib/api';
import { validateDocumentContent } from '../lib/documentValidation';
import { useI18n } from '../lib/i18n';

export type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';

export interface UploadItem {
    id: string;
    file: File;
    status: UploadStatus;
    progress: number;
    error?: string;
    targetFolderId?: string;
    workspaceId?: string;
}

interface UploadContextType {
    uploads: UploadItem[];
    isExpanded: boolean;
    toggleExpanded: () => void;
    uploadFiles: (files: File[], workspaceId: string, targetFolderId?: string) => void;
    retryUpload: (id: string) => void;
    cancelUpload: (id: string) => void;
    clearCompleted: () => void;
    clearFailed: () => void;
    removeUpload: (id: string) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (!context) {
        throw new Error('useUpload must be used within an UploadProvider');
    }
    return context;
};

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const { tokens } = useAuth();
    const { strings } = useI18n();
    const isProcessingRef = useRef<Set<string>>(new Set());

    // Helper to update an upload item
    const updateUpload = useCallback((id: string, updates: Partial<UploadItem>) => {
        setUploads(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    }, []);

    // Process a single upload item
    const processUpload = useCallback(async (item: UploadItem) => {
        // Prevent duplicate processing
        if (isProcessingRef.current.has(item.id)) {
            return;
        }

        isProcessingRef.current.add(item.id);
        updateUpload(item.id, { status: 'uploading', progress: 0 });

        try {
            // 1. Client-side Validation
            if (!item.file.name.endsWith('.odocs')) {
                throw new Error('Invalid file extension. Only .odocs is supported.');
            }

            const text = await item.file.text();
            let content;
            try {
                content = JSON.parse(text);
            } catch (e) {
                throw new Error('Invalid file format: Not a valid JSON');
            }

            if (!validateDocumentContent(content, strings)) {
                throw new Error('Invalid .odocs file: Content structure is incorrect');
            }

            // 2. Upload
            if (!tokens || !item.workspaceId) {
                throw new Error('Authentication lost or workspace not specified');
            }

            const title = item.file.name.replace(/\.odocs$/, '');

            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploads(prev => {
                    const current = prev.find(i => i.id === item.id);
                    if (current && current.status === 'uploading' && current.progress < 90) {
                        return prev.map(i => i.id === item.id ? { ...i, progress: i.progress + 10 } : i);
                    }
                    return prev;
                });
            }, 200);

            const createdDoc = await createDocument(item.workspaceId, tokens.accessToken, {
                folderId: item.targetFolderId,
                title,
                initialRevision: { content }
            });

            clearInterval(progressInterval);
            updateUpload(item.id, { status: 'success', progress: 100 });

            // Broadcast event to refresh lists
            const { broadcastSync } = await import('../lib/syncEvents');
            broadcastSync({
                type: 'document-created',
                workspaceId: item.workspaceId,
                folderId: item.targetFolderId || null,
                documentId: createdDoc.id
            });

        } catch (err) {
            console.error('[UploadContext] Upload failed:', err);
            updateUpload(item.id, { status: 'error', error: (err as Error).message });
        } finally {
            isProcessingRef.current.delete(item.id);
        }
    }, [tokens, strings, updateUpload]);

    // Watch for pending uploads and process them
    useEffect(() => {
        const pendingItems = uploads.filter(u => u.status === 'pending');
        const uploadingCount = uploads.filter(u => u.status === 'uploading').length;

        // Process up to 3 concurrent uploads
        const availableSlots = Math.max(0, 3 - uploadingCount);
        const itemsToProcess = pendingItems.slice(0, availableSlots);

        itemsToProcess.forEach(item => {
            processUpload(item);
        });
    }, [uploads, processUpload]);


    const uploadFiles = useCallback((files: File[], workspaceId: string, targetFolderId?: string) => {
        console.log('[UploadContext] uploadFiles called with', files.length, 'files');
        const newUploads: UploadItem[] = Array.from(files).map(file => ({
            id: crypto.randomUUID(),
            file,
            status: 'pending',
            progress: 0,
            targetFolderId,
            workspaceId
        }));

        console.log('[UploadContext] Adding uploads:', newUploads);
        setUploads(prev => [...prev, ...newUploads]);
        setIsExpanded(true);
    }, []);

    const retryUpload = useCallback((id: string) => {
        updateUpload(id, { status: 'pending', error: undefined, progress: 0 });
    }, [updateUpload]);

    const cancelUpload = useCallback((id: string) => {
        isProcessingRef.current.delete(id);
        setUploads(prev => prev.filter(item => item.id !== id));
    }, []);

    const removeUpload = useCallback((id: string) => {
        isProcessingRef.current.delete(id);
        setUploads(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearCompleted = useCallback(() => {
        setUploads(prev => prev.filter(item => item.status !== 'success'));
    }, []);

    const clearFailed = useCallback(() => {
        setUploads(prev => prev.filter(item => item.status !== 'error'));
    }, []);

    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <UploadContext.Provider value={{
            uploads,
            isExpanded,
            toggleExpanded,
            uploadFiles,
            retryUpload,
            cancelUpload,
            clearCompleted,
            clearFailed,
            removeUpload
        }}>
            {children}
        </UploadContext.Provider>
    );
};
