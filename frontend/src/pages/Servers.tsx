import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serversApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Server } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export const Servers: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentTeam } = useAppStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerHostname, setNewServerHostname] = useState('');
  const [error, setError] = useState('');

  const { data: servers, isLoading } = useQuery({
    queryKey: ['servers', currentTeam?.id],
    queryFn: () => currentTeam ? serversApi.list(currentTeam.id) : Promise.resolve([]),
    enabled: !!currentTeam,
  });

  const createServerMutation = useMutation({
    mutationFn: ({ name, hostname }: { name: string; hostname: string }) =>
      serversApi.create(currentTeam!.id, name, hostname),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', currentTeam?.id] });
      setNewServerName('');
      setNewServerHostname('');
      setShowCreateForm(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create server');
    },
  });

  const deleteServerMutation = useMutation({
    mutationFn: (serverId: number) => serversApi.delete(serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', currentTeam?.id] });
    },
  });

  const handleCreateServer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerHostname.trim()) {
      setError('Server name and hostname are required');
      return;
    }
    createServerMutation.mutate({ name: newServerName, hostname: newServerHostname });
  };

  if (!currentTeam) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">No Team Selected</h2>
        <p className="text-gray-600 mb-4">Please select or create a team first</p>
        <Link to="/teams">
          <Button>Go to Teams</Button>
        </Link>
      </div>
    );
  }

  const getStatusBadge = (server: Server) => {
    const statusMap = {
      online: { variant: 'success' as const, text: 'Online' },
      offline: { variant: 'secondary' as const, text: 'Offline' },
      warning: { variant: 'warning' as const, text: 'Warning' },
      critical: { variant: 'destructive' as const, text: 'Critical' },
    };
    const status = statusMap[server.status] || statusMap.offline;
    return <Badge variant={status.variant}>{status.text}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading servers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Servers</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : 'Add Server'}
        </Button>
      </div>

      {/* Create Server Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Server</CardTitle>
            <CardDescription>Register a new server to start monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateServer} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Input
                label="Server Name"
                placeholder="Production Server 1"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
              <Input
                label="Hostname"
                placeholder="server1.example.com"
                value={newServerHostname}
                onChange={(e) => setNewServerHostname(e.target.value)}
              />
              <Button type="submit" disabled={createServerMutation.isPending}>
                {createServerMutation.isPending ? 'Creating...' : 'Create Server'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Server List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {servers?.map((server: Server) => (
          <Card key={server.id} className="hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-xl">{server.name}</CardTitle>
                  <CardDescription className="mt-1">{server.hostname}</CardDescription>
                </div>
                {getStatusBadge(server)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-gray-600">
                {server.last_seen_at ? (
                  <span>
                    Last seen {formatDistanceToNow(new Date(server.last_seen_at), { addSuffix: true })}
                  </span>
                ) : (
                  <span className="text-gray-400">Never seen</span>
                )}
              </div>

              <div className="flex gap-2">
                <Link to={`/servers/${server.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this server?')) {
                      deleteServerMutation.mutate(server.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {servers && servers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No servers yet. Add your first server to start monitoring!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
