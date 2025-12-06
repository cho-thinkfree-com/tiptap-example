import { PrismaClient, Revision } from '@prisma/client';

export interface CreateRevisionInput {
    fileId: string;
    storageKey: string;
    size: bigint;
    version: number;
    createdBy: string;
    changeNote?: string;
}

export class RevisionRepository {
    constructor(private db: PrismaClient) { }

    async create(input: CreateRevisionInput): Promise<Revision> {
        return this.db.revision.create({
            data: {
                fileId: input.fileId,
                storageKey: input.storageKey,
                size: input.size,
                version: input.version,
                createdBy: input.createdBy,
                changeNote: input.changeNote,
            },
        });
    }

    async findById(id: string): Promise<Revision | null> {
        return this.db.revision.findUnique({
            where: { id },
        });
    }

    async findByFileId(fileId: string): Promise<Revision[]> {
        return this.db.revision.findMany({
            where: { fileId },
            orderBy: {
                version: 'desc',
            },
            include: {
                creator: {
                    include: {
                        account: {
                            select: {
                                email: true,
                                legalName: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async findLatestByFileId(fileId: string): Promise<Revision | null> {
        return this.db.revision.findFirst({
            where: { fileId },
            orderBy: {
                version: 'desc',
            },
        });
    }

    async findByFileIdAndVersion(fileId: string, version: number): Promise<Revision | null> {
        return this.db.revision.findUnique({
            where: {
                fileId_version: {
                    fileId,
                    version,
                },
            },
        });
    }

    async getNextVersion(fileId: string): Promise<number> {
        const latest = await this.findLatestByFileId(fileId);
        return latest ? latest.version + 1 : 1;
    }

    async delete(id: string): Promise<void> {
        await this.db.revision.delete({
            where: { id },
        });
    }

    async deleteByFileId(fileId: string): Promise<void> {
        await this.db.revision.deleteMany({
            where: { fileId },
        });
    }
}
