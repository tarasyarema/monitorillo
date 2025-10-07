import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (email: string, password: string) => {
    const response = await api.post('/auth/register', { email, password });
    return response.data;
  },

  login: async (username: string, password: string) => {
    const response = await api.post(
      '/auth/jwt/login',
      new URLSearchParams({
        username,
        password,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/jwt/logout');
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
};

// Teams API
export const teamsApi = {
  list: async () => {
    const response = await api.get('/api/v1/teams');
    return response.data;
  },

  create: async (name: string) => {
    const response = await api.post('/api/v1/teams', { name });
    return response.data;
  },

  get: async (teamId: number) => {
    const response = await api.get(`/api/v1/teams/${teamId}`);
    return response.data;
  },

  addMember: async (teamId: number, email: string, role: string) => {
    const response = await api.post(`/api/v1/teams/${teamId}/members`, { email, role });
    return response.data;
  },

  removeMember: async (teamId: number, userId: number) => {
    await api.delete(`/api/v1/teams/${teamId}/members/${userId}`);
  },
};

// Servers API
export const serversApi = {
  list: async (teamId: number) => {
    const response = await api.get(`/api/v1/servers`, {
      params: { team_id: teamId },
    });
    return response.data;
  },

  create: async (teamId: number, name: string, hostname: string) => {
    const response = await api.post(
      `/api/v1/servers`,
      { name, hostname },
      {
        params: { team_id: teamId },
      }
    );
    return response.data;
  },

  get: async (serverId: number) => {
    const response = await api.get(`/api/v1/servers/${serverId}`);
    return response.data;
  },

  update: async (serverId: number, data: { name?: string; hostname?: string }) => {
    const response = await api.patch(`/api/v1/servers/${serverId}`, data);
    return response.data;
  },

  delete: async (serverId: number) => {
    await api.delete(`/api/v1/servers/${serverId}`);
  },

  regenerateApiKey: async (serverId: number) => {
    const response = await api.post(`/api/v1/servers/${serverId}/regenerate-key`);
    return response.data;
  },
};

// Metrics API
export const metricsApi = {
  getLatest: async (serverId: number) => {
    const response = await api.get(`/api/v1/metrics/servers/${serverId}/latest`);
    return response.data;
  },

  getHistory: async (serverId: number, hours: number = 24) => {
    const response = await api.get(`/api/v1/metrics/servers/${serverId}/history`, {
      params: { hours },
    });
    return response.data;
  },
};

// Alerts API
export const alertsApi = {
  list: async (state?: string) => {
    const response = await api.get('/api/v1/alerts', {
      params: state ? { state } : {},
    });
    return response.data;
  },

  acknowledge: async (alertId: number) => {
    const response = await api.post(`/api/v1/alerts/${alertId}/acknowledge`);
    return response.data;
  },

  resolve: async (alertId: number) => {
    const response = await api.post(`/api/v1/alerts/${alertId}/resolve`);
    return response.data;
  },

  getConfigs: async (serverId: number) => {
    const response = await api.get(`/api/v1/alerts/configs`);
    // Filter configs for this specific server
    return response.data.filter((config: any) => config.server_id === serverId);
  },

  updateConfig: async (
    configId: number,
    data: {
      warning_threshold?: number;
      critical_threshold?: number;
      sustained_minutes?: number;
      enabled?: boolean;
    }
  ) => {
    const response = await api.patch(`/api/v1/alert-configs/${configId}`, data);
    return response.data;
  },
};

// Invitations API
export const invitationsApi = {
  list: async (teamId: number) => {
    const response = await api.get(`/api/v1/teams/${teamId}/invitations`);
    return response.data;
  },

  create: async (teamId: number, email: string, role: string) => {
    const response = await api.post(`/api/v1/teams/${teamId}/invitations`, { email, role });
    return response.data;
  },

  revoke: async (invitationId: number) => {
    await api.delete(`/api/v1/invitations/${invitationId}`);
  },

  accept: async (token: string) => {
    const response = await api.post('/api/v1/invitations/accept', { token });
    return response.data;
  },
};

// Services API
export const servicesApi = {
  list: async (teamId: number) => {
    const response = await api.get(`/api/v1/teams/${teamId}/services`);
    return response.data;
  },

  create: async (teamId: number, data: { name: string; description?: string; version_url?: string; version_json_path?: string }) => {
    const response = await api.post(`/api/v1/teams/${teamId}/services`, data);
    return response.data;
  },

  get: async (serviceId: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}`);
    return response.data;
  },

  update: async (serviceId: number, data: { name?: string; description?: string; version_url?: string; version_json_path?: string }) => {
    const response = await api.patch(`/api/v1/services/${serviceId}`, data);
    return response.data;
  },

  delete: async (serviceId: number) => {
    await api.delete(`/api/v1/services/${serviceId}`);
  },
};

// Health Checks API
export const healthChecksApi = {
  list: async (serviceId: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}/health-checks`);
    return response.data;
  },

  create: async (serviceId: number, data: {
    name: string;
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    expected_status_code?: number;
    timeout_seconds?: number;
    check_interval_minutes?: number;
    json_path?: string;
    expected_value?: string;
    enabled?: boolean;
  }) => {
    const response = await api.post(`/api/v1/services/${serviceId}/health-checks`, data);
    return response.data;
  },

  update: async (checkId: number, data: {
    name?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    expected_status_code?: number;
    timeout_seconds?: number;
    check_interval_minutes?: number;
    json_path?: string;
    expected_value?: string;
    enabled?: boolean;
  }) => {
    const response = await api.patch(`/api/v1/health-checks/${checkId}`, data);
    return response.data;
  },

  delete: async (checkId: number) => {
    await api.delete(`/api/v1/health-checks/${checkId}`);
  },

  execute: async (checkId: number) => {
    const response = await api.post(`/api/v1/health-checks/${checkId}/execute`);
    return response.data;
  },

  getResults: async (checkId: number, hours?: number) => {
    const response = await api.get(`/api/v1/health-checks/${checkId}/results`, {
      params: hours ? { hours } : {},
    });
    return response.data;
  },
};

// Version Checks API
export const versionChecksApi = {
  list: async (serviceId: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}/version-checks`);
    return response.data;
  },

  create: async (serviceId: number, data: {
    name: string;
    url: string;
    json_path: string;
    timeout_seconds?: number;
    check_interval_minutes?: number;
    enabled?: boolean;
  }) => {
    const response = await api.post(`/api/v1/services/${serviceId}/version-checks`, data);
    return response.data;
  },

  update: async (checkId: number, data: {
    name?: string;
    url?: string;
    json_path?: string;
    timeout_seconds?: number;
    check_interval_minutes?: number;
    enabled?: boolean;
  }) => {
    const response = await api.patch(`/api/v1/version-checks/${checkId}`, data);
    return response.data;
  },

  delete: async (checkId: number) => {
    await api.delete(`/api/v1/version-checks/${checkId}`);
  },

  execute: async (checkId: number) => {
    const response = await api.post(`/api/v1/version-checks/${checkId}/execute`);
    return response.data;
  },

  getResults: async (checkId: number, hours?: number) => {
    const response = await api.get(`/api/v1/version-checks/${checkId}/results`, {
      params: hours ? { hours } : {},
    });
    return response.data;
  },
};

// Deployments API
export const deploymentsApi = {
  list: async (serviceId: number, limit?: number, offset?: number) => {
    const response = await api.get(`/api/v1/services/${serviceId}/deployments`, {
      params: {
        ...(limit && { limit }),
        ...(offset && { offset }),
      },
    });
    return response.data;
  },

  update: async (deploymentId: number, notes: string) => {
    const response = await api.patch(`/api/v1/deployments/${deploymentId}`, { notes });
    return response.data;
  },
};
