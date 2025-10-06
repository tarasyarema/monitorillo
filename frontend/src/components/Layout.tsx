import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore, useAppStore } from '../lib/store';
import { authApi } from '../lib/api';
import { Button } from './ui/button';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const { currentTeam } = useAppStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearAuth();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-gray-900">Monitorillo</span>
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                    location.pathname === '/'
                      ? 'text-gray-900 border-primary'
                      : 'text-gray-500 hover:text-gray-900 hover:border-gray-300 border-transparent'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/system-overview"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                    location.pathname === '/system-overview'
                      ? 'text-gray-900 border-primary'
                      : 'text-gray-500 hover:text-gray-900 hover:border-gray-300 border-transparent'
                  }`}
                >
                  System
                </Link>
                <Link
                  to="/docker-overview"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                    location.pathname === '/docker-overview'
                      ? 'text-gray-900 border-primary'
                      : 'text-gray-500 hover:text-gray-900 hover:border-gray-300 border-transparent'
                  }`}
                >
                  Docker
                </Link>
                <Link
                  to="/servers"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                    location.pathname.startsWith('/servers')
                      ? 'text-gray-900 border-primary'
                      : 'text-gray-500 hover:text-gray-900 hover:border-gray-300 border-transparent'
                  }`}
                >
                  Servers
                </Link>
                <Link
                  to="/alerts"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                    location.pathname === '/alerts'
                      ? 'text-gray-900 border-primary'
                      : 'text-gray-500 hover:text-gray-900 hover:border-gray-300 border-transparent'
                  }`}
                >
                  Alerts
                </Link>
              </div>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
              {currentTeam && (
                <div className="text-sm text-gray-600">
                  Team: <span className="font-medium">{currentTeam.name}</span>
                </div>
              )}
              <Link to="/teams">
                <Button variant="outline" size="sm">
                  Teams
                </Button>
              </Link>
              <div className="text-sm text-gray-600">{user?.email}</div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>

            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden">
            <div className="pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/system-overview"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/system-overview'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                System
              </Link>
              <Link
                to="/docker-overview"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/docker-overview'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                Docker
              </Link>
              <Link
                to="/servers"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname.startsWith('/servers')
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                Servers
              </Link>
              <Link
                to="/alerts"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/alerts'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                Alerts
              </Link>
              <Link
                to="/teams"
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  location.pathname === '/teams'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                Teams
              </Link>
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="px-4 space-y-2">
                <div className="text-sm text-gray-600">{user?.email}</div>
                {currentTeam && (
                  <div className="text-sm text-gray-600">
                    Team: <span className="font-medium">{currentTeam.name}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
                  Logout
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
