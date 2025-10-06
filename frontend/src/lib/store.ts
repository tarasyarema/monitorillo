import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

interface Team {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
}

interface AppState {
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export const useAppStore = create<AppState>((set) => ({
  currentTeam: JSON.parse(localStorage.getItem('current_team') || 'null'),
  setCurrentTeam: (team) => {
    if (team) {
      localStorage.setItem('current_team', JSON.stringify(team));
    } else {
      localStorage.removeItem('current_team');
    }
    set({ currentTeam: team });
  },
}));
