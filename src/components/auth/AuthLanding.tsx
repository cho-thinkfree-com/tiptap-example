import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'

const featureList = [
  '실시간 공동작성, 문서 버전은 자동 기록',
  '파일 없이 markdown/pdf/html export 예약',
  '프로젝트 단위 워크스페이스 + 활동 로그',
]

const AuthLanding = () => {
  const theme = useTheme()
  const { login, signup } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [form, setForm] = useState({ email: '', password: '', legalName: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleModeSwitch = (nextMode: 'login' | 'signup') => {
    setMode(nextMode)
    setError(null)
  }

  const handleChange =
    (field: 'email' | 'password' | 'legalName') => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password })
      } else {
        await signup({ email: form.email, password: form.password, legalName: form.legalName })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const introTitle = useMemo(() => '팀을 위한 실시간 문서 워크스페이스', [])

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.background.default} 60%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1200,
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: theme.shadows[8],
          backgroundColor: theme.palette.background.paper,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 0.95fr' },
        }}
      >
        <Box
          sx={{
            px: { xs: 4, md: 6 },
            py: { xs: 4, md: 6 },
            backgroundColor: theme.palette.grey[50],
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <Typography variant='h3' component='h1'>
            {introTitle}
          </Typography>
          <Typography variant='body1' sx={{ color: theme.palette.text.secondary }}>
            문서 내보내기 · 공유 · 피드백을 한 곳에서 처리하고, AI/사람 모두가 자연스럽게 협업할 수 있도록 설계된 플랫폼입니다.
          </Typography>
          <Stack spacing={1}>
            {featureList.map((feature) => (
              <Typography key={feature} variant='body2' sx={{ display: 'flex', gap: 1 }}>
                <Typography component='span' color='primary.main' fontWeight={600}>
                  •
                </Typography>
                {feature}
              </Typography>
            ))}
          </Stack>
          <Divider />
          <Stack direction='row' spacing={1} flexWrap='wrap'>
            <Button
              variant={mode === 'login' ? 'contained' : 'text'}
              onClick={() => handleModeSwitch('login')}
            >
              로그인
            </Button>
            <Button
              variant={mode === 'signup' ? 'contained' : 'text'}
              onClick={() => handleModeSwitch('signup')}
            >
              가입하기
            </Button>
          </Stack>
        </Box>
        <Card
          variant='outlined'
          square
          sx={{
            borderLeft: { xs: 'none', md: `1px solid ${theme.palette.divider}` },
            borderRadius: 0,
            px: { xs: 4, md: 6 },
            py: { xs: 6, md: 8 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Typography variant='h5'>{mode === 'login' ? '계정으로 로그인' : '새로운 계정 만들기'}</Typography>
          <Typography variant='body2' color='text.secondary'>
            이메일과 비밀번호를 입력하면 바로 편집기를 사용할 수 있습니다.
          </Typography>
          {error && <Alert severity='error'>{error}</Alert>}
          <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label='이메일'
              type='email'
              value={form.email}
              onChange={handleChange('email')}
              required
              fullWidth
            />
            <TextField
              label='비밀번호'
              type='password'
              value={form.password}
              onChange={handleChange('password')}
              helperText='10~128자'
              required
              fullWidth
            />
            {mode === 'signup' && (
              <TextField
                label='이름 (선택)'
                value={form.legalName}
                onChange={handleChange('legalName')}
                fullWidth
              />
            )}
            <Button type='submit' variant='contained' size='large' disabled={submitting} fullWidth>
              {mode === 'login' ? '로그인' : '회원가입 후 로그인'}
            </Button>
          </Box>
        </Card>
      </Box>
    </Box>
  )
}

export default AuthLanding
