import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { serversApi, metricsApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const DockerOverview: React.FC = () => {
  const { currentTeam } = useAppStore();
  const [searchParams] = useSearchParams();
  const containerFromUrl = searchParams.get('container');
  const [timeRange, setTimeRange] = useState(24);
  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(
    containerFromUrl ? new Set([containerFromUrl]) : new Set()
  );
  const [allContainers, setAllContainers] = useState<Map<string, { name: string; server: string }>>(new Map());
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const { data: servers } = useQuery({
    queryKey: ['servers', currentTeam?.id],
    queryFn: () => (currentTeam ? serversApi.list(currentTeam.id) : Promise.resolve([])),
    enabled: !!currentTeam,
  });

  const serversMetrics = useQuery({
    queryKey: ['all-docker-metrics', servers?.map((s: any) => s.id), timeRange],
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

  // Extract all containers and update state when data changes
  useEffect(() => {
    if (!serversMetrics.data) return;

    const containers = new Map<string, { name: string; server: string }>();

    serversMetrics.data.forEach((serverData: any) => {
      if (!serverData.metrics?.docker) return;

      serverData.metrics.docker.forEach((metric: any) => {
        metric.value.containers?.forEach((container: any) => {
          const containerKey = `${serverData.serverName}_${container.name}`;
          containers.set(containerKey, {
            name: container.name,
            server: serverData.serverName,
          });
        });
      });
    });

    setAllContainers(containers);
  }, [serversMetrics.data]);

  // Prepare chart data using useMemo to avoid recalculation on every render
  const chartData = useMemo(() => {
    if (!serversMetrics.data) return [];

    const timestampMap = new Map<number, any>();

    serversMetrics.data.forEach((serverData: any) => {
      if (!serverData.metrics?.docker) return;

      serverData.metrics.docker.forEach((metric: any) => {
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

        metric.value.containers?.forEach((container: any) => {
          const containerKey = `${serverData.serverName}_${container.name}`;

          if (selectedContainers.size === 0 || selectedContainers.has(containerKey)) {
            point[`${containerKey}_cpu`] = container.cpu_percent || 0;
            // Calculate memory percentage from usage and limit
            const memoryPercent =
              container.memory_limit > 0 ? (container.memory_usage / container.memory_limit) * 100 : 0;
            point[`${containerKey}_memory`] = memoryPercent;
          }
        });
      });
    });

    // Sort by time and return
    return Array.from(timestampMap.values()).sort((a, b) => a._time - b._time);
  }, [serversMetrics.data, selectedContainers]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  const handleLegendClick = (data: any) => {
    const containerName = data.value;
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(containerName)) {
        newSet.delete(containerName);
      } else {
        newSet.add(containerName);
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

  const toggleContainer = (key: string) => {
    const newSelected = new Set(selectedContainers);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedContainers(newSelected);
  };

  const toggleAll = () => {
    if (selectedContainers.size === allContainers.size) {
      setSelectedContainers(new Set());
    } else {
      setSelectedContainers(new Set(allContainers.keys()));
    }
  };

  if (!currentTeam) {
    return <div className="text-center py-12">Please select a team first</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Docker Containers Overview</h1>
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

      {/* Container Selection */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Select Containers</CardTitle>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedContainers.size === allContainers.size ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from(allContainers.entries()).map(([key, container]) => (
              <Badge
                key={key}
                variant={selectedContainers.has(key) || selectedContainers.size === 0 ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleContainer(key)}
              >
                {container.server} / {container.name}
              </Badge>
            ))}
            {allContainers.size === 0 && <p className="text-sm text-gray-500">No containers found</p>}
          </div>
        </CardContent>
      </Card>

      {/* CPU Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Container CPU Usage (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={tooltipFormatter} />
                <Legend
                  onClick={handleLegendClick}
                  wrapperStyle={{ maxHeight: '100px', overflowY: 'auto', cursor: 'pointer' }}
                />
                {Array.from(allContainers.keys()).map((key, index) => {
                  if (selectedContainers.size > 0 && !selectedContainers.has(key)) return null;
                  const containerLabel = `${allContainers.get(key)?.server} / ${allContainers.get(key)?.name}`;
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={`${key}_cpu`}
                      stroke={colors[index % colors.length]}
                      name={containerLabel}
                      dot={false}
                      strokeWidth={2}
                      hide={hiddenSeries.has(containerLabel)}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-gray-500">No metrics data available</div>
          )}
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Container Memory Usage (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={tooltipFormatter} />
                <Legend
                  onClick={handleLegendClick}
                  wrapperStyle={{ maxHeight: '100px', overflowY: 'auto', cursor: 'pointer' }}
                />
                {Array.from(allContainers.keys()).map((key, index) => {
                  if (selectedContainers.size > 0 && !selectedContainers.has(key)) return null;
                  const containerLabel = `${allContainers.get(key)?.server} / ${allContainers.get(key)?.name}`;
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={`${key}_memory`}
                      stroke={colors[index % colors.length]}
                      name={containerLabel}
                      dot={false}
                      strokeWidth={2}
                      hide={hiddenSeries.has(containerLabel)}
                    />
                  );
                })}
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
