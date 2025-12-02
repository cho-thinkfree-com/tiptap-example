import type { FileSystemEntry, Workspace } from '@prisma/client';

// 파일 시스템 이벤트
export interface FileCreatedEvent {
    type: 'file:created';
    workspaceId: string;
    file: FileSystemEntry;
}

export interface FileUpdatedEvent {
    type: 'file:updated';
    workspaceId: string;
    fileId: string;
    updates: Partial<FileSystemEntry>;
    oldParentId?: string | null;
    newParentId?: string | null;
}

export interface FileDeletedEvent {
    type: 'file:deleted';
    workspaceId: string;
    fileId: string;
    deletedAt: Date;
}

export interface FileRestoredEvent {
    type: 'file:restored';
    workspaceId: string;
    file: FileSystemEntry;
}

// 워크스페이스 이벤트
export interface WorkspaceUpdatedEvent {
    type: 'workspace:updated';
    workspaceId: string;
    updates: Partial<Workspace>;
}

export type SocketEvent =
    | FileCreatedEvent
    | FileUpdatedEvent
    | FileDeletedEvent
    | FileRestoredEvent
    | WorkspaceUpdatedEvent;
