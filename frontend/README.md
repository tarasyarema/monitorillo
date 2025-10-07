# Monitorillo Frontend

Modern React dashboard for Monitorillo infrastructure and service monitoring platform.

## Features

- **Real-time Monitoring**: Live metrics display with automatic updates
- **Service Management**: Create and configure HTTP health checks
- **Team Collaboration**: Invite team members via email
- **Alert Management**: View and acknowledge system alerts
- **Deployment History**: Track service versions over time
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Tech Stack

- **React 18**: Modern React with hooks
- **TypeScript**: Full type safety
- **Vite**: Fast build tool and dev server
- **React Router**: Client-side routing
- **TanStack Query**: Server state management with caching
- **Zustand**: Lightweight global state
- **Axios**: HTTP client
- **shadcn/ui**: High-quality UI components
- **Tailwind CSS**: Utility-first styling

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── Layout.tsx   # Main layout with navigation
│   │   ├── ProtectedRoute.tsx
│   │   └── TeamInvitations.tsx
│   ├── pages/           # Page components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Teams.tsx
│   │   ├── Servers.tsx
│   │   ├── ServerDetail.tsx
│   │   ├── Services.tsx
│   │   ├── ServiceDetail.tsx
│   │   ├── Alerts.tsx
│   │   ├── SystemOverview.tsx
│   │   ├── DockerOverview.tsx
│   │   └── AcceptInvitation.tsx
│   ├── lib/             # Utilities
│   │   ├── api.ts       # API client
│   │   ├── store.ts     # Zustand stores
│   │   └── utils.ts     # Helper functions
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file (optional):

```env
VITE_API_URL=http://localhost:8000
```

The default API URL is `http://localhost:8000`.

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Type check
npm run type-check

# Format code (if configured)
npm run format
```

## Key Features

### Authentication
- JWT-based authentication with refresh tokens
- Automatic token refresh on expiry
- Protected routes with redirect to login
- Persistent auth state with localStorage

### Team Management
- Create and switch between teams
- View team members
- Send email invitations with role selection
- Accept invitations via unique token URL

### Server Monitoring
- Real-time CPU, memory, disk, network metrics
- Docker container monitoring
- Alert configuration per metric type
- Historical data visualization
- Server detail view with multiple tabs

### Service Monitoring
- Create services with version tracking
- Configure HTTP health checks with:
  - Custom HTTP methods (GET, POST, HEAD)
  - Expected status codes
  - JSON path validation
  - Configurable intervals and timeouts
- Manual health check execution
- View health check history
- Real-time service status badges

### Deployment Tracking
- Automatic version detection
- Deployment history timeline
- Add notes to deployments
- Version comparison

### Alerts
- View active alerts
- Filter by state (new, acknowledged, resolved)
- Acknowledge and resolve alerts
- View alert details with context

## API Integration

The frontend communicates with the backend API using axios. The API client is configured in `src/lib/api.ts` with:

- Automatic auth token injection
- 401 error handling with redirect to login
- Organized API methods by resource:
  - `authApi`: Authentication
  - `teamsApi`: Team management
  - `serversApi`: Server CRUD
  - `servicesApi`: Service CRUD
  - `healthChecksApi`: Health check management
  - `deploymentsApi`: Deployment history
  - `invitationsApi`: Team invitations
  - `metricsApi`: Metrics data
  - `alertsApi`: Alert management

## State Management

### Global State (Zustand)
- `useAuthStore`: User authentication state
- `useAppStore`: Current team selection

### Server State (TanStack Query)
- Automatic caching and revalidation
- Background refetching
- Optimistic updates
- Query invalidation on mutations

## Styling

The app uses Tailwind CSS with shadcn/ui components for a consistent design system:

- **Colors**: Defined in `tailwind.config.js`
- **Components**: Located in `src/components/ui/`
- **Utilities**: Custom utilities in `src/lib/utils.ts`

### Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add [component-name]
```

## Type Safety

All API responses and component props are fully typed. Types are defined in:
- `src/types/index.ts`: Domain models (User, Team, Server, Service, etc.)
- Component-specific types: Inline or co-located

## Routing

Routes are defined in `App.tsx`:

- `/login` - Login page (public)
- `/register` - Registration page (public)
- `/invitations/accept` - Accept invitation (public)
- `/` - Dashboard (protected)
- `/teams` - Teams management (protected)
- `/servers` - Server list (protected)
- `/servers/:id` - Server detail (protected)
- `/services` - Service list (protected)
- `/services/:id` - Service detail (protected)
- `/alerts` - Alerts list (protected)
- `/system-overview` - System metrics overview (protected)
- `/docker-overview` - Docker containers overview (protected)

## Building for Production

```bash
# Build optimized production bundle
npm run build

# Output will be in dist/
ls dist/

# Test production build locally
npm run preview
```

The build output can be deployed to any static hosting service (Vercel, Netlify, Cloudflare Pages, etc.).

## Environment Variables

Available environment variables:

- `VITE_API_URL`: Backend API base URL (default: `http://localhost:8000`)

**Note**: Vite only exposes variables prefixed with `VITE_` to the client.

## Browser Support

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

## Performance

- Code splitting with React.lazy (planned)
- Image optimization (planned)
- Route-based lazy loading (planned)
- Service worker for offline support (planned)

## Troubleshooting

### API requests failing
- Check `VITE_API_URL` is correct
- Verify backend is running on port 8000
- Check browser console for CORS errors
- Verify auth token is being sent (Network tab)

### Build errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`
- Update dependencies: `npm update`

### Type errors
- Run type check: `npm run type-check`
- Check TypeScript version compatibility
- Verify all imports are correct

## Contributing

1. Create a feature branch
2. Make your changes with proper TypeScript types
3. Test in development mode
4. Run linter: `npm run lint`
5. Build production bundle: `npm run build`
6. Submit a pull request

## License

MIT
