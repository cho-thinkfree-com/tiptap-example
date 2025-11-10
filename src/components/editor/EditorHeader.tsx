import { Box, InputBase } from '@mui/material'
import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useI18n } from '../../lib/i18n'

type EditorHeaderProps = {
  onFocusChange?: (isFocused: boolean, event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onRequestEditorFocus?: () => void
  toolbarVisibilityToggle?: ReactNode
}

const EditorHeader = forwardRef<HTMLInputElement | HTMLTextAreaElement, EditorHeaderProps>(
  ({ onFocusChange, onRequestEditorFocus, toolbarVisibilityToggle }, forwardedRef) => {
    const { strings } = useI18n()
    const [title, setTitle] = useState('')
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

    const assignRef = useCallback(
      (node: HTMLInputElement | HTMLTextAreaElement | null) => {
        inputRef.current = node
        if (!forwardedRef) {
          return
        }

        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setTitle(event.target.value)
      },
      [],
    )

    const handleFocus = useCallback(
      (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onFocusChange?.(true, event)
      },
      [onFocusChange],
    )

    const handleBlur = useCallback(
      (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onFocusChange?.(false, event)
      },
      [onFocusChange],
    )

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.key === 'ArrowDown' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault()
          event.stopPropagation()
          onRequestEditorFocus?.()
        }
      },
      [onRequestEditorFocus],
    )

    const { placeholder, ariaLabel } = strings.editor.title

    return (
      <Box data-testid='editor-header' sx={{ px: 0, pl: (theme) => theme.spacing(6) }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <InputBase
            value={title}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            fullWidth
            inputRef={assignRef}
            inputProps={{ 'aria-label': ariaLabel, style: { fontWeight: 600 } }}
            sx={{
              flex: 1,
              fontSize: { xs: '2.1rem', md: '2.6rem' },
              fontWeight: 600,
              lineHeight: 1.2,
              px: 0,
              '& .MuiInputBase-input': {
                padding: 0,
                fontSize: 'inherit',
                fontWeight: 'inherit',
              },
            }}
          />
          {toolbarVisibilityToggle ? (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>{toolbarVisibilityToggle}</Box>
          ) : null}
        </Box>
      </Box>
    )
  },
)

EditorHeader.displayName = 'EditorHeader'

export default EditorHeader
