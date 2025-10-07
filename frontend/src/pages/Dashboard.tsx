import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { serversApi, alertsApi, servicesApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Server, Alert, Service } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { safeFormatDistanceToNow } from '../lib/utils';

export const Dashboard: React.FC = () => {
  const { currentTeam } = useAppStore();

  const { data: servers } = useQuery({
    queryKey: ['servers', currentTeam?.id],
    queryFn: () => (currentTeam ? serversApi.list(currentTeam.id) : Promise.resolve([])),
    enabled: !!currentTeam,
  });

  const { data: services } = useQuery({
    queryKey: ['services', currentTeam?.id],
    queryFn: () => (currentTeam ? servicesApi.list(currentTeam.id) : Promise.resolve([])),
    enabled: !!currentTeam,
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.list(),
    refetchInterval: 30000,
  });

  if (!currentTeam) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">Welcome to Monitorillo</h2>
        <p className="text-gray-600 mb-4">Get started by creating or selecting a team</p>
        <Link to="/teams">
          <Button>Go to Teams</Button>
        </Link>
      </div>
    );
  }

  const onlineServers = servers?.filter((s: Server) => s.status === 'online') || [];
  const offlineServers = servers?.filter((s: Server) => s.status === 'offline') || [];
  const criticalServers = servers?.filter((s: Server) => s.status === 'critical') || [];
  const newAlerts = alerts?.filter((a: Alert) => a.state === 'new') || [];
  const activeAlerts = alerts?.filter((a: Alert) => a.state === 'new' || a.state === 'acknowledged') || [];

  const healthyServices = services?.filter((s: Service) => s.status === 'healthy') || [];
  const degradedServices = services?.filter((s: Service) => s.status === 'degraded') || [];
  const unhealthyServices = services?.filter((s: Service) => s.status === 'unhealthy') || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of {currentTeam.name}</p>
        </div>
        <Link to="/servers">
          <Button>Add Server</Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{servers?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {onlineServers.length} online, {offlineServers.length} offline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Total Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{services?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">
              {healthyServices.length} healthy, {unhealthyServices.length} unhealthy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{activeAlerts.length}</div>
            <p className="text-xs text-gray-500 mt-1">{newAlerts.length} new alerts</p>
          </CardContent>
        </Card>

        <Card className={criticalServers.length > 0 ? 'border-red-500' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Critical Servers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalServers.length}</div>
            <p className="text-xs text-gray-500 mt-1">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card className={degradedServices.length > 0 || unhealthyServices.length > 0 ? 'border-yellow-500' : ''}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Degraded Services</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {degradedServices.length + unhealthyServices.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      {newAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>New alerts requiring attention</CardDescription>
              </div>
              <Link to="/alerts">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newAlerts.slice(0, 5).map((alert: Alert) => (
                <div key={alert.id} className="flex items-start justify-between border rounded-lg p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>
                        {alert.severity}
                      </Badge>
                      {alert.server && (
                        <Link to={`/servers/${alert.server_id}`}>
                          <Badge variant="secondary">{alert.server.name}</Badge>
                        </Link>
                      )}
                    </div>
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {safeFormatDistanceToNow(alert.triggered_at, { addSuffix: true }) || 'recently'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Server Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Servers</CardTitle>
              <CardDescription>
                {servers?.length || 0} server{servers?.length !== 1 ? 's' : ''} registered
              </CardDescription>
            </div>
            <Link to="/servers">
              <Button variant="outline" size="sm">
                Manage Servers
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {servers && servers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {servers.map((server: Server) => (
                <Link key={server.id} to={`/servers/${server.id}`}>
                  <div className="border rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{server.name}</h4>
                        <p className="text-xs text-gray-600">{server.hostname}</p>
                      </div>
                      <Badge
                        variant={
                          server.status === 'online'
                            ? 'success'
                            : server.status === 'critical'
                              ? 'destructive'
                              : server.status === 'warning'
                                ? 'warning'
                                : 'secondary'
                        }
                      >
                        {server.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">
                      {server.last_seen_at ? (
                        <span>
                          Last seen {safeFormatDistanceToNow(server.last_seen_at, { addSuffix: true }) || 'recently'}
                        </span>
                      ) : (
                        <span className="text-gray-400">Never seen</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No servers registered yet</p>
              <Link to="/servers">
                <Button>Add Your First Server</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                {services?.length || 0} service{services?.length !== 1 ? 's' : ''} monitored
              </CardDescription>
            </div>
            <Link to="/services">
              <Button variant="outline" size="sm">
                Manage Services
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {services && services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.map((service: Service) => (
                <Link key={service.id} to={`/services/${service.id}`}>
                  <div className="border rounded-lg p-4 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{service.name}</h4>
                        {service.description && <p className="text-xs text-gray-600 truncate">{service.description}</p>}
                      </div>
                      <Badge
                        variant={
                          service.status === 'healthy'
                            ? 'success'
                            : service.status === 'unhealthy'
                              ? 'destructive'
                              : service.status === 'degraded'
                                ? 'warning'
                                : 'secondary'
                        }
                      >
                        {service.status}
                      </Badge>
                    </div>
                    {service.current_version && (
                      <div className="text-xs text-gray-500">
                        <span className="font-mono">{service.current_version}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No services monitored yet</p>
              <Link to="/services">
                <Button>Add Your First Service</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
