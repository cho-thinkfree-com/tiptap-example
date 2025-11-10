import CloseIcon from '@mui/icons-material/Close'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from '@mui/material'
import { useEffect, useMemo, useState, useRef } from 'react'
import type { AppStrings } from '../../lib/i18n'
import { headingSlashCommandDefinitions, createHeadingSlashCommands } from '../../editor/slashCommands'
import { renderShortcutKeys } from '../../lib/renderShortcutKeys'

type SlashHelpDialogProps = {
  open: boolean
  onClose: () => void
  strings: AppStrings
}

const SlashHelpDialog = ({ open, onClose, strings }: SlashHelpDialogProps) => {
  const headingCommands = useMemo(() => createHeadingSlashCommands(strings), [strings])
  const slashHelpStrings = strings.editor.slashHelp
  const shortcutsStrings = strings.editor.shortcuts
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const commandsWithShortcuts = useMemo(() => {
    return headingCommands.map((command) => {
      const definition = headingSlashCommandDefinitions.find((item) => item.id === command.id)
      const level = definition?.level
      const shortcutsForLevel = level ? strings.editor.slashCommands.heading.shortcuts[level] : undefined
      return {
        ...command,
        shortcuts: shortcutsForLevel,
      }
    })
  }, [headingCommands, strings.editor.slashCommands.heading.shortcuts])

  const filteredHeadingCommands = useMemo(() => {
    if (!normalizedQuery) {
      return commandsWithShortcuts
    }
    return commandsWithShortcuts.filter((command) => {
      const haystacks = [`/${command.alias}`, command.title, command.description ?? '']
      return haystacks.some((text) => text.toLowerCase().includes(normalizedQuery))
    })
  }, [commandsWithShortcuts, normalizedQuery])

  const filteredShortcutOnlyItems = useMemo(() => {
    const slashCommandShortcutSet = new Set(
      commandsWithShortcuts
        .map((command) => command.shortcuts?.join('+'))
        .filter(Boolean),
    )

    const baseShortcuts = shortcutsStrings.items.filter((shortcut) => {
      const keyId = shortcut.keys.join('+')
      return !slashCommandShortcutSet.has(keyId)
    })

    if (!normalizedQuery) {
      return baseShortcuts
    }

    return baseShortcuts.filter((shortcut) => {
      const haystacks = [shortcut.label, shortcut.description ?? '', shortcut.keys.join(' ')]
      return haystacks.some((text) => text.toLowerCase().includes(normalizedQuery))
    })
  }, [commandsWithShortcuts, shortcutsStrings.items, normalizedQuery])

  const hasCommandMatches = filteredHeadingCommands.length > 0
  const hasShortcutMatches = filteredShortcutOnlyItems.length > 0
  const hasResults = hasCommandMatches || hasShortcutMatches

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle sx={{ pr: 6 }}>
        {slashHelpStrings.title}
        <IconButton
          aria-label={slashHelpStrings.close}
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pt: 2,
        }}
      >
        <Typography variant='body2' color='text.secondary'>
          {slashHelpStrings.description}
        </Typography>
        <TextField
          size='small'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={slashHelpStrings.searchPlaceholder}
          inputRef={searchInputRef}
        />

        <Box sx={{ maxHeight: 360, minHeight: 260, overflowY: 'auto', pr: 0.5 }}>
          {hasResults ? (
            <Box
              sx={{
                display: 'grid',
                gap: 3,
                gridTemplateColumns: { xs: 'repeat(1, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' },
              }}
            >
              <Box>
                <Typography variant='subtitle2' gutterBottom>
                  {slashHelpStrings.commandsTitle}
                </Typography>
                <Box component='ul' sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {filteredHeadingCommands.length > 0 ? (
                    filteredHeadingCommands.map((command) => (
                      <Box
                        key={command.id}
                        component='li'
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          py: 0.75,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Typography variant='body2' sx={{ fontFamily: 'monospace', fontWeight: 600, minWidth: 72 }}>{`/${command.alias}`}</Typography>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant='body2' fontWeight={600}>
                            {command.title}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {command.description}
                          </Typography>
                        </Box>
                        {command.shortcuts && (
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {renderShortcutKeys(command.shortcuts)}
                          </Box>
                        )}
                      </Box>
                    ))
                  ) : (
                    <Typography variant='body2' color='text.secondary'>
                      {slashHelpStrings.noCommands}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box>
                <Typography variant='subtitle2' gutterBottom>
                  {slashHelpStrings.shortcutsTitle}
                </Typography>
                <Box component='ul' sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {filteredShortcutOnlyItems.length > 0 ? (
                    filteredShortcutOnlyItems.map((shortcut) => (
                      <Box
                        key={shortcut.id}
                        component='li'
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 2,
                          py: 0.75,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: 'background.paper',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant='body2' fontWeight={600}>
                            {shortcut.label}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {shortcut.description}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {renderShortcutKeys(shortcut.keys)}
                        </Box>
                      </Box>
                    ))
                  ) : (
                    <Typography variant='body2' color='text.secondary'>
                      {slashHelpStrings.noShortcuts}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              {slashHelpStrings.noResults}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{slashHelpStrings.close}</Button>
      </DialogActions>
    </Dialog>
  )
}

export default SlashHelpDialog
