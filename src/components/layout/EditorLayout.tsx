import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import { Box, Drawer, IconButton, Stack, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import { RichTextEditorContext, RichTextEditorProvider } from 'mui-tiptap'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import EditorHeader from '../editor/EditorHeader'
import EditorToolbar from '../editor/EditorToolbar'
import EditorWorkspace from '../editor/EditorWorkspace'
import EditorTableOfContents from '../editor/EditorTableOfContents'
import SlashHelpDialog from '../editor/SlashHelpDialog'
import useEditorInstance from '../../editor/useEditorInstance'
import { useI18n } from '../../lib/i18n'

const TOC_PANEL_WIDTH = 250
const TOC_TOP_OFFSET = 96

const EditorLayout = () => {
  const { strings } = useI18n()
  const [isSlashHelpOpen, setSlashHelpOpen] = useState(false)
  const handleOpenSlashHelp = useCallback(() => {
    startTransition(() => {
      setSlashHelpOpen(true)
    })
  }, [])
  const editor = useEditorInstance({ localeStrings: strings, extensionOptions: { slashHelp: { onShowHelp: handleOpenSlashHelp } } })
  const theme = useTheme()
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'))
  const [isTitleFocused, setIsTitleFocused] = useState(false)
  const [isDesktopTocOpen, setDesktopTocOpen] = useState(true)
  const [isMobileTocOpen, setMobileTocOpen] = useState(false)
  const [isToolbarVisible, setToolbarVisible] = useState(true)
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)


  const toolbarEditor = useMemo(() => (isTitleFocused ? null : editor), [editor, isTitleFocused])
  const shouldRenderToolbar = isToolbarVisible

  const focusTitleEnd = useCallback(() => {
    const input = titleInputRef.current

    if (!input) {
      return
    }

    startTransition(() => {
      setIsTitleFocused(true)
    })

    input.focus({ preventScroll: true })
    requestAnimationFrame(() => {
      const length = input.value.length
      input.setSelectionRange(length, length)
    })
  }, [])

  const focusEditor = useCallback(
    (options?: { position?: 'start' | 'end' }) => {
      if (!editor) {
        return
      }

      startTransition(() => {
        setIsTitleFocused(false)
      })

      if (options?.position) {
        editor.commands.focus(options.position, { scrollIntoView: true })
        return
      }

      editor.commands.focus(undefined, { scrollIntoView: true })
    },
    [editor],
  )

  const handleCloseSlashHelp = useCallback(() => {
    setSlashHelpOpen(false)
    focusEditor()
  }, [focusEditor])

  const handleToggleToolbarVisibility = useCallback(() => {
    setToolbarVisible((prev) => !prev)
  }, [])

  const handleToggleTableOfContents = useCallback(() => {
    if (isLgUp) {
      setDesktopTocOpen((prev) => !prev)
      return
    }

    setMobileTocOpen((prev) => !prev)
  }, [isLgUp])

  const handleCloseMobileToc = useCallback(() => {
    setMobileTocOpen(false)
  }, [])

  const toolbarToggleLabel = isToolbarVisible ? strings.editor.toolbar.hideToolbar : strings.editor.toolbar.showToolbar
  const renderToolbarToggleButton = useCallback(() => {
    const icon = isToolbarVisible ? <UnfoldLessIcon fontSize='small' /> : <UnfoldMoreIcon fontSize='small' />
    return (
      <Tooltip title={toolbarToggleLabel} key={`toolbar-toggle-${isToolbarVisible ? 'visible' : 'hidden'}`}>
        <span>
          <IconButton
            size='small'
            onClick={handleToggleToolbarVisibility}
            aria-label={toolbarToggleLabel}
            aria-pressed={isToolbarVisible}
            sx={(theme) => ({
              borderRadius: 1,
              backgroundColor: isToolbarVisible ? theme.palette.action.selected : 'transparent',
              '&:hover': { backgroundColor: theme.palette.action.hover },
            })}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    )
  }, [handleToggleToolbarVisibility, isToolbarVisible, toolbarToggleLabel])

  const toolbarToggleForToolbar = shouldRenderToolbar ? renderToolbarToggleButton() : null
  const toolbarToggleForHeader = shouldRenderToolbar ? null : renderToolbarToggleButton()
  const toolbarTableOfContentsOpen = isLgUp ? isDesktopTocOpen : isMobileTocOpen
  const desktopTocWidth = isDesktopTocOpen ? TOC_PANEL_WIDTH : 0
  const contentPaddingX = useMemo(
    () => ({
      xs: 2,
      sm: 4,
      lg: isDesktopTocOpen ? 6 : 2,
    }),
    [isDesktopTocOpen],
  )

  const handleTitleFocusChange = useCallback(
    (focused: boolean, event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (focused) {
        startTransition(() => {
          setIsTitleFocused(true)
        })
        return
      }

      const nextTarget = event.relatedTarget as Element | null

      if (!nextTarget || nextTarget === document.body) {
        focusEditor()
        return
      }

      if (editor.view.dom.contains(nextTarget)) {
        startTransition(() => {
          setIsTitleFocused(false)
        })
        return
      }

      focusEditor()
    },
    [editor, focusEditor],
  )

  useEffect(() => {
    if (!editor) {
      return
    }

    const handleEditorFocus = () => {
      startTransition(() => {
        setIsTitleFocused(false)
      })
    }

    const handleEditorBlur = ({ event }: { event?: FocusEvent | Event }) => {
      const related = (event as FocusEvent | undefined)?.relatedTarget as Element | null
      if (related && (titleInputRef.current?.contains(related) || editor.view.dom.contains(related))) {
        return
      }

      if (!related || related === document.body) {
        requestAnimationFrame(() => {
          focusEditor()
        })
      }
    }

    editor.on('focus', handleEditorFocus)
    editor.on('blur', handleEditorBlur)

    return () => {
      editor.off('focus', handleEditorFocus)
      editor.off('blur', handleEditorBlur)
    }
  }, [editor, focusEditor])

  useEffect(() => {
    if (!editor) {
      return
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'ArrowUp') {
        return
      }

      const { selection } = editor.state
      if (!selection.empty) {
        return
      }

      const { $from } = selection
      if ($from.parentOffset !== 0) {
        return
      }

      if ($from.before() !== 0) {
        return
      }

      event.preventDefault()
      focusTitleEnd()
    }

    const dom = editor.view.dom
    dom.addEventListener('keydown', handleKeyDown)

    return () => {
      dom.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, focusTitleEnd])

  useEffect(() => {
    if (!editor) {
      return
    }

    const root = editor.view.dom as HTMLElement

    const handleMouseDown = (event: MouseEvent) => {
      if (!root.contains(event.target as Node)) {
        return
      }

      const coords = { left: event.clientX, top: event.clientY }
      const pos = editor.view.posAtCoords(coords)

      if (!pos) {
        event.preventDefault()
        focusEditor({ position: 'end' })
      }
    }

    root.addEventListener('mousedown', handleMouseDown)

    return () => {
      root.removeEventListener('mousedown', handleMouseDown)
    }
  }, [editor, focusEditor])

  useEffect(() => {
    if (isLgUp) {
      setMobileTocOpen(false)
    }
  }, [isLgUp])

  const toolbarStrings = strings.editor.toolbar
  const isTocOpen = isLgUp ? isDesktopTocOpen : isMobileTocOpen
  const tocToggleLabel = isTocOpen ? toolbarStrings.hideTableOfContents : toolbarStrings.showTableOfContents
  const tocToggleTooltip = toolbarStrings.toggleTableOfContents

  const renderMobileDrawerToggleButton = () => (
    <Tooltip title={tocToggleTooltip}>
      <IconButton
        size='small'
        aria-label={tocToggleLabel}
        aria-pressed={isMobileTocOpen}
        onClick={handleToggleTableOfContents}
        sx={(muiTheme) => ({
          borderRadius: 1,
          backgroundColor: muiTheme.palette.background.paper,
          color: muiTheme.palette.text.primary,
          boxShadow: muiTheme.shadows[1],
          '&:hover': {
            backgroundColor: muiTheme.palette.grey[100],
          },
        })}
      >
        {isMobileTocOpen ? <ChevronLeftIcon fontSize='small' /> : <ChevronRightIcon fontSize='small' />}
      </IconButton>
    </Tooltip>
  )

  if (!editor) {
    return null
  }
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <RichTextEditorProvider editor={editor}>
        {!isLgUp && (
          <Drawer
            anchor='left'
            variant='temporary'
            open={isMobileTocOpen}
            onClose={handleCloseMobileToc}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: TOC_PANEL_WIDTH } }}
          >
            <Box
              sx={{
                width: TOC_PANEL_WIDTH,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                px: 2,
                py: 2,
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>{renderMobileDrawerToggleButton()}</Box>
              <EditorTableOfContents onNavigate={handleCloseMobileToc} />
            </Box>
          </Drawer>
        )}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            minHeight: 0,
          }}
        >
          {isLgUp && (
            <Box
              component='aside'
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                width: `${desktopTocWidth}px`,
                maxWidth: TOC_PANEL_WIDTH,
                flexBasis: `${desktopTocWidth}px`,
                minHeight: 0,
                transition: (muiTheme) =>
                  muiTheme.transitions.create(['width', 'flex-basis'], {
                    duration: muiTheme.transitions.duration.shorter,
                    easing: muiTheme.transitions.easing.easeInOut,
                  }),
              }}
            >
              <Box
                sx={{
                  position: 'fixed',
                  top: TOC_TOP_OFFSET,
                  left: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  height: `calc(100vh - ${TOC_TOP_OFFSET}px)`,
                  width: `${desktopTocWidth}px`,
                  boxSizing: 'border-box',
                }}
              >
                {desktopTocWidth > 0 && (
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.5, pb: 2 }}>
                    <EditorTableOfContents />
                  </Box>
                )}
              </Box>
            </Box>
          )}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <Stack
              spacing={{ xs: 1.5, lg: 2.5 }}
              sx={{
                flexGrow: 1,
                minHeight: 0,
                minWidth: 0,
                display: 'flex',
                px: contentPaddingX,
                py: 3,
              }}
            >
              {shouldRenderToolbar && (
                <RichTextEditorContext.Provider value={toolbarEditor}>
                  <EditorToolbar
                    showTableOfContentsToggle
                    tableOfContentsOpen={toolbarTableOfContentsOpen}
                    onToggleTableOfContents={handleToggleTableOfContents}
                    toolbarToggleControl={toolbarToggleForToolbar}
                    paddingX={contentPaddingX}
                  />
                </RichTextEditorContext.Provider>
              )}
              <EditorHeader
                ref={titleInputRef}
                onFocusChange={handleTitleFocusChange}
                onRequestEditorFocus={() => focusEditor({ position: 'start' })}
                toolbarVisibilityToggle={toolbarToggleForHeader}
              />
              <EditorWorkspace />
            </Stack>
            <SlashHelpDialog open={isSlashHelpOpen} onClose={handleCloseSlashHelp} strings={strings} />
          </Box>
        </Box>
      </RichTextEditorProvider>
    </Box>
  )
}

export default EditorLayout
