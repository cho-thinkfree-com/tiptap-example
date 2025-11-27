import { IconButton, Tooltip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useState } from 'react';
import AuthorInfoPopover from './AuthorInfoPopover';

interface AuthorInfoButtonProps {
    token: string;
    authorName?: string;
}

const AuthorInfoButton = ({ token, authorName }: AuthorInfoButtonProps) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    return (
        <>
            <Tooltip title={authorName ? `작성자: ${authorName}` : '작성자 정보'}>
                <IconButton
                    onClick={handleClick}
                    sx={{
                        width: 32,
                        height: 32,
                        ml: 1,
                    }}
                    aria-label="작성자 정보"
                >
                    <PersonIcon />
                </IconButton>
            </Tooltip>
            <AuthorInfoPopover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                token={token}
                authorName={authorName}
            />
        </>
    );
};

export default AuthorInfoButton;
