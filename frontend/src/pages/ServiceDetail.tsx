import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi, healthChecksApi, versionChecksApi, deploymentsApi } from '../lib/api';
import { HealthCheck, VersionCheck, Deployment, HealthCheckResult, VersionCheckResult } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { safeToLocaleDateString } from '../lib/utils';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
} from 'recharts';

export const ServiceDetail: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // UI State
  const [error, setError] = useState('');
  const [showHealthCheckForm, setShowHealthCheckForm] = useState(false);
  const [showVersionCheckForm, setShowVersionCheckForm] = useState(false);
  const [editingHealthCheck, setEditingHealthCheck] = useState<HealthCheck | null>(null);
  const [editingVersionCheck, setEditingVersionCheck] = useState<VersionCheck | null>(null);

  // Health Check Form State
  const [hcName, setHcName] = useState('');
  const [hcUrl, setHcUrl] = useState('');
  const [hcMethod, setHcMethod] = useState('GET');
  const [hcInterval, setHcInterval] = useState('5');
  const [hcTimeout, setHcTimeout] = useState('30');
  const [hcExpectedStatus, setHcExpectedStatus] = useState('200');
  const [hcJsonPath, setHcJsonPath] = useState('');
  const [hcExpectedValue, setHcExpectedValue] = useState('');

  // Version Check Form State
  const [vcName, setVcName] = useState('');
  const [vcUrl, setVcUrl] = useState('');
  const [vcJsonPath, setVcJsonPath] = useState('');
  const [vcInterval, setVcInterval] = useState('5');
  const [vcTimeout, setVcTimeout] = useState('30');

  // Data Queries
  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ['service', serviceId],
    queryFn: () => servicesApi.get(Number(serviceId)),
    enabled: !!serviceId,
  });

  const { data: healthChecks, isLoading: healthChecksLoading } = useQuery({
    queryKey: ['healthChecks', serviceId],
    queryFn: () => healthChecksApi.list(Number(serviceId)),
    enabled: !!serviceId,
  });

  const { data: versionChecks, isLoading: versionChecksLoading } = useQuery({
    queryKey: ['versionChecks', serviceId],
    queryFn: () => versionChecksApi.list(Number(serviceId)),
    enabled: !!serviceId,
  });

  const { data: deployments } = useQuery({
    queryKey: ['deployments', serviceId],
    queryFn: () => deploymentsApi.list(Number(serviceId), 50),
    enabled: !!serviceId,
  });

  // Fetch results for timeline (24 hours)
  const { data: allHealthCheckResults } = useQuery({
    queryKey: ['allHealthCheckResults', serviceId, healthChecks],
    queryFn: async () => {
      if (!healthChecks || healthChecks.length === 0) return [];
      const results = await Promise.all(
        healthChecks.map((check: HealthCheck) => healthChecksApi.getResults(check.id, 24).catch(() => []))
      );
      return results.flat();
    },
    enabled: !!serviceId && !!healthChecks && healthChecks.length > 0,
  });

  const { data: allVersionCheckResults } = useQuery({
    queryKey: ['allVersionCheckResults', serviceId, versionChecks],
    queryFn: async () => {
      if (!versionChecks || versionChecks.length === 0) return [];
      const results = await Promise.all(
        versionChecks.map((check: VersionCheck) => versionChecksApi.getResults(check.id, 24).catch(() => []))
      );
      return results.flat();
    },
    enabled: !!serviceId && !!versionChecks && versionChecks.length > 0,
  });

  // Health Check Mutations
  const createHealthCheckMutation = useMutation({
    mutationFn: (data: any) => healthChecksApi.create(Number(serviceId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthChecks', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
      resetHealthCheckForm();
      setShowHealthCheckForm(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create health check');
    },
  });

  const updateHealthCheckMutation = useMutation({
    mutationFn: ({ checkId, data }: { checkId: number; data: any }) => healthChecksApi.update(checkId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthChecks', serviceId] });
      setEditingHealthCheck(null);
      resetHealthCheckForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update health check');
    },
  });

  const deleteHealthCheckMutation = useMutation({
    mutationFn: (checkId: number) => healthChecksApi.delete(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthChecks', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to delete health check');
    },
  });

  const toggleHealthCheckMutation = useMutation({
    mutationFn: ({ checkId, enabled }: { checkId: number; enabled: boolean }) =>
      healthChecksApi.update(checkId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthChecks', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update health check');
    },
  });

  const executeHealthCheckMutation = useMutation({
    mutationFn: (checkId: number) => healthChecksApi.execute(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['healthChecks', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['service', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['allHealthCheckResults', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to execute health check');
    },
  });

  // Version Check Mutations
  const createVersionCheckMutation = useMutation({
    mutationFn: (data: any) => versionChecksApi.create(Number(serviceId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versionChecks', serviceId] });
      resetVersionCheckForm();
      setShowVersionCheckForm(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create version check');
    },
  });

  const updateVersionCheckMutation = useMutation({
    mutationFn: ({ checkId, data }: { checkId: number; data: any }) => versionChecksApi.update(checkId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versionChecks', serviceId] });
      setEditingVersionCheck(null);
      resetVersionCheckForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update version check');
    },
  });

  const deleteVersionCheckMutation = useMutation({
    mutationFn: (checkId: number) => versionChecksApi.delete(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versionChecks', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to delete version check');
    },
  });

  const toggleVersionCheckMutation = useMutation({
    mutationFn: ({ checkId, enabled }: { checkId: number; enabled: boolean }) =>
      versionChecksApi.update(checkId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versionChecks', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update version check');
    },
  });

  const executeVersionCheckMutation = useMutation({
    mutationFn: (checkId: number) => versionChecksApi.execute(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versionChecks', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['deployments', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['allVersionCheckResults', serviceId] });
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to execute version check');
    },
  });

  // Form Helpers
  const resetHealthCheckForm = () => {
    setHcName('');
    setHcUrl('');
    setHcMethod('GET');
    setHcInterval('5');
    setHcTimeout('30');
    setHcExpectedStatus('200');
    setHcJsonPath('');
    setHcExpectedValue('');
  };

  const resetVersionCheckForm = () => {
    setVcName('');
    setVcUrl('');
    setVcJsonPath('');
    setVcInterval('5');
    setVcTimeout('30');
  };

  const loadHealthCheckForEdit = (check: HealthCheck) => {
    setEditingHealthCheck(check);
    setHcName(check.name);
    setHcUrl(check.url);
    setHcMethod(check.method);
    setHcInterval(check.check_interval_minutes.toString());
    setHcTimeout(check.timeout_seconds.toString());
    setHcExpectedStatus(check.expected_status_code.toString());
    setHcJsonPath(check.json_path || '');
    setHcExpectedValue(check.expected_value || '');
  };

  const loadVersionCheckForEdit = (check: VersionCheck) => {
    setEditingVersionCheck(check);
    setVcName(check.name);
    setVcUrl(check.url);
    setVcJsonPath(check.json_path);
    setVcInterval(check.check_interval_minutes.toString());
    setVcTimeout(check.timeout_seconds.toString());
  };

  const handleHealthCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hcName.trim() || !hcUrl.trim()) {
      setError('Name and URL are required');
      return;
    }

    const data = {
      name: hcName,
      url: hcUrl,
      method: hcMethod,
      check_interval_minutes: parseInt(hcInterval),
      timeout_seconds: parseInt(hcTimeout),
      expected_status_code: parseInt(hcExpectedStatus),
      json_path: hcJsonPath || undefined,
      expected_value: hcExpectedValue || undefined,
      enabled: true,
    };

    if (editingHealthCheck) {
      updateHealthCheckMutation.mutate({ checkId: editingHealthCheck.id, data });
    } else {
      createHealthCheckMutation.mutate(data);
    }
  };

  const handleVersionCheckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vcName.trim() || !vcUrl.trim() || !vcJsonPath.trim()) {
      setError('Name, URL, and JSON Path are required');
      return;
    }

    const data = {
      name: vcName,
      url: vcUrl,
      json_path: vcJsonPath,
      check_interval_minutes: parseInt(vcInterval),
      timeout_seconds: parseInt(vcTimeout),
      enabled: true,
    };

    if (editingVersionCheck) {
      updateVersionCheckMutation.mutate({ checkId: editingVersionCheck.id, data });
    } else {
      createVersionCheckMutation.mutate(data);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'success':
        return 'success';
      case 'degraded':
      case 'warning':
        return 'warning';
      case 'unhealthy':
      case 'failure':
        return 'destructive';
      default:
        return 'default';
    }
  };

  // Helper to determine if version is upgrade or rollback
  const getDeploymentType = (currentIndex: number, deploymentList: Deployment[]): 'upgrade' | 'rollback' => {
    if (currentIndex >= deploymentList.length - 1) return 'upgrade';

    const current = deploymentList[currentIndex];
    const previous = deploymentList[currentIndex + 1];

    // Simple version comparison (you might want to use semver library for production)
    return current.version > previous.version ? 'upgrade' : 'rollback';
  };

  // Build chart data for timeline visualization
  const buildChartData = () => {
    const timestampMap = new Map<number, any>();

    // Process health check results
    if (allHealthCheckResults) {
      allHealthCheckResults.forEach((result: HealthCheckResult) => {
        const check = healthChecks?.find((c: HealthCheck) => c.id === result.health_check_id);
        const checkName = check?.name || 'Health Check';
        const timestamp = new Date(result.checked_at).getTime();

        if (!timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, {
            timestamp,
            time: new Date(result.checked_at).toLocaleTimeString(),
            fullTime: new Date(result.checked_at).toLocaleString(),
          });
        }

        const dataPoint = timestampMap.get(timestamp);
        dataPoint[checkName] = result.success ? result.response_time_ms : null;
      });
    }

    // Process version check results
    if (allVersionCheckResults) {
      allVersionCheckResults.forEach((result: VersionCheckResult) => {
        const check = versionChecks?.find((c: VersionCheck) => c.id === result.version_check_id);
        const checkName = check?.name || 'Version Check';
        const timestamp = new Date(result.checked_at).getTime();

        if (!timestampMap.has(timestamp)) {
          timestampMap.set(timestamp, {
            timestamp,
            time: new Date(result.checked_at).toLocaleTimeString(),
            fullTime: new Date(result.checked_at).toLocaleString(),
          });
        }

        const dataPoint = timestampMap.get(timestamp);
        dataPoint[checkName] = result.success ? result.response_time_ms : null;
      });
    }

    // Convert map to sorted array
    const sortedData = Array.from(timestampMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    // Find max latency value for positioning deployment markers
    let maxLatency = 0;
    sortedData.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== 'timestamp' && key !== 'time' && key !== 'fullTime' && typeof point[key] === 'number') {
          maxLatency = Math.max(maxLatency, point[key]);
        }
      });
    });

    // Add deployment markers to data points
    if (deployments) {
      deployments.forEach((deployment: Deployment, index: number) => {
        const timestamp = new Date(deployment.detected_at).getTime();
        const existingPoint = sortedData.find((d) => d.timestamp === timestamp);

        const deploymentMarkerValue = maxLatency * 1.15; // 15% above max
        const deploymentType = getDeploymentType(index, deployments);

        if (existingPoint) {
          existingPoint.deployment = deploymentMarkerValue;
          existingPoint.deploymentType = deploymentType;
          existingPoint.deploymentVersion = deployment.version;
        } else {
          sortedData.push({
            timestamp,
            time: new Date(deployment.detected_at).toLocaleTimeString(),
            fullTime: new Date(deployment.detected_at).toLocaleString(),
            deployment: deploymentMarkerValue,
            deploymentType: deploymentType,
            deploymentVersion: deployment.version,
          });
        }
      });
    }

    // Re-sort after adding deployments
    return sortedData.sort((a, b) => a.timestamp - b.timestamp);
  };

  const chartData = buildChartData();

  // Count how many deployments are in the chart
  const deploymentCount = chartData.filter((d) => d.deployment).length;

  // Get unique check names for line colors
  const allCheckNames = new Set<string>();
  if (healthChecks) {
    healthChecks.forEach((check: HealthCheck) => allCheckNames.add(check.name));
  }
  if (versionChecks) {
    versionChecks.forEach((check: VersionCheck) => allCheckNames.add(check.name));
  }
  const checkNamesArray = Array.from(allCheckNames);

  // Color palette for different checks
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;

      // Get ALL check names to show all data at this timestamp
      const allCheckData: Array<{ name: string; value: number | null; color: string }> = [];

      // Iterate through all check names and get their values from dataPoint
      checkNamesArray.forEach((checkName, index) => {
        const value = dataPoint[checkName];
        if (value !== null && value !== undefined) {
          allCheckData.push({
            name: checkName,
            value: value,
            color: colors[index % colors.length],
          });
        }
      });

      return (
        <div className="bg-white p-3 border rounded shadow-lg min-w-[220px]">
          <p className="text-sm font-medium mb-2 border-b pb-2">{dataPoint?.fullTime}</p>
          <div className="space-y-1.5">
            {allCheckData.length > 0 ? (
              allCheckData.map((entry, index) => (
                <div key={index} className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm">{entry.name}</span>
                  </div>
                  <span className="text-sm font-mono font-medium" style={{ color: entry.color }}>
                    {entry.value}ms
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 italic">No health or version checks at this time</div>
            )}
            {dataPoint?.deployment && (
              <div className={allCheckData.length > 0 ? 'mt-2 pt-2 border-t' : ''}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{dataPoint.deploymentType === 'upgrade' ? '🚀' : '⏪'}</span>
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: dataPoint.deploymentType === 'upgrade' ? '#10b981' : '#ef4444' }}
                    >
                      {dataPoint.deploymentType === 'upgrade' ? 'Upgrade' : 'Rollback'}
                    </div>
                    <div className="text-xs text-gray-600 font-mono">v{dataPoint.deploymentVersion}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (serviceLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading service...</div>
      </div>
    );
  }

  if (!service) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-600">Service not found.</p>
          <Button onClick={() => navigate('/services')} className="mt-4">
            Back to Services
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/services')}>
          ← Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{service.name}</h1>
          {service.description && <p className="text-gray-600 mt-1">{service.description}</p>}
        </div>
        <Badge variant={getStatusBadgeVariant(service.status)}>{service.status}</Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Service Info */}
      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {service.current_version && (
            <div>
              <span className="text-gray-600">Current Version:</span>{' '}
              <span className="font-mono font-medium">{service.current_version}</span>
            </div>
          )}
          {service.last_version_check && (
            <div className="text-sm text-gray-500">
              Last version check: {safeToLocaleDateString(service.last_version_check)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Graph */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle>Activity Timeline (Last 24h)</CardTitle>
              <CardDescription>
                Response times for health checks and version checks with deployment markers
              </CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <polygon points="8,12 2,4 14,4" fill="#10b981" />
                </svg>
                <span className="text-gray-600">Upgrade</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <polygon points="8,12 2,4 14,4" fill="#ef4444" />
                </svg>
                <span className="text-gray-600">Rollback</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">
                No activity in the last 24 hours. Enable health checks or version checks to start tracking.
              </p>
              {deployments && deployments.length > 0 && (
                <p className="text-xs mt-4">
                  {deployments.length} deployment{deployments.length > 1 ? 's' : ''} detected (showing in deployment
                  history below)
                </p>
              )}
            </div>
          ) : (
            <>
              {deploymentCount > 0 && (
                <div className="mb-2 text-xs text-gray-600">
                  📊 {deploymentCount} deployment{deploymentCount > 1 ? 's' : ''} marked on graph
                </div>
              )}
              <div className="w-full" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 25, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '12px' }} tick={{ fill: '#6b7280' }} />
                    <YAxis
                      label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                      tick={{ fill: '#6b7280' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />

                    {/* Lines for each check */}
                    {checkNamesArray.map((checkName, index) => (
                      <Line
                        key={checkName}
                        type="monotone"
                        dataKey={checkName}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    ))}

                    {/* Deployment markers as scatter plot */}
                    <Scatter
                      dataKey="deployment"
                      fill="#8884d8"
                      shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (!payload.deployment) return <g />;

                        const isUpgrade = payload.deploymentType === 'upgrade';
                        const color = isUpgrade ? '#10b981' : '#ef4444';
                        const size = 12;

                        return (
                          <g>
                            {/* Triangle pointing down */}
                            <polygon
                              points={`${cx},${cy + size} ${cx - size},${cy - size} ${cx + size},${cy - size}`}
                              fill={color}
                              stroke={color}
                              strokeWidth={2}
                            />
                            {/* Version label */}
                            <text
                              x={cx}
                              y={cy - size - 5}
                              textAnchor="middle"
                              fill={color}
                              fontSize="11"
                              fontWeight="bold"
                            >
                              {payload.deploymentVersion}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Health Checks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Health Checks</h2>
          <Button
            onClick={() => {
              if (editingHealthCheck) {
                setEditingHealthCheck(null);
                resetHealthCheckForm();
              }
              setShowHealthCheckForm(!showHealthCheckForm);
            }}
          >
            {showHealthCheckForm ? 'Cancel' : 'Add Health Check'}
          </Button>
        </div>

        {(showHealthCheckForm || editingHealthCheck) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{editingHealthCheck ? 'Edit Health Check' : 'Add Health Check'}</CardTitle>
              <CardDescription>Configure a health check for this service</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleHealthCheckSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <Input
                      placeholder="e.g., API Health Check"
                      value={hcName}
                      onChange={(e) => setHcName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL *</label>
                    <Input
                      placeholder="https://api.example.com/health"
                      value={hcUrl}
                      onChange={(e) => setHcUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Method</label>
                    <select
                      value={hcMethod}
                      onChange={(e) => setHcMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="HEAD">HEAD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Status</label>
                    <Input
                      type="number"
                      value={hcExpectedStatus}
                      onChange={(e) => setHcExpectedStatus(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Interval (minutes)</label>
                    <Input type="number" value={hcInterval} onChange={(e) => setHcInterval(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
                    <Input type="number" value={hcTimeout} onChange={(e) => setHcTimeout(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">JSON Path (optional)</label>
                    <Input
                      placeholder="e.g., status"
                      value={hcJsonPath}
                      onChange={(e) => setHcJsonPath(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Value (optional)</label>
                    <Input
                      placeholder="e.g., ok"
                      value={hcExpectedValue}
                      onChange={(e) => setHcExpectedValue(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createHealthCheckMutation.isPending || updateHealthCheckMutation.isPending}
                  >
                    {editingHealthCheck ? 'Update' : 'Create'} Health Check
                  </Button>
                  {editingHealthCheck && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingHealthCheck(null);
                        resetHealthCheckForm();
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {healthChecksLoading ? (
          <div className="text-center py-8">Loading health checks...</div>
        ) : healthChecks && healthChecks.length > 0 ? (
          <div className="space-y-4">
            {healthChecks.map((check: HealthCheck) => (
              <Card key={check.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{check.name}</CardTitle>
                      <CardDescription>{check.url}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={check.enabled ? 'default' : 'secondary'}>
                        {check.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-600">Method:</span> {check.method}
                    </div>
                    <div>
                      <span className="text-gray-600">Interval:</span> {check.check_interval_minutes}m
                    </div>
                    <div>
                      <span className="text-gray-600">Expected Status:</span> {check.expected_status_code}
                    </div>
                    <div>
                      <span className="text-gray-600">Timeout:</span> {check.timeout_seconds}s
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeHealthCheckMutation.mutate(check.id)}
                      disabled={executeHealthCheckMutation.isPending}
                    >
                      Run Now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => loadHealthCheckForEdit(check)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleHealthCheckMutation.mutate({
                          checkId: check.id,
                          enabled: !check.enabled,
                        })
                      }
                      disabled={toggleHealthCheckMutation.isPending}
                    >
                      {check.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this health check?')) {
                          deleteHealthCheckMutation.mutate(check.id);
                        }
                      }}
                      disabled={deleteHealthCheckMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600">No health checks configured yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Version Checks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Version Checks</h2>
          <Button
            onClick={() => {
              if (editingVersionCheck) {
                setEditingVersionCheck(null);
                resetVersionCheckForm();
              }
              setShowVersionCheckForm(!showVersionCheckForm);
            }}
          >
            {showVersionCheckForm ? 'Cancel' : 'Add Version Check'}
          </Button>
        </div>

        {(showVersionCheckForm || editingVersionCheck) && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{editingVersionCheck ? 'Edit Version Check' : 'Add Version Check'}</CardTitle>
              <CardDescription>Configure a version check for this service</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVersionCheckSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <Input
                      placeholder="e.g., API Version Check"
                      value={vcName}
                      onChange={(e) => setVcName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">URL *</label>
                    <Input
                      placeholder="https://api.example.com/version"
                      value={vcUrl}
                      onChange={(e) => setVcUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">JSON Path *</label>
                    <Input
                      placeholder="e.g., version"
                      value={vcJsonPath}
                      onChange={(e) => setVcJsonPath(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Interval (minutes)</label>
                    <Input type="number" value={vcInterval} onChange={(e) => setVcInterval(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
                    <Input type="number" value={vcTimeout} onChange={(e) => setVcTimeout(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createVersionCheckMutation.isPending || updateVersionCheckMutation.isPending}
                  >
                    {editingVersionCheck ? 'Update' : 'Create'} Version Check
                  </Button>
                  {editingVersionCheck && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingVersionCheck(null);
                        resetVersionCheckForm();
                      }}
                    >
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {versionChecksLoading ? (
          <div className="text-center py-8">Loading version checks...</div>
        ) : versionChecks && versionChecks.length > 0 ? (
          <div className="space-y-4">
            {versionChecks.map((check: VersionCheck) => (
              <Card key={check.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{check.name}</CardTitle>
                      <CardDescription>{check.url}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={check.enabled ? 'default' : 'secondary'}>
                        {check.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                    <div>
                      <span className="text-gray-600">JSON Path:</span> {check.json_path}
                    </div>
                    <div>
                      <span className="text-gray-600">Interval:</span> {check.check_interval_minutes}m
                    </div>
                    <div>
                      <span className="text-gray-600">Timeout:</span> {check.timeout_seconds}s
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => executeVersionCheckMutation.mutate(check.id)}
                      disabled={executeVersionCheckMutation.isPending}
                    >
                      Run Now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => loadVersionCheckForEdit(check)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleVersionCheckMutation.mutate({
                          checkId: check.id,
                          enabled: !check.enabled,
                        })
                      }
                      disabled={toggleVersionCheckMutation.isPending}
                    >
                      {check.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this version check?')) {
                          deleteVersionCheckMutation.mutate(check.id);
                        }
                      }}
                      disabled={deleteVersionCheckMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-600">No version checks configured yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
