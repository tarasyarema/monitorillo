import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi, metricsApi, alertsApi } from '../lib/api';
import { SystemMetrics, DockerMetrics } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const ServerDetail: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [timeRange, setTimeRange] = useState(24);

  const { data: server } = useQuery({
    queryKey: ['server', serverId],
    queryFn: () => serversApi.get(Number(serverId)),
  });

  const { data: latestMetrics } = useQuery({
    queryKey: ['metrics', serverId, 'latest'],
    queryFn: () => metricsApi.getLatest(Number(serverId)),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: metricsHistory } = useQuery({
    queryKey: ['metrics', serverId, 'history', timeRange],
    queryFn: () => metricsApi.getHistory(Number(serverId), timeRange),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: alertConfigs } = useQuery({
    queryKey: ['alert-configs', serverId],
    queryFn: () => alertsApi.getConfigs(Number(serverId)),
  });

  const regenerateApiKeyMutation = useMutation({
    mutationFn: () => serversApi.regenerateApiKey(Number(serverId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['server', serverId] });
      setShowApiKey(true);
    },
  });

  if (!server) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading server details...</div>
      </div>
    );
  }

  const systemMetrics = latestMetrics?.system as SystemMetrics | undefined;
  const dockerMetrics = latestMetrics?.docker as DockerMetrics | undefined;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const prepareChartData = () => {
    if (!metricsHistory?.system) return [];

    return metricsHistory.system
      .map((m: any) => {
        const partitions = Object.values(m.value.disk?.partitions || {}) as any[];
        return {
          timestamp: new Date(m.timestamp).toLocaleTimeString(),
          cpu: m.value.cpu?.usage_percent || 0,
          memory: m.value.memory?.used_percent || 0,
          disk: partitions[0]?.used_percent || 0,
        };
      });
  };

  const chartData = prepareChartData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{server.name}</h1>
            <Badge variant={server.status === 'online' ? 'success' : 'secondary'}>
              {server.status}
            </Badge>
          </div>
          <p className="text-gray-600">{server.hostname}</p>
        </div>
        <Link to="/servers">
          <Button variant="outline">Back to Servers</Button>
        </Link>
      </div>

      {/* API Key Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>Use this API key to configure the monitoring daemon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <code className="flex-1 p-3 bg-gray-100 rounded font-mono text-sm break-all">
              {showApiKey ? server.api_key : '••••••••••••••••••••••••••••••••'}
            </code>
            <Button variant="outline" onClick={() => setShowApiKey(!showApiKey)}>
              {showApiKey ? 'Hide' : 'Show'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(server.api_key);
              }}
            >
              Copy
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('Are you sure? This will invalidate the current API key.')) {
                regenerateApiKeyMutation.mutate();
              }
            }}
          >
            Regenerate API Key
          </Button>
        </CardContent>
      </Card>

      {/* Latest Metrics */}
      {systemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">CPU Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{systemMetrics.cpu?.usage_percent?.toFixed(1) || 0}%</div>
              <p className="text-xs text-gray-500 mt-1">
                Load: {systemMetrics.cpu?.load_avg_1?.toFixed(2) || 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{systemMetrics.memory?.used_percent?.toFixed(1) || 0}%</div>
              <p className="text-xs text-gray-500 mt-1">
                {formatBytes(systemMetrics.memory?.used || 0)} / {formatBytes(systemMetrics.memory?.total || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Disk Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {systemMetrics.disk?.partitions && Object.entries(systemMetrics.disk.partitions).slice(0, 1).map(([path, info]: [string, any]) => (
                <div key={path}>
                  <div className="text-3xl font-bold">{info?.used_percent?.toFixed(1) || 0}%</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatBytes(info?.used || 0)} / {formatBytes(info?.total || 0)}
                  </p>
                </div>
              ))}
              {!systemMetrics.disk?.partitions && <div className="text-3xl font-bold">0%</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">Network</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Sent:</span>
                  <span className="font-medium">{formatBytes(systemMetrics.network?.bytes_sent || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Received:</span>
                  <span className="font-medium">{formatBytes(systemMetrics.network?.bytes_recv || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Metrics Charts */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Metrics History</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={timeRange === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(1)}
                >
                  1h
                </Button>
                <Button
                  variant={timeRange === 6 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(6)}
                >
                  6h
                </Button>
                <Button
                  variant={timeRange === 24 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(24)}
                >
                  24h
                </Button>
                <Button
                  variant={timeRange === 168 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(168)}
                >
                  7d
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart animationDuration={300} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="CPU %" />
                <Area type="monotone" dataKey="memory" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} name="Memory %" />
                <Area type="monotone" dataKey="disk" stackId="3" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Disk %" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Docker Containers */}
      {dockerMetrics && dockerMetrics.containers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Docker Containers</CardTitle>
            <CardDescription>{dockerMetrics.containers.length} containers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dockerMetrics.containers.map((container) => (
                <Link
                  key={container.id}
                  to={`/docker-overview?container=${encodeURIComponent(`${server.name}_${container.name}`)}`}
                  className="block border rounded-lg p-4 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium">{container.name}</h4>
                      <p className="text-sm text-gray-600">{container.image}</p>
                    </div>
                    <Badge variant={container.state === 'running' ? 'success' : 'secondary'}>
                      {container.state}
                    </Badge>
                  </div>
                  {container.state === 'running' && (
                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      <div>
                        <span className="text-gray-600">CPU:</span>{' '}
                        <span className="font-medium">{container.cpu_percent?.toFixed(1)}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Memory:</span>{' '}
                        <span className="font-medium">
                          {container.memory_usage && formatBytes(container.memory_usage)}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alert Configurations */}
      {alertConfigs && (
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>Current alert configuration for this server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alertConfigs.map((config: any) => (
                <div key={config.id} className="flex justify-between items-center border rounded p-3">
                  <div>
                    <h4 className="font-medium capitalize">{config.metric_type}</h4>
                    <p className="text-sm text-gray-600">
                      Warning: {config.warning_threshold}% | Critical: {config.critical_threshold}%
                    </p>
                  </div>
                  <Badge variant={config.enabled ? 'success' : 'secondary'}>
                    {config.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!systemMetrics && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">
              No metrics received yet. Install and configure the monitoring daemon on this server.
            </p>
            <Link
              to="https://github.com/monitorillo/daemon"
              className="text-primary hover:underline mt-2 inline-block"
            >
              View installation instructions
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
