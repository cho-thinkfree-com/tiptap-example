import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'

export const renderShortcutKeys = (keys: string[]) => {
  return keys.map((rawKey, index) => {
    const key = rawKey.toUpperCase()
    const isModifier = key.length > 1

    return (
      <Box
        key={`${key}-${index}`}
        component='span'
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          minWidth: isModifier ? 30 : 28,
          px: 0.65,
          py: 0.25,
          borderRadius: 1.2,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.grey[600], 0.35),
          bgcolor: (theme) => alpha(theme.palette.grey[100], theme.palette.mode === 'light' ? 0.9 : 0.2),
          boxShadow: (theme) =>
            `inset 0 -1px 0 ${alpha(theme.palette.common.black, 0.25)}, inset 0 1px 0 ${alpha(
              theme.palette.common.white,
              0.35,
            )}`,
          fontFamily: 'monospace',
          fontSize: isModifier ? '0.62rem' : '0.66rem',
          fontWeight: 600,
          letterSpacing: 0,
        }}
      >
        {key}
      </Box>
    )
  })
}
