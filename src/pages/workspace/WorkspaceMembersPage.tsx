import { Alert, Box, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemText, MenuItem, Select, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import { getWorkspaceMembers, inviteWorkspaceMember, changeWorkspaceMemberRole, removeWorkspaceMember, type MembershipSummary } from '../../lib/api';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import DeleteIcon from '@mui/icons-material/Delete';

const WorkspaceMembersPage = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const [members, setMembers] = useState<MembershipSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchMembers = async () => {
    if (isAuthenticated && workspaceId) {
      setLoading(true);
      try {
        const response = await getWorkspaceMembers(workspaceId);
        setMembers(response.items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [isAuthenticated, workspaceId]);

  const handleInviteMember = async () => {
    if (!isAuthenticated || !workspaceId || !inviteEmail) {
      return;
    }
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteWorkspaceMember(workspaceId, { accountId: inviteEmail }); // Assuming inviteEmail is accountId for now
      setInviteDialogOpen(false);
      setInviteEmail('');
      fetchMembers();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member') => {
    if (!isAuthenticated || !workspaceId) {
      return;
    }
    try {
      await changeWorkspaceMemberRole(workspaceId, memberId, newRole);
      fetchMembers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAuthenticated || !workspaceId) {
      return;
    }
    try {
      await removeWorkspaceMember(workspaceId, memberId);
      fetchMembers();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Workspace Members
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setComingSoonOpen(true)}
        >
          Invite Member
        </Button>
      </Box>

      <List>
        {members.map((member) => (
          <ListItem
            key={member.id}
            secondaryAction={
              <>
                <Select
                  value={member.role}
                  onChange={(e) => handleChangeRole(member.accountId, e.target.value as 'owner' | 'admin' | 'member')}
                  disabled={member.accountId === user?.id} // Disable role change for self
                >
                  <MenuItem value="owner">Owner</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                </Select>
                <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveMember(member.accountId)}>
                  <DeleteIcon />
                </IconButton>
              </>
            }
          >
            <ListItemText primary={member.displayName || member.accountId} secondary={`Role: ${member.role}`} />
          </ListItem>
        ))}
      </List>

      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
        <DialogTitle>Invite New Member</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Member Email or Account ID"
            type="email"
            fullWidth
            variant="standard"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            disabled={inviteLoading}
          />
          {inviteError && <Alert severity="error" sx={{ mt: 2 }}>{inviteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)} disabled={inviteLoading}>Cancel</Button>
          <Button onClick={handleInviteMember} disabled={inviteLoading}>
            {inviteLoading ? 'Inviting...' : 'Invite'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Coming Soon Dialog */}
      <Dialog
        open={comingSoonOpen}
        onClose={() => setComingSoonOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Coming Soon</DialogTitle>
        <DialogContent>
          <Typography>
            멤버 초대 기능은 곧 제공될 예정입니다.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The member invitation feature will be available soon.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComingSoonOpen(false)} variant="contained">
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default WorkspaceMembersPage;
