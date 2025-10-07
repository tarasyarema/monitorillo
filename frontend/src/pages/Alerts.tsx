import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { alertsApi, serversApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Alert as AlertType } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { safeFormatDistanceToNow } from '../lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Alerts: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentTeam } = useAppStore();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [editingConfig, setEditingConfig] = useState<any>(null);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => alertsApi.list(filter),
    refetchInterval: 30000,
  });

  const { data: alertDetail } = useQuery({
    queryKey: ['alert-detail', selectedAlertId],
    queryFn: () => (selectedAlertId ? alertsApi.get(selectedAlertId) : Promise.resolve(null)),
    enabled: !!selectedAlertId,
  });

  const { data: alertConfigs } = useQuery({
    queryKey: ['alert-configs'],
    queryFn: () => alertsApi.getConfigs(),
    enabled: !!currentTeam,
  });

  const { data: servers } = useQuery({
    queryKey: ['servers', currentTeam?.id],
    queryFn: () => (currentTeam ? serversApi.list(currentTeam.id) : Promise.resolve([])),
    enabled: !!currentTeam,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: number) => alertsApi.acknowledge(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-detail'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: number) => alertsApi.resolve(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['alert-detail'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: {
      configId: number;
      warning_threshold?: number;
      critical_threshold?: number;
      enabled?: boolean;
    }) => alertsApi.updateConfig(data.configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
      setEditingConfig(null);
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: (data: {
      team_id: number;
      metric_type: string;
      warning_threshold: number;
      critical_threshold: number;
      server_id?: number;
    }) => alertsApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
    },
  });

  const getSeverityBadge = (severity: 'warning' | 'critical') => {
    return severity === 'critical' ? (
      <Badge variant="destructive">Critical</Badge>
    ) : (
      <Badge variant="warning">Warning</Badge>
    );
  };

  const getStateBadge = (state: string) => {
    const stateMap: Record<string, { variant: any; text: string }> = {
      new: { variant: 'destructive', text: 'New' },
      acknowledged: { variant: 'warning', text: 'Acknowledged' },
      resolved: { variant: 'success', text: 'Resolved' },
    };
    const stateInfo = stateMap[state] || stateMap.new;
    return <Badge variant={stateInfo.variant}>{stateInfo.text}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading alerts...</div>
      </div>
    );
  }

  const newAlerts = alerts?.filter((a: AlertType) => a.state === 'new') || [];
  const acknowledgedAlerts = alerts?.filter((a: AlertType) => a.state === 'acknowledged') || [];
  const resolvedAlerts = alerts?.filter((a: AlertType) => a.state === 'resolved') || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Alerts</h1>
        <div className="flex gap-2">
          <Button onClick={() => setConfigDialogOpen(true)}>Configure Alerts</Button>
          <Button variant={filter === undefined ? 'default' : 'outline'} size="sm" onClick={() => setFilter(undefined)}>
            All ({alerts?.length || 0})
          </Button>
          <Button variant={filter === 'new' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('new')}>
            New ({newAlerts.length})
          </Button>
          <Button
            variant={filter === 'acknowledged' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('acknowledged')}
          >
            Acknowledged ({acknowledgedAlerts.length})
          </Button>
          <Button
            variant={filter === 'resolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('resolved')}
          >
            Resolved ({resolvedAlerts.length})
          </Button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">New Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{newAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{acknowledgedAlerts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Resolved (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{resolvedAlerts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {alerts?.map((alert: AlertType) => (
          <Card key={alert.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6" onClick={() => setSelectedAlertId(alert.id)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityBadge(alert.severity)}
                    {getStateBadge(alert.state)}
                    {alert.server && (
                      <Link to={`/servers/${alert.server_id}`} onClick={(e) => e.stopPropagation()}>
                        <Badge variant="secondary">{alert.server.name}</Badge>
                      </Link>
                    )}
                  </div>

                  <p className="text-lg font-medium mb-1">{alert.message}</p>

                  <div className="text-sm text-gray-600 space-y-1">
                    {alert.value != null && alert.threshold != null && (
                      <div>
                        Value: <span className="font-medium">{alert.value.toFixed(1)}%</span> (Threshold:{' '}
                        {alert.threshold.toFixed(1)}%)
                      </div>
                    )}
                    <div>
                      Triggered {safeFormatDistanceToNow(alert.triggered_at, { addSuffix: true }) || 'recently'}
                    </div>
                    {alert.acknowledged_at && (
                      <div className="text-green-600">
                        Acknowledged {safeFormatDistanceToNow(alert.acknowledged_at, { addSuffix: true }) || 'recently'}
                      </div>
                    )}
                    {alert.resolved_at && (
                      <div className="text-green-600">
                        Resolved {safeFormatDistanceToNow(alert.resolved_at, { addSuffix: true }) || 'recently'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {alert.state === 'new' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                    >
                      Acknowledge
                    </Button>
                  )}
                  {(alert.state === 'new' || alert.state === 'acknowledged') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveMutation.mutate(alert.id)}
                      disabled={resolveMutation.isPending}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts && alerts.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">
              {filter ? `No ${filter} alerts.` : 'No alerts. Your infrastructure is running smoothly!'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Alert Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => {
          setConfigDialogOpen(false);
          setEditingConfig(null);
        }}
        title="Alert Configuration"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Configure alert thresholds for your servers</p>

          {servers?.map((server: any) => {
            const serverConfigs = alertConfigs?.filter((c: any) => c.server_id === server.id) || [];

            return (
              <Card key={server.id}>
                <CardHeader>
                  <CardTitle className="text-base">{server.name}</CardTitle>
                  <CardDescription>{server.hostname}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['cpu', 'memory', 'disk'].map((metricType) => {
                      const config = serverConfigs.find((c: any) => c.metric_type === metricType);

                      return (
                        <div key={metricType} className="flex items-center gap-3 border-b pb-3">
                          <div className="flex-1">
                            <h4 className="font-medium capitalize">{metricType}</h4>
                            {config ? (
                              <div className="text-sm text-gray-600 mt-1">
                                Warning: {config.warning_threshold}% | Critical: {config.critical_threshold}%
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 mt-1">Not configured</div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {config ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateConfigMutation.mutate({
                                      configId: config.id,
                                      enabled: !config.enabled,
                                    })
                                  }
                                >
                                  {config.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setEditingConfig(config)}>
                                  Edit
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  createConfigMutation.mutate({
                                    team_id: currentTeam!.id,
                                    server_id: server.id,
                                    metric_type: metricType,
                                    warning_threshold: 80,
                                    critical_threshold: 90,
                                  })
                                }
                                disabled={createConfigMutation.isPending}
                              >
                                Configure
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Dialog>

      {/* Edit Config Dialog */}
      {editingConfig && (
        <Dialog
          open={!!editingConfig}
          onClose={() => setEditingConfig(null)}
          title={`Edit ${editingConfig.metric_type.toUpperCase()} Alert Threshold`}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingConfig(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateConfigMutation.mutate({
                    configId: editingConfig.id,
                    warning_threshold: editingConfig.warning_threshold,
                    critical_threshold: editingConfig.critical_threshold,
                  });
                }}
                disabled={updateConfigMutation.isPending}
              >
                Save
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Warning Threshold (%)</label>
              <Input
                type="number"
                value={editingConfig.warning_threshold}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    warning_threshold: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Critical Threshold (%)</label>
              <Input
                type="number"
                value={editingConfig.critical_threshold}
                onChange={(e) =>
                  setEditingConfig({
                    ...editingConfig,
                    critical_threshold: parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </Dialog>
      )}

      {/* Alert Detail Dialog */}
      {alertDetail && (
        <Dialog
          open={!!selectedAlertId}
          onClose={() => setSelectedAlertId(null)}
          title="Alert Details"
          footer={
            <div className="flex justify-end gap-2">
              {alertDetail.state === 'new' && (
                <Button
                  onClick={() => {
                    acknowledgeMutation.mutate(alertDetail.id);
                    setSelectedAlertId(null);
                  }}
                  disabled={acknowledgeMutation.isPending}
                >
                  Acknowledge
                </Button>
              )}
              {(alertDetail.state === 'new' || alertDetail.state === 'acknowledged') && (
                <Button
                  onClick={() => {
                    resolveMutation.mutate(alertDetail.id);
                    setSelectedAlertId(null);
                  }}
                  disabled={resolveMutation.isPending}
                >
                  Resolve
                </Button>
              )}
              <Button variant="outline" onClick={() => setSelectedAlertId(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Alert Information */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                {getSeverityBadge(alertDetail.severity)}
                {getStateBadge(alertDetail.state)}
                {alertDetail.server && (
                  <Link to={`/servers/${alertDetail.server_id}`}>
                    <Badge variant="secondary">{alertDetail.server.name}</Badge>
                  </Link>
                )}
              </div>
              <h3 className="text-xl font-semibold mb-2">{alertDetail.message}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Current Value:</span>{' '}
                  <span className="font-medium">{alertDetail.current_value?.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Threshold:</span>{' '}
                  <span className="font-medium">{alertDetail.threshold_value?.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-gray-600">First Triggered:</span>{' '}
                  <span className="font-medium">
                    {safeFormatDistanceToNow(alertDetail.first_triggered_at, { addSuffix: true }) || 'recently'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Last Triggered:</span>{' '}
                  <span className="font-medium">
                    {safeFormatDistanceToNow(alertDetail.last_triggered_at, { addSuffix: true }) || 'recently'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Metrics Chart */}
            {alertDetail.recent_metrics && alertDetail.recent_metrics.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Recent Metrics</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={alertDetail.recent_metrics.reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any) => `${value.toFixed(1)}%`}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      dataKey={() => alertDetail.threshold_value}
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Threshold"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Related Alerts */}
            {alertDetail.related_alerts && alertDetail.related_alerts.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Related Alerts</h4>
                <div className="space-y-2">
                  {alertDetail.related_alerts.map((related: any) => (
                    <div
                      key={related.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedAlertId(related.id)}
                    >
                      <div className="flex items-center gap-2">
                        {getSeverityBadge(related.severity)}
                        <span className="text-sm">{related.message}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {safeFormatDistanceToNow(related.triggered_at, { addSuffix: true }) || 'recently'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Server Information */}
            {alertDetail.server && (
              <div>
                <h4 className="font-semibold mb-3">Server Information</h4>
                <div className="border rounded p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>{' '}
                      <span className="font-medium">{alertDetail.server.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Hostname:</span>{' '}
                      <span className="font-medium">{alertDetail.server.hostname}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>{' '}
                      <Badge
                        variant={
                          alertDetail.server.status === 'online'
                            ? 'success'
                            : alertDetail.server.status === 'critical'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {alertDetail.server.status}
                      </Badge>
                    </div>
                    <div>
                      <Link to={`/servers/${alertDetail.server.id}`}>
                        <Button variant="outline" size="sm">
                          View Server
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
