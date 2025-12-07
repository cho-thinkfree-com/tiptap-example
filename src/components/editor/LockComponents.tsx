import React from 'react';
import { Box, Typography, Button, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import TimerIcon from '@mui/icons-material/Timer';

interface LockBannerProps {
    holderName: string;
    mode: 'standard' | 'collab';
    onSteal?: () => void;
    onJoinCollab?: () => void;
    currentMode: 'standard' | 'collab';
}

export const LockBanner: React.FC<LockBannerProps> = ({
    holderName,
    mode,
    onSteal,
    onJoinCollab,
    currentMode
}) => {
    return (
        <Box
            sx={{
                width: '100%',
                bgcolor: '#fff4e5', // Warning orange light
                color: '#663c00',
                p: '10px 24px',
                borderBottom: '1px solid #ffcca0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                fontSize: '0.95rem',
                fontWeight: 500,
                zIndex: 10
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon fontSize="small" sx={{ color: '#ed6c02' }} />
                <span>
                    {mode === 'standard'
                        ? `현재 ${holderName}님이 편집 중입니다. (보기 전용)`
                        : `현재 공동 편집 모드가 활성화되어 있습니다. (보기 전용)`
                    }
                </span>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
                {mode === 'standard' && currentMode === 'standard' && (
                    <button
                        onClick={onSteal}
                        style={{
                            padding: '4px 10px',
                            backgroundColor: 'white',
                            color: '#ed6c02',
                            border: '1px solid #ed6c02',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <TimerIcon style={{ fontSize: '1rem' }} />
                        편집 권한 요청 (30초)
                    </button>
                )}
                {mode === 'collab' && currentMode === 'standard' && (
                    <button
                        onClick={onJoinCollab}
                        style={{
                            padding: '4px 10px',
                            backgroundColor: '#ed6c02',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}
                    >
                        공동 편집 참여하기
                    </button>
                )}
                {mode === 'standard' && currentMode === 'collab' && (
                    <button
                        onClick={onSteal}
                        style={{
                            padding: '4px 10px',
                            backgroundColor: 'white',
                            color: '#ed6c02',
                            border: '1px solid #ed6c02',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}
                    >
                        일반 모드로 전환하여 요청
                    </button>
                )}
            </Box>
        </Box>
    );
};

interface StealDialogProps {
    open: boolean;
    stealState: 'none' | 'stealing' | 'cleanup' | 'rejected' | 'queued';
    countdown: number | null;
    queuePosition?: number | null;
    holderName: string;
    errorMessage?: string | null;
    onCancel: () => void;
}

export const StealDialog: React.FC<StealDialogProps> = ({
    open,
    stealState,
    countdown,
    queuePosition,
    holderName,
    errorMessage,
    onCancel
}) => {
    const getTitle = () => {
        if (stealState === 'rejected') return '권한 획득 실패';
        if (stealState === 'queued') return '편집 권한 대기 중';
        return '편집 권한 요청 중';
    };

    return (
        <Dialog open={open} maxWidth="sm" fullWidth>
            <DialogTitle>
                {getTitle()}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ py: 2 }}>
                    {stealState === 'stealing' && (
                        <>
                            <Typography variant="body1" gutterBottom>
                                <strong>{holderName}</strong>님에게 편집 권한 양도를 요청했습니다.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                상대방이 응답하지 않으면 <strong>{countdown}초</strong> 후 자동으로 권한을 가져옵니다.
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={countdown ? (countdown / 30) * 100 : 0}
                                sx={{ mt: 2, height: 8, borderRadius: 4 }}
                                color="warning"
                            />
                        </>
                    )}
                    {stealState === 'queued' && (
                        <>
                            <Typography variant="body1" gutterBottom>
                                현재 다른 사용자가 편집 권한을 요청 중입니다.
                            </Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                대기열 <strong>{queuePosition !== null && queuePosition !== undefined ? queuePosition : '?'}번</strong> 대기 중입니다.
                                <br />
                                앞선 요청이 완료되면 자동으로 권한 요청이 시작됩니다.
                            </Typography>
                            <LinearProgress color="secondary" sx={{ mt: 2 }} />
                        </>
                    )}
                    {stealState === 'cleanup' && (
                        <>
                            <Alert severity="info" sx={{ mb: 2 }}>
                                상대방의 편집 세션을 안전하게 종료하고 저장 중입니다. 잠시만 기다려주세요.
                            </Alert>
                            <Typography variant="body2" color="text.secondary" align="center">
                                남은 시간: {countdown}초
                            </Typography>
                            <LinearProgress color="success" sx={{ mt: 2 }} />
                        </>
                    )}
                    {stealState === 'rejected' && (
                        <Alert severity="error">
                            {errorMessage || '현재 편집자가 권한 요청을 거절했습니다.'}
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            {stealState !== 'cleanup' && (
                <DialogActions>
                    <Button onClick={onCancel} color="inherit">
                        {stealState === 'rejected' ? '확인' : '취소'}
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
};
