export interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

export interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: number;
  user_id: number;
  team_id: number;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user?: User;
}

export interface Server {
  id: number;
  team_id: number;
  name: string;
  hostname: string;
  api_key: string;
  status: 'online' | 'offline' | 'warning' | 'critical';
  last_seen_at: string | null;
  created_at: string;
}

export interface SystemMetrics {
  cpu: {
    usage_percent: number;
    load_avg_1: number;
    load_avg_5: number;
    load_avg_15: number;
  };
  memory: {
    total: number;
    available: number;
    used: number;
    used_percent: number;
  };
  disk: {
    partitions: {
      [key: string]: {
        total: number;
        used: number;
        free: number;
        used_percent: number;
      };
    };
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
  };
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  cpu_percent?: number;
  memory_usage?: number;
  memory_limit?: number;
  memory_percent?: number;
  network_rx_bytes?: number;
  network_tx_bytes?: number;
  block_read_bytes?: number;
  block_write_bytes?: number;
}

export interface DockerMetrics {
  containers: DockerContainer[];
}

export interface Metric {
  id: number;
  server_id: number;
  metric_type: 'system' | 'docker';
  value: SystemMetrics | DockerMetrics;
  timestamp: string;
}

export interface Alert {
  id: number;
  team_id: number;
  server_id: number;
  alert_config_id: number;
  severity: 'warning' | 'critical';
  state: 'new' | 'acknowledged' | 'resolved';
  message: string;
  value: number;
  threshold: number;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: number | null;
  resolved_at: string | null;
  server?: Server;
}

export interface AlertConfig {
  id: number;
  team_id: number;
  server_id: number;
  metric_type: 'cpu' | 'memory' | 'disk';
  warning_threshold: number;
  critical_threshold: number;
  sustained_minutes: number;
  enabled: boolean;
  created_at: string;
}

export interface Invitation {
  id: number;
  team_id: number;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  invited_by: number;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface Service {
  id: number;
  team_id: number;
  name: string;
  description: string | null;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  version_url: string | null;
  version_json_path: string | null;
  current_version: string | null;
  last_version_check: string | null;
  created_at: string;
  health_checks?: HealthCheck[];
}

export interface HealthCheck {
  id: number;
  service_id: number;
  name: string;
  url: string;
  method: string;
  headers: Record<string, string> | null;
  body: string | null;
  expected_status_code: number;
  timeout_seconds: number;
  check_interval_minutes: number;
  json_path: string | null;
  expected_value: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResult {
  id: number;
  health_check_id: number;
  success: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export interface VersionCheck {
  id: number;
  service_id: number;
  name: string;
  url: string;
  json_path: string;
  timeout_seconds: number;
  check_interval_minutes: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface VersionCheckResult {
  id: number;
  version_check_id: number;
  version: string | null;
  success: boolean;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

export interface Deployment {
  id: number;
  service_id: number;
  version: string;
  detected_at: string;
  notes: string | null;
}
