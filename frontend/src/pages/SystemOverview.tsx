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
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

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

    // Create a map of timestamps (rounded to nearest minute for alignment)
    const timestampMap = new Map<number, any>();

    serversMetrics.data.forEach((serverData: any) => {
      if (!serverData.metrics?.system) return;

      serverData.metrics.system.forEach((metric: any) => {
        const date = new Date(metric.timestamp);
        if (isNaN(date.getTime())) return;

        // Round to nearest minute for alignment across servers
        const roundedTime = Math.floor(date.getTime() / 60000) * 60000;

        if (!timestampMap.has(roundedTime)) {
          timestampMap.set(roundedTime, {
            timestamp: new Date(roundedTime).toLocaleTimeString(),
            _time: roundedTime,
          });
        }

        const point = timestampMap.get(roundedTime);
        const partitions = Object.values(metric.value.disk?.partitions || {}) as any[];

        point[`${serverData.serverName}_cpu`] = metric.value.cpu?.usage_percent || 0;
        point[`${serverData.serverName}_memory`] = metric.value.memory?.used_percent || 0;
        point[`${serverData.serverName}_disk`] = partitions[0]?.used_percent || 0;
      });
    });

    // Sort by time and return
    return Array.from(timestampMap.values()).sort((a, b) => a._time - b._time);
  };

  const chartData = prepareChartData();

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  const handleLegendClick = (data: any) => {
    const serverName = data.value;
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serverName)) {
        newSet.delete(serverName);
      } else {
        newSet.add(serverName);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setHiddenSeries(new Set());
  };

  const tooltipFormatter = (value: any) => {
    if (typeof value === 'number') {
      return value.toFixed(2) + '%';
    }
    return value;
  };

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
              {hiddenSeries.size > 0 && (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear Selection
                </Button>
              )}
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
                <Tooltip formatter={tooltipFormatter} />
                <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
                {servers?.map((server: any, index: number) => (
                  <Line
                    key={server.id}
                    type="monotone"
                    dataKey={`${server.name}_${selectedMetric}`}
                    stroke={colors[index % colors.length]}
                    name={server.name}
                    dot={false}
                    hide={hiddenSeries.has(server.name)}
                    strokeWidth={2}
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
