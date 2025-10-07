import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../lib/store';
import { notificationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentTeam } = useAppStore();

  const [slackWebhook, setSlackWebhook] = useState('');
  const [emailAddresses, setEmailAddresses] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: channels } = useQuery({
    queryKey: ['notification-channels', currentTeam?.id],
    queryFn: async () => {
      if (!currentTeam) return [];
      return notificationsApi.listChannels(currentTeam.id);
    },
    enabled: !!currentTeam,
  });

  const createChannelMutation = useMutation({
    mutationFn: async (data: { type: string; name: string; slack_webhook_url?: string; email_addresses?: string }) => {
      return notificationsApi.createChannel({
        team_id: currentTeam!.id,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setSlackWebhook('');
      setEmailAddresses('');
      setSuccess('Notification channel created successfully');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create notification channel');
      setSuccess('');
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      slack_webhook_url?: string;
      email_addresses?: string;
      enabled?: boolean;
    }) => {
      const { id, ...updateData } = data;
      return notificationsApi.updateChannel(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setSuccess('Notification channel updated successfully');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update notification channel');
      setSuccess('');
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: number) => {
      await notificationsApi.deleteChannel(channelId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setSuccess('Notification channel deleted successfully');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to delete notification channel');
      setSuccess('');
    },
  });

  if (!currentTeam) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please select a team to configure notifications</p>
      </div>
    );
  }

  const slackChannel = channels?.find((c: any) => c.type === 'slack');
  const emailChannel = channels?.find((c: any) => c.type === 'email');

  const handleCreateSlack = () => {
    if (!slackWebhook.trim()) {
      setError('Please enter a Slack webhook URL');
      return;
    }
    createChannelMutation.mutate({
      type: 'slack',
      name: 'Slack Notifications',
      slack_webhook_url: slackWebhook,
    });
  };

  const handleCreateEmail = () => {
    if (!emailAddresses.trim()) {
      setError('Please enter at least one email address');
      return;
    }
    createChannelMutation.mutate({
      type: 'email',
      name: 'Email Notifications',
      email_addresses: emailAddresses,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Team Settings</h1>
        <p className="text-gray-600 mt-2">Configure notification channels for {currentTeam.name}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* Slack Configuration */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Slack Notifications</CardTitle>
              <CardDescription>Receive alerts via Slack webhook. Only one Slack channel per team.</CardDescription>
            </div>
            {slackChannel && (
              <Badge variant={slackChannel.enabled ? 'success' : 'secondary'}>
                {slackChannel.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {slackChannel ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <Input
                  type="text"
                  value={slackChannel.slack_webhook_url || ''}
                  onChange={(e) => {
                    updateChannelMutation.mutate({
                      id: slackChannel.id,
                      slack_webhook_url: e.target.value,
                    });
                  }}
                  placeholder="https://hooks.slack.com/services/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook in Slack: Settings & administration → Manage apps → Incoming Webhooks
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    updateChannelMutation.mutate({
                      id: slackChannel.id,
                      enabled: !slackChannel.enabled,
                    })
                  }
                  disabled={updateChannelMutation.isPending}
                >
                  {slackChannel.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this Slack configuration?')) {
                      deleteChannelMutation.mutate(slackChannel.id);
                    }
                  }}
                  disabled={deleteChannelMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <Input
                  type="text"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook in Slack: Settings & administration → Manage apps → Incoming Webhooks
                </p>
              </div>
              <Button onClick={handleCreateSlack} disabled={createChannelMutation.isPending}>
                Configure Slack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Receive alerts via email. Only one email configuration per team.</CardDescription>
            </div>
            {emailChannel && (
              <Badge variant={emailChannel.enabled ? 'success' : 'secondary'}>
                {emailChannel.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailChannel ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email Addresses</label>
                <Input
                  type="text"
                  value={emailChannel.email_addresses || ''}
                  onChange={(e) => {
                    updateChannelMutation.mutate({
                      id: emailChannel.id,
                      email_addresses: e.target.value,
                    });
                  }}
                  placeholder="email@example.com, another@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple email addresses with commas</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    updateChannelMutation.mutate({
                      id: emailChannel.id,
                      enabled: !emailChannel.enabled,
                    })
                  }
                  disabled={updateChannelMutation.isPending}
                >
                  {emailChannel.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this email configuration?')) {
                      deleteChannelMutation.mutate(emailChannel.id);
                    }
                  }}
                  disabled={deleteChannelMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email Addresses</label>
                <Input
                  type="text"
                  value={emailAddresses}
                  onChange={(e) => setEmailAddresses(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple email addresses with commas</p>
              </div>
              <Button onClick={handleCreateEmail} disabled={createChannelMutation.isPending}>
                Configure Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Notifications Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Server Alerts:</strong> When CPU, Memory, or Disk usage exceeds configured thresholds, alerts will
            be sent to enabled notification channels.
          </p>
          <p>
            <strong>Healthcheck Alerts:</strong> When a healthcheck fails and "Alerts On" is enabled for that
            healthcheck, notifications will be sent.
          </p>
          <p>
            <strong>Alert States:</strong> Alerts can be acknowledged or resolved from the Alerts page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
