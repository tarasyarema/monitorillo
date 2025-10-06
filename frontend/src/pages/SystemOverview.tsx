import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { serversApi, metricsApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const SystemOverview: React.FC = () => {
  const { currentTeam } = useAppStore();
  const [timeRange, setTimeRange] = useState(24);
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'disk'>('cpu');

  const { data: servers } = useQuery({
    queryKey: ['servers', currentTeam?.id],
    queryFn: () => (currentTeam ? serversApi.list(currentTeam.id) : Promise.resolve([])),
    enabled: !!currentTeam,
  });

  const serversMetrics = useQuery({
    queryKey: ['all-servers-metrics', servers?.map((s: any) => s.id), timeRange],
    queryFn: async () => {
      if (!servers || servers.length === 0) return [];

      const metricsPromises = servers.map((server: any) =>
        metricsApi.getHistory(server.id, timeRange).then((data) => ({
          serverId: server.id,
          serverName: server.name,
          metrics: data,
        }))
      );

      return Promise.all(metricsPromises);
    },
    enabled: !!servers && servers.length > 0,
    refetchInterval: 60000,
  });

  const prepareChartData = () => {
    if (!serversMetrics.data) return [];

    // Create a map of timestamps
    const timestampMap = new Map<string, any>();

    serversMetrics.data.forEach((serverData: any) => {
      if (!serverData.metrics?.system) return;

      serverData.metrics.system.forEach((metric: any) => {
        const timestamp = new Date(metric.timestamp).toLocaleTimeString();

        if (!timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, { timestamp });
        }

        const point = timestampMap.get(timestamp);
        const partitions = Object.values(metric.value.disk?.partitions || {}) as any[];

        point[`${serverData.serverName}_cpu`] = metric.value.cpu?.usage_percent || 0;
        point[`${serverData.serverName}_memory`] = metric.value.memory?.used_percent || 0;
        point[`${serverData.serverName}_disk`] = partitions[0]?.used_percent || 0;
      });
    });

    return Array.from(timestampMap.values());
  };

  const chartData = prepareChartData();

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (!currentTeam) {
    return <div className="text-center py-12">Please select a team first</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Overview</h1>
        <div className="flex gap-2">
          <Button
            variant={selectedMetric === 'cpu' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMetric('cpu')}
          >
            CPU
          </Button>
          <Button
            variant={selectedMetric === 'memory' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMetric('memory')}
          >
            Memory
          </Button>
          <Button
            variant={selectedMetric === 'disk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedMetric('disk')}
          >
            Disk
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>All Servers - {selectedMetric.toUpperCase()} Usage</CardTitle>
            <div className="flex gap-2">
              <Button variant={timeRange === 1 ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange(1)}>
                1h
              </Button>
              <Button variant={timeRange === 6 ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange(6)}>
                6h
              </Button>
              <Button variant={timeRange === 24 ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange(24)}>
                24h
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {servers?.map((server: any, index: number) => (
                  <Line
                    key={server.id}
                    type="monotone"
                    dataKey={`${server.name}_${selectedMetric}`}
                    stroke={colors[index % colors.length]}
                    name={server.name}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">No metrics data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
