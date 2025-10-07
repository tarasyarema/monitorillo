import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { invitationsApi } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';

export const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const acceptInvitationMutation = useMutation({
    mutationFn: (token: string) => invitationsApi.accept(token),
    onSuccess: () => {
      setSuccess(true);
      setError('');
      // Redirect to teams page after 2 seconds
      setTimeout(() => {
        navigate('/teams');
      }, 2000);
    },
    onError: (err: any) => {
      setError(
        err.response?.data?.detail || 'Failed to accept invitation. The invitation may have expired or been revoked.'
      );
      setSuccess(false);
    },
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link. No token provided.');
    }
  }, [token]);

  const handleAccept = () => {
    if (token) {
      acceptInvitationMutation.mutate(token);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>You&apos;ve been invited to join a team</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>Invitation accepted successfully! Redirecting to teams page...</AlertDescription>
            </Alert>
          )}
          {!error && !success && token && (
            <>
              <p className="text-sm text-gray-600">
                Click the button below to accept the invitation and join the team.
              </p>
              <Button onClick={handleAccept} disabled={acceptInvitationMutation.isPending} className="w-full">
                {acceptInvitationMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </>
          )}
          {error && (
            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
