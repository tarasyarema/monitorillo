import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationsApi } from '../lib/api';
import { Invitation } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { safeToLocaleDateString } from '../lib/utils';

interface TeamInvitationsProps {
  teamId: number;
  canManageInvitations: boolean;
}

export const TeamInvitations: React.FC<TeamInvitationsProps> = ({ teamId, canManageInvitations }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('member');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: invitations, isLoading } = useQuery({
    queryKey: ['invitations', teamId],
    queryFn: () => invitationsApi.list(teamId),
    enabled: canManageInvitations,
  });

  const createInvitationMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      invitationsApi.create(teamId, data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
      setEmail('');
      setRole('member');
      setError('');
      setSuccess('Invitation sent successfully!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to send invitation');
      setSuccess('');
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: number) => invitationsApi.revoke(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', teamId] });
      setSuccess('Invitation revoked successfully!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to revoke invitation');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    createInvitationMutation.mutate({ email, role });
  };

  if (!canManageInvitations) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-600">You don't have permission to manage invitations.</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'revoked':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Members</CardTitle>
          <CardDescription>Send email invitations to add members to your team</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="viewer">Viewer</option>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button type="submit" disabled={createInvitationMutation.isPending}>
                {createInvitationMutation.isPending ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-600">Loading invitations...</div>
        </div>
      ) : invitations && invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Manage outstanding team invitations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invitations.map((invitation: Invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600">
                      Role: {invitation.role} • Sent {safeToLocaleDateString(invitation.created_at)}
                    </div>
                    {invitation.status === 'pending' && (
                      <div className="text-xs text-gray-500">
                        Expires {safeToLocaleDateString(invitation.expires_at)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(invitation.status)}>
                      {invitation.status}
                    </Badge>
                    {invitation.status === 'pending' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                        disabled={revokeInvitationMutation.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No pending invitations</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
