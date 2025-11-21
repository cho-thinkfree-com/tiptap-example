import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { offset, shift } from '@floating-ui/dom'
import { useRichTextEditorContext } from 'mui-tiptap'

const HANDLE_SIZE = 28
const HANDLE_OFFSET_X = 0
const HANDLE_GAP = 8
const LINE_HEIGHT_FALLBACK_RATIO = 1.2

const parsePixelValue = (raw: string) => {
  const value = Number.parseFloat(raw)
  return Number.isNaN(value) ? 0 : value
}

const resolveDomElement = (reference: Element | { contextElement?: Element | null } | null) => {
  if (!reference) {
    return null
  }

  if (reference instanceof Element) {
    return reference
  }

  if ('contextElement' in reference && reference.contextElement instanceof Element) {
    return reference.contextElement
  }

  return null
}

const resolveLineHeight = (style: CSSStyleDeclaration, fallback: number) => {
  const raw = style.lineHeight
  const fontSize = parsePixelValue(style.fontSize)

  if (raw.endsWith('px')) {
    const lineHeight = parsePixelValue(raw)
    return lineHeight > 0 ? lineHeight : fallback
  }

  const numeric = Number.parseFloat(raw)

  if (!Number.isNaN(numeric)) {
    if (raw.endsWith('%')) {
      return fontSize > 0 ? (numeric / 100) * fontSize : fallback
    }

    if (fontSize > 0) {
      return numeric * fontSize
    }
  }

  if (fontSize > 0) {
    return fontSize * LINE_HEIGHT_FALLBACK_RATIO
  }

  return fallback
}

const getFirstLineRect = (element: Element) => {
  const range = document.createRange()

  try {
    range.selectNodeContents(element)
  } catch {
    return null
  }

  const rects = range.getClientRects()
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects.item(index)
    if (rect && rect.height > 0 && rect.width > 0) {
      return rect
    }
  }

  return null
}

const BlockDragHandle = () => {
  const editor = useRichTextEditorContext()

  if (!editor) {
    return null
  }

  const container = editor.view.dom as HTMLElement

  return (
    <DragHandle
      editor={editor}
      className='editor-block-handle'
      computePositionConfig={{
        placement: 'left',
        middleware: [
          offset(({ rects, elements }) => {
            const { reference } = rects
            const referenceElement = resolveDomElement(elements.reference as Element | { contextElement?: Element | null } | null)

            let crossAxis = 0

            if (referenceElement) {
              const referenceStyle = window.getComputedStyle(referenceElement)
              const paddingTop = parsePixelValue(referenceStyle.paddingTop)
              const lineHeight = resolveLineHeight(referenceStyle, reference.height)

              let targetCenterFromTop = paddingTop + lineHeight / 2

              const firstLineRect = getFirstLineRect(referenceElement)
              if (firstLineRect) {
                const referenceY = 'y' in reference ? reference.y : (reference as DOMRect).top
                targetCenterFromTop = firstLineRect.top - referenceY + firstLineRect.height / 2
              }

              crossAxis = targetCenterFromTop - reference.height / 2
            }

            const crossAxisLimit = Math.max(reference.height - HANDLE_SIZE, 0)
            crossAxis = Math.min(Math.max(crossAxis, -crossAxisLimit), crossAxisLimit)

            // Dynamically find the container with padding to center the handle in the "Green Area"
            let paddingLeft = 0
            if (container instanceof HTMLElement) {
              let current: HTMLElement | null = container
              // Traverse up to find the container with significant padding
              // We limit the search to avoid going too far up
              for (let i = 0; i < 5; i++) {
                if (!current) break
                const style = window.getComputedStyle(current)
                const pl = parsePixelValue(style.paddingLeft)
                if (pl > 10) { // Threshold to ignore small paddings
                  paddingLeft = pl
                  break
                }
                current = current.parentElement
              }
            }

            // If no padding found or it's too small, default to a reasonable offset
            // mainAxis is the gap between reference (paragraph) and handle.
            // Move into the left padding area; push further left if padding is wide.
            const mainAxis = paddingLeft > 0
              ? -((paddingLeft - HANDLE_SIZE) / 2 + HANDLE_GAP + 40)
              : -40 // Default fallback

            return {
              mainAxis,
              crossAxis,
            }
          }),
          shift({
            crossAxis: true,
            padding: 0,
          }),
        ],
      }}
      onElementDragStart={() => {
        document.body.classList.add('editor-block-handle-dragging')
      }}
      onElementDragEnd={() => {
        document.body.classList.remove('editor-block-handle-dragging')
      }}
    >
      <button type='button' className='editor-block-handle__button' aria-label='Drag block' tabIndex={-1}>
        <svg className='editor-block-handle__icon' viewBox='0 0 24 24' focusable='false' aria-hidden='true'>
          <path d='M8 6h2v2H8zM14 6h2v2h-2zM8 11h2v2H8zM14 11h2v2h-2zM8 16h2v2H8zM14 16h2v2h-2z' />
        </svg>
      </button>
    </DragHandle>
  )
}

export default BlockDragHandle
