import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ChecklistIcon from '@mui/icons-material/Checklist'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify'
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft'
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight'
import FormatClearIcon from '@mui/icons-material/FormatClear'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import SubscriptIcon from '@mui/icons-material/Subscript'
import SuperscriptIcon from '@mui/icons-material/Superscript'
import { Box, IconButton, Popover, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  DebounceRender,
  MenuBar,
  MenuButtonAddTable,
  MenuButtonAlignCenter,
  MenuButtonAlignJustify,
  MenuButtonAlignLeft,
  MenuButtonAlignRight,
  MenuButtonBlockquote,
  MenuButtonBold,
  MenuButtonBulletedList,
  MenuButtonCode,
  MenuButtonCodeBlock,
  MenuButtonEditLink,
  MenuButtonHighlightColor,
  MenuButtonHighlightToggle,
  MenuButtonHorizontalRule,
  MenuButtonImageUpload,
  MenuButtonItalic,
  MenuButtonOrderedList,
  MenuButtonRedo,
  MenuButtonRemoveFormatting,
  MenuButtonStrikethrough,
  MenuButtonSubscript,
  MenuButtonSuperscript,
  MenuButtonTaskList,
  MenuButtonTextColor,
  MenuButtonUnderline,
  MenuButtonUndo,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  useRichTextEditorContext,
} from 'mui-tiptap'
import { filesToImageAttributes } from '../../lib/imageUpload'
import { useI18n } from '../../lib/i18n'
import MenuButtonCallout from './MenuButtonCallout'

const COLOR_SWATCHES = ['#000000', '#5f6368', '#1a73e8', '#d93025', '#188038', '#673ab7', '#e37400']
const HIGHLIGHT_SWATCHES = ['#fff59d', '#fbcfe8', '#bbdefb', '#c8e6c9', '#ffe0b2']

const BASE_KEYS = [
  'heading',
  'align-left',
  'align-center',
  'align-right',
  'align-justify',
  'divider-1',
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'divider-2',
  'text-color',
  'highlight-toggle',
  'highlight-color',
  'subscript',
  'superscript',
  'divider-3',
  'ordered-list',
  'bullet-list',
  'task-list',
  'callout',
  'divider-4',
  'blockquote',
  'code-block',
  'horizontal-rule',
  'divider-5',
  'edit-link',
  'upload-image',
  'add-table',
  'divider-6',
  'undo',
  'redo',
  'clear-format',
] as const

const isDivider = (key: string) => key.startsWith('divider')
const FALLBACK_DIVIDER_WIDTH = 8
const ALIGN_GROUP_KEYS = ['align-left', 'align-center', 'align-right', 'align-justify'] as const
const LIST_GROUP_KEYS = ['ordered-list', 'bullet-list', 'task-list'] as const
const SCRIPT_GROUP_KEYS = ['script-normal', 'subscript', 'superscript'] as const
const GROUP_KEY = {
  'align-left': 'align-group',
  'align-center': 'align-group',
  'align-right': 'align-group',
  'align-justify': 'align-group',
  'ordered-list': 'list-group',
  'bullet-list': 'list-group',
  'task-list': 'list-group',
  subscript: 'script-group',
  superscript: 'script-group',
} as const

type EditorToolbarProps = {
  showTableOfContentsToggle?: boolean
  tableOfContentsOpen?: boolean
  onToggleTableOfContents?: () => void
  toolbarToggleControl?: ReactNode
  paddingX?: { xs?: number; sm?: number; lg?: number } | number
}

const EditorToolbar = ({
  showTableOfContentsToggle,
  tableOfContentsOpen,
  onToggleTableOfContents,
  toolbarToggleControl,
  paddingX,
}: EditorToolbarProps) => {
  const { strings } = useI18n()
  const toolbarStrings = strings.editor.toolbar
  const editor = useRichTextEditorContext()
  const editorSelectionJSON = editor?.state?.selection?.toJSON()
  const [, forceRender] = useState(0)
  const rafRef = useRef<number | null>(null)
  const [overflowAnchor, setOverflowAnchor] = useState<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLDivElement | null>>([])
  const overflowMeasureRef = useRef<HTMLButtonElement | null>(null)
  const toggleRef = useRef<HTMLDivElement | null>(null)
  const toolbarToggleRef = useRef<HTMLDivElement | null>(null)
  const hasToolbarToggleControl = Boolean(toolbarToggleControl)
  const [alignAnchor, setAlignAnchor] = useState<HTMLElement | null>(null)
  const [listAnchor, setListAnchor] = useState<HTMLElement | null>(null)
  const [scriptAnchor, setScriptAnchor] = useState<HTMLElement | null>(null)
  const [visibleCount, setVisibleCount] = useState(0)
  const isCompactToolbar = Boolean(showTableOfContentsToggle)

  useEffect(() => {
    if (!editor) {
      return
    }

    const scheduleRender = () => {
      if (rafRef.current !== null) {
        return
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        forceRender((value) => value + 1)
      })
    }

    editor.on('selectionUpdate', scheduleRender)
    editor.on('transaction', scheduleRender)

    return () => {
      editor.off('selectionUpdate', scheduleRender)
      editor.off('transaction', scheduleRender)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [editor])

  const handleUpload = useCallback(async (files: File[]) => {
    try {
      return await filesToImageAttributes(files)
    } catch (error) {
      console.error('Failed to process images', error)
      return []
    }
  }, [])

  const renderStandaloneControl = useCallback(
    (key: string) => {
      switch (key) {
        case 'heading':
          return <MenuSelectHeading aria-label={toolbarStrings.headingLabel} />
        case 'align-left':
          return <MenuButtonAlignLeft />
        case 'align-center':
          return <MenuButtonAlignCenter />
        case 'align-right':
          return <MenuButtonAlignRight />
        case 'align-justify':
          return <MenuButtonAlignJustify />
        case 'bold':
          return <MenuButtonBold />
        case 'italic':
          return <MenuButtonItalic />
        case 'underline':
          return <MenuButtonUnderline />
        case 'strike':
          return <MenuButtonStrikethrough />
        case 'code':
          return <MenuButtonCode />
        case 'text-color':
          return <MenuButtonTextColor swatchColors={COLOR_SWATCHES} />
        case 'highlight-toggle':
          return <MenuButtonHighlightToggle />
        case 'highlight-color':
          return <MenuButtonHighlightColor swatchColors={HIGHLIGHT_SWATCHES} />
        case 'subscript':
          return <MenuButtonSubscript />
        case 'superscript':
          return <MenuButtonSuperscript />
        case 'ordered-list':
          return <MenuButtonOrderedList />
        case 'bullet-list':
          return <MenuButtonBulletedList />
        case 'task-list':
          return <MenuButtonTaskList />
        case 'callout':
          return <MenuButtonCallout />
        case 'blockquote':
          return <MenuButtonBlockquote />
        case 'code-block':
          return <MenuButtonCodeBlock />
        case 'horizontal-rule':
          return <MenuButtonHorizontalRule />
        case 'edit-link':
          return <MenuButtonEditLink />
        case 'upload-image':
          return <MenuButtonImageUpload onUploadFiles={handleUpload} inputProps={{ accept: 'image/*', multiple: true }} />
        case 'add-table':
          return <MenuButtonAddTable />
        case 'undo':
          return <MenuButtonUndo />
        case 'redo':
          return <MenuButtonRedo />
        case 'clear-format':
          return <MenuButtonRemoveFormatting />
        default:
          return <MenuDivider />
      }
    },
    [handleUpload, toolbarStrings.headingLabel],
  )

  const controlKeys = useMemo<string[]>(() => {
    if (!isCompactToolbar) {
      return [...BASE_KEYS]
    }
    const includedGroups = new Set<string>()
    return BASE_KEYS.reduce<string[]>((acc, key) => {
      const groupKey = GROUP_KEY[key as keyof typeof GROUP_KEY]
      if (groupKey) {
        if (!includedGroups.has(groupKey)) {
          includedGroups.add(groupKey)
          acc.push(groupKey)
        }
        return acc
      }
      acc.push(key)
      return acc
    }, [])
  }, [isCompactToolbar])
  itemRefs.current = itemRefs.current.slice(0, controlKeys.length)

  useEffect(() => {
    setVisibleCount(controlKeys.length)
  }, [controlKeys.length])

  const updateVisibility = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const containerWidth = container.clientWidth
    if (containerWidth <= 0) {
      setVisibleCount(controlKeys.length)
      return
    }

    const containerStyles = window.getComputedStyle(container)
    const gapValue = Number.parseFloat(containerStyles.columnGap || '0')
    const gap = Number.isNaN(gapValue) ? 0 : gapValue
    const parsePx = (value: string | null) => {
      if (!value) {
        return 0
      }
      const parsed = Number.parseFloat(value)
      return Number.isNaN(parsed) ? 0 : parsed
    }
    const toggleWidth = toggleRef.current?.getBoundingClientRect().width ?? 0
    const widths = controlKeys.map((_, index) => {
      const el = itemRefs.current[index]
      if (!el) {
        return 0
      }
      const rectWidth = el.getBoundingClientRect().width
      const style = window.getComputedStyle(el)
      const marginLeft = parsePx(style.marginLeft)
      const marginRight = parsePx(style.marginRight)
      return rectWidth + marginLeft + marginRight
    })

    const overflowWidth = (() => {
      if (!overflowMeasureRef.current) {
        return 0
      }
      const rect = overflowMeasureRef.current.getBoundingClientRect()
      const style = window.getComputedStyle(overflowMeasureRef.current)
      const marginLeft = parsePx(style.marginLeft)
      const marginRight = parsePx(style.marginRight)
      return rect.width + marginLeft + marginRight
    })()
    const dividerWidth = (() => {
      const dividerIndex = controlKeys.findIndex((key) => isDivider(key))
      if (dividerIndex === -1) {
        return FALLBACK_DIVIDER_WIDTH
      }
      const measured = widths[dividerIndex]
      return measured || FALLBACK_DIVIDER_WIDTH
    })()
    const toolbarToggleWidth = (() => {
      if (!hasToolbarToggleControl || !toolbarToggleRef.current) {
        return 0
      }
      const rect = toolbarToggleRef.current.getBoundingClientRect()
      const style = window.getComputedStyle(toolbarToggleRef.current)
      const marginLeft = parsePx(style.marginLeft)
      const marginRight = parsePx(style.marginRight)
      return rect.width + marginLeft + marginRight
    })()
    let nextVisible = controlKeys.length

    for (let n = controlKeys.length; n >= 0; n -= 1) {
      const itemsWidth = widths.slice(0, n).reduce((sum, width) => sum + width, 0)
      const gapsWidth = n > 0 ? gap * (n - 1) : 0
      const needsOverflow = n < controlKeys.length
      const needsSyntheticDivider = needsOverflow && n > 0 && !isDivider(controlKeys[n - 1])
      let overflowTotal = 0
      if (needsOverflow) {
        if (n > 0) {
          overflowTotal += gap
        }
        if (needsSyntheticDivider) {
          overflowTotal += dividerWidth
          overflowTotal += gap
        }
        overflowTotal += overflowWidth
      }
      const toggleGap = toggleWidth > 0 && (n > 0 || needsOverflow) ? gap : 0
      const leadingContentExists = toggleWidth > 0 || n > 0 || needsOverflow
      const trailingToggleGap = toolbarToggleWidth > 0 && leadingContentExists ? gap : 0
      const totalWidth =
        toggleWidth + toggleGap + itemsWidth + gapsWidth + overflowTotal + trailingToggleGap + toolbarToggleWidth
      if (totalWidth <= containerWidth) {
        nextVisible = n
        break
      }
    }

    setVisibleCount((prev) => (prev === nextVisible ? prev : nextVisible))
  }, [controlKeys, hasToolbarToggleControl])

  useEffect(() => {
    if (!containerRef.current) {
      return undefined
    }

    let resizeRaf: number | null = null

    const handleResize = () => {
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf)
      }
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null
        updateVisibility()
      })
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(containerRef.current)
    window.addEventListener('resize', handleResize)

    const frame = requestAnimationFrame(updateVisibility)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frame)
      if (resizeRaf !== null) {
        cancelAnimationFrame(resizeRaf)
      }
    }
  }, [updateVisibility])

  useEffect(() => {
    const frame = requestAnimationFrame(updateVisibility)
    return () => cancelAnimationFrame(frame)
  }, [controlKeys, updateVisibility])

  useEffect(() => {
    const frame = requestAnimationFrame(updateVisibility)
    return () => cancelAnimationFrame(frame)
  }, [showTableOfContentsToggle, tableOfContentsOpen, updateVisibility])

  useEffect(() => {
    if (!showTableOfContentsToggle) {
      toggleRef.current = null
    }
  }, [showTableOfContentsToggle])

  useEffect(() => {
    if (!hasToolbarToggleControl) {
      toolbarToggleRef.current = null
    }
  }, [hasToolbarToggleControl])
  const handleToolbarMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!editor || !editor.isEditable) {
        return
      }

      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      editor.commands.focus(undefined, { scrollIntoView: false })
    },
    [editor],
  )

  const handleOpenOverflow = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setOverflowAnchor(event.currentTarget)
  }, [])

  const handleCloseOverflow = useCallback(() => {
    setOverflowAnchor(null)
  }, [])

  const overflowItems = controlKeys.slice(visibleCount).filter((key) => !isDivider(key))
  const showOverflowButton = overflowItems.length > 0
  const lastVisibleIndex = Math.min(visibleCount, controlKeys.length) - 1
  const lastVisibleKey = lastVisibleIndex >= 0 ? controlKeys[lastVisibleIndex] : null
  const showOverflowDivider = showOverflowButton && !isDivider(lastVisibleKey ?? '')
  const overflowOpen = Boolean(overflowAnchor)

  useEffect(() => {
    if (overflowOpen && !showOverflowButton) {
      setOverflowAnchor(null)
    }
  }, [overflowOpen, showOverflowButton])

  const renderGroupedMenu = useCallback(
    (keys: readonly string[], onClose: () => void) => (
      <MenuControlsContainer sx={{ rowGap: 0.5, columnGap: 0.5, p: 0.5 }}>
        {keys.map((childKey) => (
          <Box
            key={`group-${childKey}`}
            sx={{ display: 'inline-flex', alignItems: 'center' }}
            onClick={onClose}
            role='menuitem'
          >
            {renderStandaloneControl(childKey)}
          </Box>
        ))}
      </MenuControlsContainer>
    ),
    [renderStandaloneControl],
  )

  const currentAlignState = useMemo(() => {
    if (!editor || !editorSelectionJSON) {
      return { icon: <FormatAlignLeftIcon fontSize='small' />, selectedKey: 'align-left' as const }
    }
    if (editor.isActive({ textAlign: 'center' })) {
      return { icon: <FormatAlignCenterIcon fontSize='small' />, selectedKey: 'align-center' as const }
    }
    if (editor.isActive({ textAlign: 'right' })) {
      return { icon: <FormatAlignRightIcon fontSize='small' />, selectedKey: 'align-right' as const }
    }
    if (editor.isActive({ textAlign: 'justify' })) {
      return { icon: <FormatAlignJustifyIcon fontSize='small' />, selectedKey: 'align-justify' as const }
    }
    return { icon: <FormatAlignLeftIcon fontSize='small' />, selectedKey: 'align-left' as const }
  }, [editor, editorSelectionJSON])

  const currentListState = useMemo(() => {
    if (!editor || !editorSelectionJSON) {
      return { icon: <FormatListBulletedIcon fontSize='small' />, selectedKey: null }
    }
    if (editor.isActive('orderedList')) {
      return { icon: <FormatListNumberedIcon fontSize='small' />, selectedKey: 'ordered-list' as const }
    }
    if (editor.isActive('taskList')) {
      return { icon: <ChecklistIcon fontSize='small' />, selectedKey: 'task-list' as const }
    }
    if (editor.isActive('bulletList')) {
      return { icon: <FormatListBulletedIcon fontSize='small' />, selectedKey: 'bullet-list' as const }
    }
    return { icon: <FormatListBulletedIcon fontSize='small' />, selectedKey: null }
  }, [editor, editorSelectionJSON])

  const currentScriptState = useMemo(() => {
    if (!editor || !editorSelectionJSON) {
      return { icon: <SuperscriptIcon fontSize='small' />, selectedKey: null as 'script-normal' | 'subscript' | 'superscript' | null }
    }
    if (editor.isActive('subscript')) {
      return { icon: <SubscriptIcon fontSize='small' />, selectedKey: 'subscript' as const }
    }
    if (editor.isActive('superscript')) {
      return { icon: <SuperscriptIcon fontSize='small' />, selectedKey: 'superscript' as const }
    }
    return { icon: <SuperscriptIcon fontSize='small' />, selectedKey: 'script-normal' as const }
  }, [editor, editorSelectionJSON])

  const isControlEnabled = useCallback(
    (key: string) => {
      if (!editor) {
        return false
      }
      const chain = editor.can().chain().focus()
      switch (key) {
        case 'align-left':
          return chain.setTextAlign('left').run()
        case 'align-center':
          return chain.setTextAlign('center').run()
        case 'align-right':
          return chain.setTextAlign('right').run()
        case 'align-justify':
          return chain.setTextAlign('justify').run()
        case 'ordered-list':
          return chain.toggleOrderedList().run()
        case 'bullet-list':
          return chain.toggleBulletList().run()
        case 'task-list':
          return chain.toggleTaskList().run()
        case 'subscript':
          return chain.toggleSubscript().run()
        case 'superscript':
          return chain.toggleSuperscript().run()
        default:
          return true
      }
    },
    [editor],
  )

  const alignGroupDisabled = ALIGN_GROUP_KEYS.every((key) => !isControlEnabled(key))
  const listGroupDisabled = LIST_GROUP_KEYS.every((key) => !isControlEnabled(key))
  const scriptToggleAvailable = SCRIPT_GROUP_KEYS.slice(1).some((key) => isControlEnabled(key))
  const canResetScript = Boolean(editor?.can().chain().focus().unsetSubscript().unsetSuperscript().run())
  const scriptGroupDisabled = !scriptToggleAvailable && !canResetScript

  const handleOpenAlignGroup = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (alignGroupDisabled) {
        return
      }
      setAlignAnchor(event.currentTarget)
    },
    [alignGroupDisabled],
  )
  const handleCloseAlignGroup = useCallback(() => {
    setAlignAnchor(null)
  }, [])
  const handleOpenListGroup = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (listGroupDisabled) {
        return
      }
      setListAnchor(event.currentTarget)
    },
    [listGroupDisabled],
  )
  const handleCloseListGroup = useCallback(() => {
    setListAnchor(null)
  }, [])
  const handleOpenScriptGroup = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (scriptGroupDisabled) {
        return
      }
      setScriptAnchor(event.currentTarget)
    },
    [scriptGroupDisabled],
  )
  const handleCloseScriptGroup = useCallback(() => {
    setScriptAnchor(null)
  }, [])
  const handleResetScript = useCallback(() => {
    if (!editor) {
      return
    }
    editor.chain().focus().unsetSubscript().unsetSuperscript().run()
    handleCloseScriptGroup()
  }, [editor, handleCloseScriptGroup])
  const renderGroupedTrigger = useCallback(
    (
      icon: React.ReactNode,
      tooltip: string,
      onClick: (event: React.MouseEvent<HTMLElement>) => void,
      disabled: boolean,
      pressed: boolean,
    ) => (
      <Tooltip title={tooltip}>
        <span>
          <IconButton
            size='small'
            aria-label={tooltip}
            onClick={onClick}
            disabled={disabled}
            aria-pressed={pressed}
            sx={(theme) => ({
              borderRadius: 1,
              backgroundColor: pressed ? theme.palette.action.selected : 'transparent',
              opacity: disabled ? 0.5 : 1,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            })}
          >
            {icon}
          </IconButton>
        </span>
      </Tooltip>
    ),
    [],
  )

  const toggleControl =
    showTableOfContentsToggle && onToggleTableOfContents ? (
      <Box
        ref={(node: HTMLDivElement | null) => {
          toggleRef.current = node
        }}
        sx={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Tooltip
          title={tableOfContentsOpen ? toolbarStrings.hideTableOfContents : toolbarStrings.showTableOfContents}
          placement='bottom-start'
        >
          <IconButton
            size='small'
            onClick={onToggleTableOfContents}
            aria-label={tableOfContentsOpen ? toolbarStrings.hideTableOfContents : toolbarStrings.showTableOfContents}
            aria-pressed={Boolean(tableOfContentsOpen)}
          >
            {tableOfContentsOpen ? <ChevronLeftIcon fontSize='small' /> : <ChevronRightIcon fontSize='small' />}
          </IconButton>
        </Tooltip>
      </Box>
    ) : null;

  const renderControls = (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        columnGap: 0.75,
        rowGap: 0.75,
        flexWrap: 'nowrap',
        overflow: 'hidden',
        '& > *': { flexShrink: 0 },
      }}
    >
      {toggleControl}
      {controlKeys.map((key, index) => {
        const isVisible = index < visibleCount
        return (
          <Box
            key={key}
            ref={(el: HTMLDivElement | null) => {
              itemRefs.current[index] = el
            }}
            aria-hidden={!isVisible}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              ...(isVisible
                ? {}
                : {
                    position: 'absolute',
                    visibility: 'hidden',
                    pointerEvents: 'none',
                    top: 0,
                    left: 0,
                  }),
            }}
          >
            {(() => {
              if (key === 'align-group') {
                return (
                  <>
                    {renderGroupedTrigger(
                      currentAlignState.icon,
                      toolbarStrings.textAlignLabel,
                      handleOpenAlignGroup,
                      alignGroupDisabled,
                      Boolean(currentAlignState.selectedKey),
                    )}
                    <Popover
                      open={Boolean(alignAnchor)}
                      anchorEl={alignAnchor}
                      onClose={handleCloseAlignGroup}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    >
                      {renderGroupedMenu(ALIGN_GROUP_KEYS, handleCloseAlignGroup)}
                    </Popover>
                  </>
                )
              }
              if (key === 'list-group') {
                return (
                  <>
                    {renderGroupedTrigger(
                      currentListState.icon,
                      toolbarStrings.listControlsLabel,
                      handleOpenListGroup,
                      listGroupDisabled,
                      Boolean(currentListState.selectedKey),
                    )}
                    <Popover
                      open={Boolean(listAnchor)}
                      anchorEl={listAnchor}
                      onClose={handleCloseListGroup}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    >
                      {renderGroupedMenu(LIST_GROUP_KEYS, handleCloseListGroup)}
                    </Popover>
                  </>
                )
              }
              if (key === 'script-group') {
                return (
                  <>
                    {renderGroupedTrigger(
                      currentScriptState.icon,
                      toolbarStrings.scriptControlsLabel,
                      handleOpenScriptGroup,
                      scriptGroupDisabled,
                      Boolean(currentScriptState.selectedKey && currentScriptState.selectedKey !== 'script-normal'),
                    )}
                    <Popover
                      open={Boolean(scriptAnchor)}
                      anchorEl={scriptAnchor}
                      onClose={handleCloseScriptGroup}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    >
                      <Box sx={{ display: 'flex', gap: 0.5, p: 0.5 }}>
                        <Tooltip title={toolbarStrings.scriptNormalLabel}>
                          <span>
                            <IconButton
                              size='small'
                              onClick={handleResetScript}
                              disabled={!canResetScript}
                              aria-pressed={currentScriptState.selectedKey === 'script-normal'}
                              sx={{ borderRadius: 1 }}
                            >
                              <FormatClearIcon fontSize='small' />
                            </IconButton>
                          </span>
                        </Tooltip>
                        {SCRIPT_GROUP_KEYS.slice(1).map((childKey) => (
                          <Box
                            key={`script-${childKey}`}
                            sx={{ display: 'inline-flex', alignItems: 'center' }}
                            onClick={handleCloseScriptGroup}
                          >
                            {renderStandaloneControl(childKey)}
                          </Box>
                        ))}
                      </Box>
                    </Popover>
                  </>
                )
              }
              return renderStandaloneControl(key)
            })()}
          </Box>
        )
      })}
      {showOverflowButton && showOverflowDivider && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
          <MenuDivider />
        </Box>
      )}
      {showOverflowButton && (
        <Tooltip title={toolbarStrings.moreFormatting}>
          <span>
            <IconButton
              aria-label={toolbarStrings.moreFormattingOptions}
              size='small'
              onClick={handleOpenOverflow}
              sx={(theme) => ({
                borderRadius: 1,
                backgroundColor: overflowOpen ? theme.palette.action.selected : 'transparent',
                '&:hover': { backgroundColor: theme.palette.action.hover },
              })}
            >
              <MoreHorizIcon fontSize='small' />
            </IconButton>
          </span>
        </Tooltip>
      )}
      {toolbarToggleControl && (
        <Box
          ref={(node: HTMLDivElement | null) => {
            toolbarToggleRef.current = node
          }}
          sx={{ display: 'inline-flex', alignItems: 'center' }}
        >
          {toolbarToggleControl}
        </Box>
      )}
    </Box>
  )

    return (
    <MenuBar
      disableSticky={false}
      stickyOffset={0}
      onMouseDownCapture={handleToolbarMouseDown}
      sx={{
        borderBottomWidth: 0,
        px: paddingX ?? { xs: 2, sm: 4, lg: 6 },
      }}
    >
      <DebounceRender wait={120}>{renderControls}</DebounceRender>
      {showOverflowButton && (
        <Popover
          open={overflowOpen}
          anchorEl={overflowAnchor}
          onClose={handleCloseOverflow}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { p: 1.5, maxWidth: 360 } }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant='caption' color='text.secondary' sx={{ px: 0.5, pb: 0.5, display: 'block' }}>
              {toolbarStrings.additionalTools}
            </Typography>
            <MenuControlsContainer sx={{ rowGap: 0.5, columnGap: 0.5 }}>
              {overflowItems.map((key) => (
                <Box key={`overflow-${key}`} sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  {renderStandaloneControl(key)}
                </Box>
              ))}
            </MenuControlsContainer>
          </Box>
        </Popover>
      )}
      <IconButton
        ref={(button: HTMLButtonElement | null) => {
          overflowMeasureRef.current = button
        }}
        size='small'
        sx={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          top: -9999,
          left: -9999,
          borderRadius: 1,
        }}
      >
        <MoreHorizIcon fontSize='small' />
      </IconButton>
    </MenuBar>
  )
}

export default EditorToolbar
