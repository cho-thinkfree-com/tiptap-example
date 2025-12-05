import { Paper, Popper, Select, MenuItem, IconButton, Tooltip, Divider, FormControl, Box, Typography } from '@mui/material'
import { memo, useEffect, useRef, useState } from 'react'
import { useRichTextEditorContext } from 'mui-tiptap'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import CodeIcon from '@mui/icons-material/Code'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useFloatingToolbarBoundary } from '../../hooks/useFloatingToolbarVisibility'

// Supported languages with display names
const LANGUAGES = [
    { value: '', label: 'Plain Text' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'css', label: 'CSS' },
    { value: 'html', label: 'HTML' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML' },
    { value: 'markdown', label: 'Markdown' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'c', label: 'C' },
    { value: 'cpp', label: 'C++' },
    { value: 'csharp', label: 'C#' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'sql', label: 'SQL' },
    { value: 'bash', label: 'Bash' },
    { value: 'shell', label: 'Shell' },
    { value: 'yaml', label: 'YAML' },
    { value: 'dockerfile', label: 'Dockerfile' },
] as const

const CodeBlockFloatingToolbar = () => {
    const editor = useRichTextEditorContext()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const [language, setLanguage] = useState<string>('')
    const [copied, setCopied] = useState(false)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        if (!editor) {
            return
        }

        const updateToolbar = () => {
            if (!editor) {
                return
            }

            const { state, view } = editor
            const { selection } = state
            const { from } = selection

            // Check if selection is inside a code block
            let codeBlockNode: HTMLElement | null = null
            let lang = ''

            if (editor.isActive('codeBlock')) {
                const resolved = view.domAtPos(from)
                let node: Node | null = resolved.node

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    node = node.parentNode
                }

                codeBlockNode = (node as HTMLElement | null)?.closest('pre') ?? null

                if (codeBlockNode && document.body.contains(codeBlockNode)) {
                    // Get language from the codeBlock node attributes
                    const codeBlockAttrs = editor.getAttributes('codeBlock')
                    lang = codeBlockAttrs?.language || ''
                }
            }

            if (codeBlockNode && document.body.contains(codeBlockNode)) {
                setAnchorEl((prev) => (prev === codeBlockNode ? prev : codeBlockNode))
                setLanguage(lang)
            } else {
                setAnchorEl(null)
            }
        }

        const scheduleUpdate = () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
            rafRef.current = requestAnimationFrame(updateToolbar)
        }

        editor.on('selectionUpdate', scheduleUpdate)
        editor.on('transaction', scheduleUpdate)
        updateToolbar()

        return () => {
            editor.off('selectionUpdate', scheduleUpdate)
            editor.off('transaction', scheduleUpdate)
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [editor])

    const handleLanguageChange = (newLanguage: string) => {
        if (editor) {
            // Clear anchor temporarily to avoid stale reference
            setAnchorEl(null)

            editor.chain().focus().updateAttributes('codeBlock', { language: newLanguage }).run()
            setLanguage(newLanguage)

            // Re-acquire anchor after a short delay
            setTimeout(() => {
                if (editor.isActive('codeBlock')) {
                    const { state, view } = editor
                    const { from } = state.selection
                    const resolved = view.domAtPos(from)
                    let node: Node | null = resolved.node
                    if (node.nodeType !== Node.ELEMENT_NODE) {
                        node = node.parentNode
                    }
                    const preNode = (node as HTMLElement | null)?.closest('pre')
                    if (preNode && document.body.contains(preNode)) {
                        setAnchorEl(preNode)
                    }
                }
            }, 50)
        }
    }

    const handleCopy = async () => {
        if (editor && anchorEl) {
            const codeEl = anchorEl.querySelector('code')
            if (codeEl) {
                const text = codeEl.textContent || ''
                try {
                    await navigator.clipboard.writeText(text)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                } catch {
                    console.error('Failed to copy code')
                }
            }
        }
    }

    const handleDelete = () => {
        if (editor) {
            editor.chain().focus().toggleCodeBlock().run()
        }
    }

    // Validate anchorEl is still in document before rendering Popper
    const isValidAnchor = anchorEl && document.body.contains(anchorEl)
    const { boundaryEl, isInViewport } = useFloatingToolbarBoundary(anchorEl)
    const open = Boolean(isValidAnchor) && isInViewport && Boolean(editor?.isEditable)

    return (
        <Popper
            open={open}
            anchorEl={anchorEl}
            placement='top'
            modifiers={[
                { name: 'offset', options: { offset: [0, 8] } },
                { name: 'flip', enabled: true, options: { boundary: boundaryEl || 'clippingParents' } },
                { name: 'preventOverflow', enabled: true, options: { boundary: boundaryEl || 'clippingParents', padding: 8 } },
            ]}
            style={{ zIndex: 10 }}
        >
            <Paper elevation={3} sx={{ p: 1, display: 'inline-flex', alignItems: 'center', gap: 0.5, border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1 }}>
                    <CodeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    <FormControl size="small" variant="standard" sx={{ minWidth: 120 }}>
                        <Select
                            value={language}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            displayEmpty
                            sx={{
                                fontSize: '0.875rem',
                                '& .MuiSelect-select': {
                                    py: 0.5,
                                },
                                '&:before, &:after': {
                                    display: 'none',
                                },
                            }}
                        >
                            {LANGUAGES.map((lang) => (
                                <MenuItem key={lang.value} value={lang.value}>
                                    <Typography variant="body2">{lang.label}</Typography>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                <Divider orientation="vertical" flexItem variant="middle" sx={{ mx: 0.5 }} />

                <Tooltip title={copied ? "Copied!" : "Copy Code"}>
                    <IconButton size="small" onClick={handleCopy} color={copied ? 'success' : 'default'}>
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>

                <Divider orientation="vertical" flexItem variant="middle" sx={{ mx: 0.5 }} />

                <Tooltip title="Delete Code Block">
                    <IconButton size="small" onClick={handleDelete} color="error">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Paper>
        </Popper>
    )
}

export default memo(CodeBlockFloatingToolbar)
