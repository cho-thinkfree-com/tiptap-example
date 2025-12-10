import { resolveAssetUrls } from '../../lib/api'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

type HandlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const SNAP_POINTS = [10, 25, 50, 75, 100, 125, 150, 175, 200]
const SNAP_THRESHOLD = 2 // Snap when within ±2% of a snap point

const ResizableImageView = ({ node, updateAttributes, selected }: NodeViewProps) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isResizing, setIsResizing] = useState(false)
    const [isLoaded, setIsLoaded] = useState(false)
    const [snapIndicator, setSnapIndicator] = useState<number | null>(null)
    const [currentPercent, setCurrentPercent] = useState<number>(100) // Current percentage during drag
    const [liveWidth, setLiveWidth] = useState<number | null>(null) // Pixel width during drag
    const [viewSrc, setViewSrc] = useState<string>('')
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)
    const handlePositionRef = useRef<HandlePosition>('bottom-right')

    const {
        src, alt, title, width, textAlign, border, borderRadius,
        naturalWidth: storedNaturalWidth,
        naturalHeight: storedNaturalHeight
    } = node.attrs

    // Initialize from stored values or default to 0
    const [naturalWidth, setNaturalWidth] = useState(storedNaturalWidth || 0)
    const [naturalHeight, setNaturalHeight] = useState(storedNaturalHeight || 0)

    // Resolve URL effect
    useEffect(() => {
        let mounted = true
        const resolveUrl = async () => {
            if (!src) return

            // If it's a remote asset URL (odocsassets://), resolve it
            if (src.startsWith('odocsassets://remote/')) {
                // Parse workspaceId and documentId from URL
                // Format: odocsassets://remote/workspaces/:workspaceId/files/:documentId/assets/:assetId
                try {
                    const path = src.replace('odocsassets://remote/', '')
                    const parts = path.split('/')
                    // parts[0] = 'workspaces', parts[1] = workspaceId, parts[2] = 'files', parts[3] = documentId
                    if (parts.length >= 4 && parts[1] && parts[3]) {
                        const workspaceId = parts[1]
                        const documentId = parts[3]

                        const resolvedMap = await resolveAssetUrls(workspaceId, documentId, [src])
                        if (mounted && resolvedMap[src]) {
                            setViewSrc(resolvedMap[src])
                            return
                        }
                    }
                } catch (e) {
                    console.error('Failed to resolve asset URL', e)
                }
            }

            // Fallback (or standard URL): use as is
            if (mounted) {
                setViewSrc(src)
            }
        }

        resolveUrl()
        return () => { mounted = false }
    }, [src])

    // Get original image dimensions when loaded
    const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget
        const imgNaturalWidth = img.naturalWidth
        const imgNaturalHeight = img.naturalHeight
        setNaturalWidth(imgNaturalWidth)
        setNaturalHeight(imgNaturalHeight)
        setIsLoaded(true)

        // Save to node attributes if not already saved
        if (!storedNaturalWidth || !storedNaturalHeight) {
            updateAttributes({
                naturalWidth: imgNaturalWidth,
                naturalHeight: imgNaturalHeight,
            })
        }
    }, [storedNaturalWidth, storedNaturalHeight, updateAttributes])

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        const container = containerRef.current
        if (!container) return

        const position = e.currentTarget.getAttribute('data-position') as HandlePosition
        handlePositionRef.current = position || 'bottom-right'

        setIsResizing(true)
        startXRef.current = e.clientX
        startWidthRef.current = container.offsetWidth
        setLiveWidth(container.offsetWidth)
    }, [])

    useEffect(() => {
        if (!isResizing || !naturalWidth) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startXRef.current
            const position = handlePositionRef.current

            // Left handles: dragging left increases size, dragging right decreases
            // Right handles: dragging right increases size, dragging left decreases
            const isLeftHandle = position === 'top-left' || position === 'bottom-left'
            const adjustedDelta = isLeftHandle ? -deltaX : deltaX

            // Work with pixels for smooth resizing
            let newWidth = Math.max(50, startWidthRef.current + adjustedDelta)

            // Clamp to min 10% and max 200% first
            const maxWidth = Math.floor(naturalWidth * 2)
            const minWidth = Math.floor(naturalWidth * 0.1)
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))

            // Calculate percentage after clamping
            const percentWidth = (newWidth / naturalWidth) * 100

            // Check for snap points
            let snappedTo: number | null = null
            for (const snapPoint of SNAP_POINTS) {
                if (Math.abs(percentWidth - snapPoint) <= SNAP_THRESHOLD) {
                    // Snap to exact pixel value for this percentage (floor for consistency)
                    newWidth = Math.floor((naturalWidth * snapPoint) / 100)
                    snappedTo = snapPoint
                    break
                }
            }
            setSnapIndicator(snappedTo)

            // Update current percentage for display
            const displayPercent = snappedTo !== null ? snappedTo : Math.floor((newWidth / naturalWidth) * 100)
            setCurrentPercent(displayPercent)

            // Update live width for smooth rendering
            setLiveWidth(newWidth)
        }

        const handleMouseUp = () => {
            // On mouse up, save the final width as pixels (floor for consistent sizing)
            if (liveWidth !== null) {
                updateAttributes({ width: `${Math.floor(liveWidth)}px` })
            }
            setIsResizing(false)
            setSnapIndicator(null)
            setLiveWidth(null)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, updateAttributes, naturalWidth, liveWidth])

    // Build style object for alignment
    const getWrapperStyle = (): React.CSSProperties => {
        const style: React.CSSProperties = {
            display: 'flex',
            width: '100%',
        }

        switch (textAlign) {
            case 'left':
                style.justifyContent = 'flex-start'
                break
            case 'right':
                style.justifyContent = 'flex-end'
                break
            case 'center':
            default:
                style.justifyContent = 'center'
                break
        }

        return style
    }

    const getContainerStyle = (): React.CSSProperties => {
        // During resize, use liveWidth for smooth rendering
        let containerWidth: string | number = 'auto'

        if (isResizing && liveWidth !== null) {
            containerWidth = liveWidth
        } else if (width) {
            // Parse stored width (could be "50%" or "400px")
            if (width.endsWith('px')) {
                containerWidth = parseInt(width, 10)
            } else if (width.endsWith('%') && naturalWidth) {
                const percent = parseInt(width, 10)
                if (!isNaN(percent)) {
                    containerWidth = (naturalWidth * percent) / 100
                }
            }
        } else if (naturalWidth) {
            // No width set yet - use natural width as default to prevent CLS
            containerWidth = naturalWidth
        }

        const style: React.CSSProperties = {
            position: 'relative',
            display: 'inline-block',
            width: containerWidth,
            maxWidth: '100%',
        }

        // Add aspect-ratio to reserve space before image loads (prevents CLS)
        if (naturalWidth && naturalHeight) {
            style.aspectRatio = `${naturalWidth} / ${naturalHeight}`
        }

        return style
    }

    const getImageStyle = (): React.CSSProperties => {
        const style: React.CSSProperties = {
            display: 'block',
            width: '100%',
            height: 'auto',
        }

        // Border styles
        if (border === 'thin') {
            style.boxShadow = '0 0 0 1px #ccc'
        } else if (border === 'medium') {
            style.boxShadow = '0 0 0 3px #666'
        }

        // Border radius styles
        if (borderRadius === 'rounded') {
            style.borderRadius = '16px'
        }

        return style
    }

    return (
        <NodeViewWrapper style={getWrapperStyle()}>
            <div
                ref={containerRef}
                style={getContainerStyle()}
                className={`resizable-image-container ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
            >
                {/* Loading placeholder - shown until image loads */}
                {!isLoaded && naturalWidth > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: borderRadius === 'rounded' ? '16px' : 0,
                        }}
                    >
                        <svg
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#bdbdbd"
                            strokeWidth="1.5"
                            style={{ opacity: 0.7 }}
                        >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" fill="#bdbdbd" stroke="none" />
                            <path d="M21 15l-5-5L5 21" />
                        </svg>
                    </div>
                )}
                {viewSrc && (
                    <img
                        src={viewSrc}
                        alt={alt || ''}
                        title={title || ''}
                        crossOrigin="anonymous"
                        style={{
                            ...getImageStyle(),
                            opacity: isLoaded ? 1 : 0,
                            transition: 'opacity 0.2s ease-in-out',
                        }}
                        draggable={false}
                        loading="lazy"
                        onLoad={handleImageLoad}
                    />
                )}
                {/* Resize percentage indicator */}
                {isResizing && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: snapIndicator !== null ? '#1976d2' : 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            pointerEvents: 'none',
                            zIndex: 10,
                            transition: 'background 0.1s',
                        }}
                    >
                        {currentPercent}%
                    </div>
                )}
                {/* Corner resize handles */}
                {selected && (
                    <>
                        {/* Top-left */}
                        <div
                            className="resize-handle"
                            onMouseDown={handleMouseDown}
                            data-position="top-left"
                            style={{
                                position: 'absolute',
                                left: -6,
                                top: -6,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#1976d2',
                                cursor: 'nwse-resize',
                                border: '2px solid white',
                                boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                            }}
                        />
                        {/* Top-right */}
                        <div
                            className="resize-handle"
                            onMouseDown={handleMouseDown}
                            data-position="top-right"
                            style={{
                                position: 'absolute',
                                right: -6,
                                top: -6,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#1976d2',
                                cursor: 'nesw-resize',
                                border: '2px solid white',
                                boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                            }}
                        />
                        {/* Bottom-left */}
                        <div
                            className="resize-handle"
                            onMouseDown={handleMouseDown}
                            data-position="bottom-left"
                            style={{
                                position: 'absolute',
                                left: -6,
                                bottom: -6,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#1976d2',
                                cursor: 'nesw-resize',
                                border: '2px solid white',
                                boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                            }}
                        />
                        {/* Bottom-right */}
                        <div
                            className="resize-handle"
                            onMouseDown={handleMouseDown}
                            data-position="bottom-right"
                            style={{
                                position: 'absolute',
                                right: -6,
                                bottom: -6,
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: '#1976d2',
                                cursor: 'nwse-resize',
                                border: '2px solid white',
                                boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                            }}
                        />
                    </>
                )}
            </div>
        </NodeViewWrapper>
    )
}

export default ResizableImageView
