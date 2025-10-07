import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { servicesApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Service } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { safeToLocaleDateString } from '../lib/utils';

export const Services: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTeam } = useAppStore();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [versionUrl, setVersionUrl] = useState('');
  const [versionJsonPath, setVersionJsonPath] = useState('');
  const [error, setError] = useState('');

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', currentTeam?.id],
    queryFn: () => servicesApi.list(currentTeam!.id),
    enabled: !!currentTeam,
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; version_url?: string; version_json_path?: string }) =>
      servicesApi.create(currentTeam!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', currentTeam?.id] });
      setName('');
      setDescription('');
      setVersionUrl('');
      setVersionJsonPath('');
      setError('');
      setShowCreateForm(false);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create service');
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: number) => servicesApi.delete(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', currentTeam?.id] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to delete service');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Service name is required');
      return;
    }
    createServiceMutation.mutate({
      name,
      description: description || undefined,
      version_url: versionUrl || undefined,
      version_json_path: versionJsonPath || undefined,
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'destructive';
      default:
        return 'default';
    }
  };

  if (!currentTeam) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-600">Please select a team to view services.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Services</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>{showCreateForm ? 'Cancel' : 'Add Service'}</Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Service</CardTitle>
            <CardDescription>Create a service to monitor its health and track deployments</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Name *</label>
                <Input placeholder="e.g., API Server" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Input
                  placeholder="e.g., Main production API"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Version URL (optional)</label>
                <Input
                  placeholder="e.g., https://api.example.com/version"
                  value={versionUrl}
                  onChange={(e) => setVersionUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Version JSON Path (optional)</label>
                <Input
                  placeholder="e.g., version or data.version"
                  value={versionJsonPath}
                  onChange={(e) => setVersionJsonPath(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={createServiceMutation.isPending}>
                {createServiceMutation.isPending ? 'Creating...' : 'Create Service'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services?.map((service: Service) => (
          <Card key={service.id} className="cursor-pointer hover:shadow-md transition-all">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1" onClick={() => navigate(`/services/${service.id}`)}>
                  <CardTitle className="text-xl">{service.name}</CardTitle>
                  {service.description && <CardDescription className="mt-1">{service.description}</CardDescription>}
                </div>
                <Badge variant={getStatusBadgeVariant(service.status)}>{service.status}</Badge>
              </div>
            </CardHeader>
            <CardContent onClick={() => navigate(`/services/${service.id}`)}>
              {service.current_version && (
                <div className="text-sm mb-2">
                  <span className="text-gray-600">Version:</span>{' '}
                  <span className="font-mono">{service.current_version}</span>
                </div>
              )}
              {service.last_version_check && (
                <div className="text-xs text-gray-500">
                  Last checked: {safeToLocaleDateString(service.last_version_check)}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-2">Created {safeToLocaleDateString(service.created_at)}</div>
              <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/services/${service.id}`)}
                  className="flex-1"
                >
                  Manage
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this service?')) {
                      deleteServiceMutation.mutate(service.id);
                    }
                  }}
                  disabled={deleteServiceMutation.isPending}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services && services.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No services yet. Add your first service to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
