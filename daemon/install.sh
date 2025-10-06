#!/bin/bash

set -e

echo "Installing Monitorillo Daemon..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# Build the binary
echo "Building daemon..."
go build -o monitorillo-daemon ./cmd/daemon

# Install binary
echo "Installing binary to /usr/local/bin..."
cp monitorillo-daemon /usr/local/bin/
chmod +x /usr/local/bin/monitorillo-daemon

# Create config directory
echo "Creating config directory..."
mkdir -p /etc/monitorillo

# Install config if it doesn't exist
if [ ! -f /etc/monitorillo/config.yaml ]; then
  echo "Installing default config..."
  cp configs/config.example.yaml /etc/monitorillo/config.yaml
  echo ""
  echo "⚠️  Please edit /etc/monitorillo/config.yaml with your settings!"
  echo ""
fi

# Install systemd service
if command -v systemctl &> /dev/null; then
  echo "Installing systemd service..."
  cp configs/monitorillo.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable monitorillo

  echo ""
  echo "✅ Installation complete!"
  echo ""
  echo "Next steps:"
  echo "1. Edit /etc/monitorillo/config.yaml with your API URL and key"
  echo "2. Start the service: sudo systemctl start monitorillo"
  echo "3. Check status: sudo systemctl status monitorillo"
  echo "4. View logs: sudo journalctl -u monitorillo -f"
else
  echo ""
  echo "✅ Binary installed!"
  echo ""
  echo "Note: systemd not detected. You'll need to set up service management manually."
  echo "Run directly: /usr/local/bin/monitorillo-daemon -config /etc/monitorillo/config.yaml"
fi
