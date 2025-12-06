import { Server } from '@hocuspocus/server'
import { encodeStateAsUpdate, applyUpdate, Doc } from 'yjs'
import { Database } from '@hocuspocus/extension-database'
import { Redis } from '@hocuspocus/extension-redis'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { createPrismaClient } from './lib/prismaClient.js'
import { PrismaSessionRepository } from './modules/auth/sessionRepository.js'
import { FileSystemService } from './modules/filesystem/fileSystemService.js'
import { FileSystemRepository } from './modules/filesystem/fileSystemRepository.js'
import { RevisionRepository } from './modules/filesystem/revisionRepository.js'
import { ShareLinkRepository } from './modules/filesystem/shareLinkRepository.js'
import { StorageService } from './modules/storage/storageService.js'
import { WorkspaceAccessService } from './modules/workspaces/workspaceAccess.js'
import { WorkspaceRepository } from './modules/workspaces/workspaceRepository.js'
import { MembershipRepository } from './modules/workspaces/membershipRepository.js'
import { LockService } from './modules/locks/lockService.js'
import { createClient } from 'redis'
import dotenv from 'dotenv'

// Tiptap Imports for Schema
import { Node, Extension, mergeAttributes } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Heading } from '@tiptap/extension-heading'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Link } from '@tiptap/extension-link'
import { Code } from '@tiptap/extension-code'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Image } from '@tiptap/extension-image'
import { Youtube } from '@tiptap/extension-youtube'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { FontFamily } from '@tiptap/extension-font-family'
import { Highlight } from '@tiptap/extension-highlight'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extension-placeholder'
import { createLowlight } from 'lowlight'

// Minimal Lowlight setup
const lowlight = createLowlight()

dotenv.config()

// --- Custom Extension Definitions matching Frontend ---

const CalloutExtension = Node.create({
    name: 'callout',
    group: 'block',
    content: 'block+',
    draggable: true,
    isolating: true,

    addAttributes() {
        return {
            type: {
                default: 'info',
                parseHTML: element => element.getAttribute('data-callout-type') || 'info',
                renderHTML: attributes => {
                    return {
                        'data-callout-type': attributes.type,
                    }
                },
            },
        }
    },
    parseHTML() {
        return [
            {
                tag: 'div[data-callout-type]',
                getAttrs: element => {
                    if (typeof element === 'string') return { type: 'info' };
                    return { type: element.getAttribute('data-callout-type') || 'info' }
                },
            },
        ]
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'callout-block' }), 0]
    },
})

const DocumentLayout = Extension.create({
    name: 'documentLayout',
    addGlobalAttributes() {
        return [
            {
                types: ['doc'],
                attributes: {
                    'x-odocs-layoutWidth': {
                        default: null,
                        parseHTML: element => element.getAttribute('x-odocs-layoutWidth'),
                        renderHTML: attributes => {
                            if (!attributes['x-odocs-layoutWidth']) {
                                return {}
                            }
                            return {
                                'x-odocs-layoutWidth': attributes['x-odocs-layoutWidth'],
                            }
                        },
                    },
                },
            },
        ]
    },
})

const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            'data-odocs-url': { default: null },
            naturalWidth: { default: null },
            naturalHeight: { default: null },
            width: { default: null },
            textAlign: { default: 'center' },
            border: { default: 'none' },
            borderRadius: { default: 'none' },
        }
    }
})

const CustomYouTube = Youtube.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: { default: 640 },
            textAlign: { default: 'center' },
            controls: { default: true },
            nocookie: { default: false },
        }
    }
})

const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            backgroundColor: { default: null },
        }
    }
})

// --- End Custom Extensions ---

const schemaExtensions = [
    StarterKit.configure({
        heading: false,
        dropcursor: false,
        gapcursor: false,
        horizontalRule: false,
        link: false,
        codeBlock: false,
        code: false,
    }),
    Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
    HorizontalRule,
    Link.configure({ autolink: true, linkOnPaste: true, openOnClick: false }),
    Code,
    CodeBlockLowlight.configure({ lowlight }),
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    Placeholder,
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    CustomTableCell,
    CustomImage,
    CustomYouTube,
    CalloutExtension,
    DocumentLayout,
]

async function startHocuspocus() {
    // 1. Initialize dependencies
    const db = await createPrismaClient()

    const fileSystemRepository = new FileSystemRepository(db)
    const revisionRepository = new RevisionRepository(db)
    const shareLinkRepository = new ShareLinkRepository(db)
    const workspaceRepository = new WorkspaceRepository(db)
    const membershipRepository = new MembershipRepository(db)
    const sessionRepository = new PrismaSessionRepository(db)

    const workspaceAccess = new WorkspaceAccessService(workspaceRepository, membershipRepository)
    const storageService = new StorageService()

    const fileSystemService = new FileSystemService(
        fileSystemRepository,
        revisionRepository,
        shareLinkRepository,
        storageService,
        workspaceAccess
    )

    // Redis client for LockService
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisUrl = `redis://${redisHost}:${redisPort}`;

    // We need a dedicated client for LockService (it might need its own connection logic if needed)
    // Or we could reuse, but simple to create fresh one.
    const lockRedisClient = createClient({ url: redisUrl });
    await lockRedisClient.connect();

    const lockService = new LockService(lockRedisClient, db);

    // 2. Configure Hocuspocus
    const server = new Server({
        port: parseInt(process.env.HOCUSPOCUS_PORT || '9930', 10),
        debounce: 5000,
        extensions: [
            // Redis extensions for scaling
            (() => {
                // Manually construct Redis configuration
                const redisConfig = {
                    url: redisUrl,
                    host: redisHost,
                    port: redisPort,
                }
                console.log('Redis Config:', redisConfig)
                return new Redis(redisConfig)
            })(),
            // Database persistence
            new Database({
                // Load document from MinIO
                fetch: async ({ documentName }) => {
                    // documentName is expected to be the fileId
                    console.log(`[Hocuspocus] Load: ${documentName}`)
                    try {
                        // Use system access to load content
                        const content = await fileSystemService.getDocumentContent('system-override', documentName)
                            .catch(async (err) => {
                                console.log('[Hocuspocus] Document not found or new, returning default. Err:', err.message)
                                return {
                                    type: 'doc',
                                    content: [{ type: 'paragraph' }]
                                }
                            })

                        // JSON stringify/parse to ensure clean object
                        // console.log('[Hocuspocus] Content to transform:', JSON.stringify(content).substring(0, 200) + '...')


                        try {
                            console.log('[Hocuspocus] Starting transformation...')
                            const ydoc = TiptapTransformer.toYdoc(content, "default", schemaExtensions)
                            // Encode to binary update to avoid Hocuspocus internal type/processing errors
                            const update = encodeStateAsUpdate(ydoc)
                            console.log('[Hocuspocus] Encoded update size:', update.length)

                            return update
                        } catch (transformErr: any) {
                            console.error('[Hocuspocus] Transformer Error Full:', transformErr)
                            console.error('[Hocuspocus] Transformer Message:', transformErr.message)
                            return null
                        }

                    } catch (e) {
                        console.error('[Hocuspocus] Fetch Error:', e)
                        // If schema error occurs (like now), we might return null to avoid crash,
                        // but better to fix schema.
                        return null
                    }
                },

                // Save draft to MinIO
                store: async ({ documentName, state }) => {
                    // console.log(`[Hocuspocus] Store Draft triggered for: ${documentName}`)
                    try {
                        // 'state' is a Buffer here. TiptapTransformer requires a Y.Doc instance.
                        const doc = new Doc()
                        applyUpdate(doc, new Uint8Array(state))

                        const json = TiptapTransformer.fromYdoc(doc, "default")

                        // Save as draft
                        await fileSystemService.saveDraft('system-override', documentName, json)
                        console.log(`[Hocuspocus] Draft saved successfully: ${documentName}`)
                    } catch (e) {
                        console.error('[Hocuspocus] Store Draft Error:', e)
                    }
                },
            }),
        ],

        async onChange(data) {
            console.log(`[Hocuspocus] Document Changed: ${data.documentName}`)
        },

        async onConnect(data) {
            console.log(`[Hocuspocus] New connection attempt: ${data.documentName}`)

            // Check Lock State - prevent connection if standard locked
            try {
                const result = await lockService.incrementCollabSession(data.documentName);
                if (!result.success && result.reason === 'locked_standard') {
                    console.log(`[Hocuspocus] Rejecting connection: Document is locked by standard editor.`)
                    throw new Error('Document is currently locked by another user (Standard Editing).');
                }
            } catch (e: any) {
                // If error is ours, rethrow
                if (e.message && e.message.includes('Document is currently locked')) {
                    throw e;
                }
                console.error('[Hocuspocus] Lock check error:', e);
                // Fail safe? Or block?
                // Block to strictly prevent overwrite
                throw new Error('Failed to verify document lock status.');
            }
        },

        async onAuthenticate(data) {
            const { token, request } = data;
            // console.log(`[Hocuspocus] Auth check for ${data.documentName}`)

            // Validate via Cookie
            const cookieHeader = request.headers.cookie;
            if (!cookieHeader) {
                console.log(`[Hocuspocus] Auth Failed: No cookie for ${data.documentName}`)
                throw new Error('Unauthorized');
            }

            const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
            const sessionId = cookies['session_id'];

            if (!sessionId) {
                console.log(`[Hocuspocus] Auth Failed: No session_id for ${data.documentName}`)
                throw new Error('Unauthorized');
            }

            const session = await sessionRepository.findById(sessionId);
            if (!session || session.expiresAt < new Date() || session.revokedAt) {
                console.log(`[Hocuspocus] Auth Failed: Invalid session for ${data.documentName}`)
                throw new Error('Unauthorized');
            }

            const fileId = data.documentName;
            try {
                // 1. Get file
                const file = await fileSystemRepository.findById(fileId);
                if (!file) {
                    console.log(`[Hocuspocus] Auth Failed: File not found ${fileId}`)
                    throw new Error('File not found');
                }

                // 2. Check membership
                const membership = await membershipRepository.findByWorkspaceAndAccount(file.workspaceId, session.accountId);
                if (!membership || (membership.status !== 'active' && membership.status !== 'invited')) {
                    console.log(`[Hocuspocus] Auth Failed: No membership for ${session.accountId} in ${file.workspaceId}`)
                    throw new Error('Access denied');
                }

                console.log(`[Hocuspocus] Auth Success: ${membership.displayName} (${session.accountId})`)

                return {
                    user: {
                        id: session.accountId,
                        name: membership.displayName || 'Unknown',
                        color: '#ff0000',
                    },
                    membershipId: membership.id
                };

            } catch (e) {
                console.error('[Hocuspocus] Auth Check Error:', e);
                throw new Error('Access denied');
            }
        },

        async onDisconnect(data) {
            console.log(`[Hocuspocus] Disconnect. Clients: ${data.clientsCount}`);

            // Update Lock State
            try {
                if (data.clientsCount === 0) {
                    await lockService.resetCollabLock(data.documentName);
                    console.log(`[Hocuspocus] Lock reset for ${data.documentName} (0 clients)`);
                } else {
                    await lockService.decrementCollabSession(data.documentName);
                }
            } catch (e) {
                console.error('[Hocuspocus] Failed to update collab session:', e);
            }

            if (data.clientsCount === 0) {
                console.log(`[Hocuspocus] Last user left ${data.documentName}. Creating version.`);
                try {
                    const json = TiptapTransformer.fromYdoc(data.document, "default")

                    const context = data.context as any;
                    const membershipId = context?.membershipId || 'system-auto-save';

                    await fileSystemService.createVersion(membershipId, data.documentName, json);
                } catch (e) {
                    console.error('[Hocuspocus] Version Creation Error:', e);
                }
            }
        }
    })

    await server.listen()
    console.log(`Hocuspocus server listening on port ${process.env.HOCUSPOCUS_PORT || 9930}`)
}

startHocuspocus()
