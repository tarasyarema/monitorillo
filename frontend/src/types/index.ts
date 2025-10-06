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
