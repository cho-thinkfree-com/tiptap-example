import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook to get the editor scroll container element for use as Popper boundary
 * and check if anchor is within viewport.
 */
export const useFloatingToolbarBoundary = (
    anchorEl: HTMLElement | null
) => {
    const [boundaryEl, setBoundaryEl] = useState<Element | null>(null)
    const [isInViewport, setIsInViewport] = useState(true)
    const rafRef = useRef<number | null>(null)

    // Find the scroll container once
    useEffect(() => {
        const proseMirror = document.querySelector('.ProseMirror')
        if (!proseMirror) return

        let scrollContainer: Element | null = proseMirror.parentElement
        while (scrollContainer && scrollContainer !== document.body) {
            const style = window.getComputedStyle(scrollContainer)
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                break
            }
            scrollContainer = scrollContainer.parentElement
        }

        if (scrollContainer && scrollContainer !== document.body) {
            setBoundaryEl(scrollContainer)
        }
    }, [])

    const checkVisibility = useCallback(() => {
        if (!anchorEl || !boundaryEl) {
            setIsInViewport(true)
            return
        }

        const containerRect = boundaryEl.getBoundingClientRect()
        const anchorRect = anchorEl.getBoundingClientRect()

        // Hide when anchor is completely outside the visible area
        const isVisible =
            anchorRect.bottom > containerRect.top + 10 &&
            anchorRect.top < containerRect.bottom - 10

        setIsInViewport(isVisible)
    }, [anchorEl, boundaryEl])

    useEffect(() => {
        if (!anchorEl || !boundaryEl) return

        const handleScroll = () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
            rafRef.current = requestAnimationFrame(checkVisibility)
        }

        boundaryEl.addEventListener('scroll', handleScroll, { passive: true })
        checkVisibility()

        return () => {
            boundaryEl.removeEventListener('scroll', handleScroll)
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [anchorEl, boundaryEl, checkVisibility])

    return { boundaryEl, isInViewport }
}

// Keep backward compatibility
export const useFloatingToolbarVisibility = (anchorEl: HTMLElement | null) => {
    const { isInViewport } = useFloatingToolbarBoundary(anchorEl)
    return isInViewport
}
