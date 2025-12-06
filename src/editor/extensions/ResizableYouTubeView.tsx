import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useRef, useState } from 'react'

type HandlePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const SNAP_POINTS = [25, 50, 75, 100, 125, 150]
const SNAP_THRESHOLD = 3 // Snap when within ±3% of a snap point
const DEFAULT_WIDTH = 640
const ASPECT_RATIO = 16 / 9

const ResizableYouTubeView = ({ node, updateAttributes, selected, editor }: NodeViewProps) => {
    const isEditable = editor?.isEditable ?? true
    const containerRef = useRef<HTMLDivElement>(null)
    const [isResizing, setIsResizing] = useState(false)
    const [snapIndicator, setSnapIndicator] = useState<number | null>(null)
    const [currentPercent, setCurrentPercent] = useState<number>(100)
    const [liveWidth, setLiveWidth] = useState<number | null>(null)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)
    const handlePositionRef = useRef<HandlePosition>('bottom-right')

    const {
        src: _src,
        width: storedWidth,
        textAlign,
    } = node.attrs

    // Get the actual width value
    const getWidthValue = (): number => {
        if (!storedWidth) return DEFAULT_WIDTH
        if (typeof storedWidth === 'number') return storedWidth
        if (typeof storedWidth === 'string') {
            if (storedWidth.endsWith('px')) {
                return parseInt(storedWidth, 10) || DEFAULT_WIDTH
            }
            if (storedWidth.endsWith('%')) {
                const percent = parseInt(storedWidth, 10)
                return Math.floor((DEFAULT_WIDTH * percent) / 100)
            }
        }
        return DEFAULT_WIDTH
    }

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
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - startXRef.current
            const position = handlePositionRef.current

            const isLeftHandle = position === 'top-left' || position === 'bottom-left'
            const adjustedDelta = isLeftHandle ? -deltaX : deltaX

            let newWidth = Math.max(200, startWidthRef.current + adjustedDelta)

            // Clamp to min 25% and max 150%
            const maxWidth = Math.floor(DEFAULT_WIDTH * 1.5)
            const minWidth = Math.floor(DEFAULT_WIDTH * 0.25)
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))

            const percentWidth = (newWidth / DEFAULT_WIDTH) * 100

            // Check for snap points
            let snappedTo: number | null = null
            for (const snapPoint of SNAP_POINTS) {
                if (Math.abs(percentWidth - snapPoint) <= SNAP_THRESHOLD) {
                    newWidth = Math.floor((DEFAULT_WIDTH * snapPoint) / 100)
                    snappedTo = snapPoint
                    break
                }
            }
            setSnapIndicator(snappedTo)

            const displayPercent = snappedTo !== null ? snappedTo : Math.floor((newWidth / DEFAULT_WIDTH) * 100)
            setCurrentPercent(displayPercent)
            setLiveWidth(newWidth)
        }

        const handleMouseUp = () => {
            if (liveWidth !== null) {
                updateAttributes({ width: liveWidth })
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
    }, [isResizing, updateAttributes, liveWidth])

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
        let containerWidth: number

        if (isResizing && liveWidth !== null) {
            containerWidth = liveWidth
        } else {
            containerWidth = getWidthValue()
        }

        const containerHeight = Math.floor(containerWidth / ASPECT_RATIO)

        return {
            position: 'relative',
            display: 'inline-block',
            width: containerWidth,
            height: containerHeight,
            maxWidth: '100%',
        }
    }

    // Build the YouTube embed URL from node attributes
    const getEmbedUrl = (): string => {
        const { src, controls, nocookie, start } = node.attrs

        // The src in YouTube extension is already the embed URL
        if (src && src.includes('youtube')) {
            // Parse existing URL and rebuild with current options
            try {
                const url = new URL(src)
                const videoId = url.pathname.split('/').pop()

                const domain = nocookie ? 'www.youtube-nocookie.com' : 'www.youtube.com'
                const embedUrl = new URL(`https://${domain}/embed/${videoId}`)

                if (controls === false) {
                    embedUrl.searchParams.set('controls', '0')
                }
                if (start) {
                    embedUrl.searchParams.set('start', start.toString())
                }

                return embedUrl.toString()
            } catch {
                return src
            }
        }

        return src || ''
    }

    return (
        <NodeViewWrapper style={getWrapperStyle()}>
            <div
                ref={containerRef}
                style={getContainerStyle()}
                className={`resizable-youtube-container ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
            >
                <iframe
                    src={getEmbedUrl()}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        borderRadius: '8px',
                        // Viewer mode: always allow interaction
                        // Editor mode: only when selected and not resizing
                        pointerEvents: !isEditable || (selected && !isResizing) ? 'auto' : 'none',
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />

                {/* Click overlay for selection - only in editor mode when not selected */}
                {isEditable && !selected && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            cursor: 'pointer',
                            borderRadius: '8px',
                            // Subtle hover effect
                            backgroundColor: 'transparent',
                            transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(25, 118, 210, 0.08)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    />
                )}

                {/* Selection border */}
                {selected && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            border: '2px solid #1976d2',
                            borderRadius: '8px',
                            pointerEvents: 'none',
                        }}
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

export default ResizableYouTubeView
