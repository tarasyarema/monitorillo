import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { alertsApi } from '../lib/api';
import { Alert as AlertType } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { safeFormatDistanceToNow } from '../lib/utils';

export const Alerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => alertsApi.list(filter),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: number) => alertsApi.acknowledge(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: number) => alertsApi.resolve(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
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
          <Card key={alert.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityBadge(alert.severity)}
                    {getStateBadge(alert.state)}
                    {alert.server && (
                      <Link to={`/servers/${alert.server_id}`}>
                        <Badge variant="secondary">{alert.server.name}</Badge>
                      </Link>
                    )}
                  </div>

                  <p className="text-lg font-medium mb-1">{alert.message}</p>

                  <div className="text-sm text-gray-600 space-y-1">
                    {alert.value != null && alert.threshold != null && (
                      <div>
                        Value: <span className="font-medium">{alert.value.toFixed(1)}%</span> ( Threshold:{' '}
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

                <div className="flex gap-2">
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
    </div>
  );
};
