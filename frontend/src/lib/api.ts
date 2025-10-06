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
