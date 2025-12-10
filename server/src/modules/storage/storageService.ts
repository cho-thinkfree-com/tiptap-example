import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from 'process'

export class StorageService {
    private readonly s3: S3Client

    private readonly bucket: string
    private readonly region: string

    constructor() {
        this.region = process.env.OBJECT_STORAGE_REGION || 'us-east-1'
        this.bucket = process.env.OBJECT_STORAGE_BUCKET || 'ododocs'

        // S3 Client (for both direct operations and presigned URLs)
        // Uses OBJECT_STORAGE_ENDPOINT directly
        this.s3 = new S3Client({
            region: this.region,
            endpoint: process.env.OBJECT_STORAGE_ENDPOINT || 'http://localhost:9000',
            credentials: {
                accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY || 'minioadmin',
                secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY || 'minioadmin',
            },
            forcePathStyle: true,
        })
    }

    /**
     * Generates a presigned URL for uploading a file (PUT).
     * @param key The S3 key (path) where the file will be stored.
     * @param mimeType The MIME type of the file.
     * @param expiresInSeconds Expiration time in seconds (default: 300s = 5m).
     */
    async getPresignedPutUrl(key: string, mimeType: string, expiresInSeconds = 300): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: mimeType,
        })
        // Use standard client for signing
        return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds })
    }

    /**
     * Generates a presigned URL for downloading/viewing a file (GET).
     * @param key The S3 key (path) of the file.
     * @param downloadName Optional. If provided, sets Content-Disposition to attachment with this filename.
     * @param expiresInSeconds Expiration time in seconds (default: 300s = 5m).
     */
    async getPresignedGetUrl(key: string, downloadName?: string, expiresInSeconds = 300): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            // For downloads, prevent caching to ensure fresh download every time
            // For previews (no downloadName), allow caching
            ResponseCacheControl: downloadName
                ? 'no-cache, no-store, must-revalidate'
                : 'private, max-age=3600',
            ...(downloadName && {
                ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadName)}"`,
                ResponseContentType: 'application/octet-stream', // Force download
            }),
        })
        // Use standard client for signing
        return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds })
    }

    /**
     * Moves an object from sourceKey to targetKey (Copy + Delete).
     * Used for Draft -> Commit pattern.
     */
    async moveObject(sourceKey: string, targetKey: string): Promise<void> {
        await this.copyObject(sourceKey, targetKey)
        await this.deleteObject(sourceKey)
    }

    async copyObject(sourceKey: string, targetKey: string): Promise<void> {
        // Note: CopySource must include the bucket name for some S3 implementations,
        // but AWS SDK usually handles "Bucket/Key" format.
        // For MinIO/S3, it's usually "Bucket/Key".
        await this.s3.send(new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${sourceKey}`,
            Key: targetKey,
        }))
    }

    /**
     * Uploads a file directly (without presigned URL).
     * @param key The S3 key (path) where the file will be stored.
     * @param body The file content as Buffer.
     * @param mimeType The MIME type of the file.
     */
    async uploadObject(key: string, body: Buffer, mimeType: string): Promise<void> {
        await this.s3.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: mimeType,
        }))
    }

    /**
     * Downloads a file directly.
     * @param key The S3 key (path) of the file.
     * @returns The file content as Buffer.
     */
    async getObject(key: string): Promise<Buffer> {
        const response = await this.s3.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }))

        // Convert stream to buffer
        const chunks: Uint8Array[] = []
        for await (const chunk of response.Body as any) {
            chunks.push(chunk)
        }
        return Buffer.concat(chunks)
    }

    async deleteObject(key: string): Promise<void> {
        await this.s3.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }))
    }

    /**
     * Deletes all objects with the given prefix (folder).
     * Used for cleaning up document assets when a document is deleted.
     */
    async deleteFolder(prefix: string): Promise<void> {
        let continuationToken: string | undefined

        do {
            const listParams = {
                Bucket: this.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }
            const listedObjects = await this.s3.send(new ListObjectsV2Command(listParams))

            if (listedObjects.Contents && listedObjects.Contents.length > 0) {
                const deleteParams = {
                    Bucket: this.bucket,
                    Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
                }
                await this.s3.send(new DeleteObjectsCommand(deleteParams))
            }

            continuationToken = listedObjects.NextContinuationToken
        } while (continuationToken)
    }
}
