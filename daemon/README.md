# Monitorillo Daemon

Lightweight Go-based metrics collector for monitoring VPS servers.

## Features

- **System Metrics**: CPU, Memory, Disk, Network statistics
- **Docker Monitoring**: Container metrics (CPU, memory, network, disk I/O)
- **Low Overhead**: Minimal resource usage (~5-10MB RAM)
- **Secure**: API key authentication
- **Reliable**: Automatic retry with exponential backoff
- **Configurable**: Simple YAML configuration

## Architecture

The daemon runs as a system service and collects metrics every 30 seconds by default. It sends data to the Monitorillo API using HTTP POST requests.

## Prerequisites

- Go 1.21+ (for building)
- Linux (tested on Ubuntu, Debian, Fedora, CentOS)
- Docker (optional, for container monitoring)
- systemd (for service management)

## Installation

### 1. Build from Source

```bash
cd daemon
make build
```

This creates a `monitorillo-daemon` binary in the `bin/` directory.

### 2. Install Systemd Service

```bash
sudo ./install.sh
```

The install script:
- Copies the binary to `/usr/local/bin/`
- Creates configuration directory `/etc/monitorillo/`
- Creates data directory `/var/lib/monitorillo/`
- Installs systemd service file
- Enables and starts the service

### 3. Configure the Daemon

Edit `/etc/monitorillo/config.yaml`:

```yaml
# Monitorillo API endpoint
api_url: "http://your-monitorillo-server:8000/api/v1/metrics"

# Server API key (get from Monitorillo dashboard)
api_key: "your-server-api-key"

# Collection interval (seconds)
interval: 30

# Enable Docker monitoring
enable_docker: true

# Log settings
log_level: "info"  # debug, info, warn, error
log_file: "/var/log/monitorillo/daemon.log"
```

### 4. Get the API Key

1. Log in to Monitorillo dashboard
2. Go to Servers page
3. Create a new server
4. Copy the generated API key
5. Paste it into the daemon config

### 5. Restart the Service

```bash
sudo systemctl restart monitorillo
```

## Service Management

```bash
# Check status
sudo systemctl status monitorillo

# View logs
sudo journalctl -u monitorillo -f

# Restart service
sudo systemctl restart monitorillo

# Stop service
sudo systemctl stop monitorillo

# Start service
sudo systemctl start monitorillo

# Disable autostart
sudo systemctl disable monitorillo

# Enable autostart
sudo systemctl enable monitorillo
```

## Configuration Options

### config.yaml

```yaml
# Required settings
api_url: "http://localhost:8000/api/v1/metrics"
api_key: "your-api-key-here"

# Optional settings
interval: 30                    # Metric collection interval in seconds (default: 30)
enable_docker: true            # Enable Docker container monitoring (default: true)
log_level: "info"              # Logging level: debug, info, warn, error (default: info)
log_file: "/var/log/monitorillo/daemon.log"  # Log file path
timeout: 10                    # HTTP request timeout in seconds (default: 10)
retry_attempts: 3              # Number of retry attempts on failure (default: 3)
retry_delay: 5                 # Initial retry delay in seconds (default: 5)
```

## Collected Metrics

### System Metrics

- **CPU**: Usage percentage, load averages (1m, 5m, 15m)
- **Memory**: Total, used, available, percentage
- **Disk**: Per-partition usage, read/write bytes, IOPS
- **Network**: Bytes sent/received, packets sent/received

### Docker Metrics (when enabled)

- **Per-container**:
  - CPU usage percentage
  - Memory usage and limit
  - Network RX/TX bytes
  - Block I/O read/write bytes
  - Container state and status

## Building

### Development Build

```bash
make build
```

### Production Build (optimized)

```bash
make build-prod
```

### Cross-compilation

```bash
# Build for Linux AMD64
GOOS=linux GOARCH=amd64 make build

# Build for Linux ARM64
GOOS=linux GOARCH=arm64 make build
```

## Development

### Project Structure

```
daemon/
├── cmd/
│   └── daemon/
│       └── main.go       # Entry point
├── internal/
│   ├── collector/        # Metrics collection
│   │   ├── system.go     # System metrics
│   │   └── docker.go     # Docker metrics
│   ├── client/           # HTTP client
│   │   └── api.go        # API communication
│   ├── config/           # Configuration
│   │   └── config.go     # Config parsing
│   └── logger/           # Logging
│       └── logger.go     # Log setup
├── configs/
│   └── config.example.yaml
├── bin/                  # Build output
├── Makefile
├── install.sh            # Installation script
└── monitorillo.service   # Systemd service file
```

### Run in Development

```bash
# Build
make build

# Run with config
./bin/monitorillo-daemon -config configs/config.example.yaml
```

### Testing

```bash
# Run tests
make test

# Run tests with coverage
make test-coverage

# Run linter
make lint
```

## Troubleshooting

### Daemon not starting

```bash
# Check service status
sudo systemctl status monitorillo

# View recent logs
sudo journalctl -u monitorillo -n 50

# Check if binary exists
ls -la /usr/local/bin/monitorillo-daemon

# Check if config exists
ls -la /etc/monitorillo/config.yaml
```

### Metrics not appearing in dashboard

1. **Verify API key**: Check config.yaml has correct key
2. **Check connectivity**: Ensure daemon can reach API server
3. **View logs**: `sudo journalctl -u monitorillo -f`
4. **Test manually**:
   ```bash
   curl -H "X-API-Key: your-key" \
        http://your-server:8000/api/v1/metrics
   ```

### High CPU usage

- Increase collection interval in config.yaml
- Disable Docker monitoring if not needed
- Check for system issues (disk I/O, memory pressure)

### Docker metrics not collected

```bash
# Check if Docker is running
sudo systemctl status docker

# Check daemon has permission to access Docker socket
ls -la /var/run/docker.sock

# Add monitorillo user to docker group (if needed)
sudo usermod -aG docker monitorillo
sudo systemctl restart monitorillo
```

## Security

### Permissions

The daemon runs as a dedicated `monitorillo` user (created by install.sh) with minimal permissions:

- Read-only access to `/proc` and `/sys` for system metrics
- Docker socket access (via docker group) for container metrics
- Write access to `/var/log/monitorillo/` for logs

### API Key

- Store API key securely in config file
- Use file permissions to protect config: `chmod 600 /etc/monitorillo/config.yaml`
- Rotate keys regularly via Monitorillo dashboard
- Use HTTPS for API communication in production

### Network

- Daemon only makes outbound HTTPS connections
- No listening ports or services
- Consider firewall rules to restrict outbound connections

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop monitorillo
sudo systemctl disable monitorillo

# Remove files
sudo rm /usr/local/bin/monitorillo-daemon
sudo rm /etc/systemd/system/monitorillo.service
sudo rm -rf /etc/monitorillo
sudo rm -rf /var/lib/monitorillo
sudo rm -rf /var/log/monitorillo

# Reload systemd
sudo systemctl daemon-reload

# Remove user (optional)
sudo userdel monitorillo
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run tests and linter
5. Submit a pull request

## License

MIT
