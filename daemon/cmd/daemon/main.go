package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/monitorillo/daemon/internal/collector"
	"github.com/monitorillo/daemon/internal/config"
	"github.com/monitorillo/daemon/internal/reporter"
)

const (
	defaultConfigPath = "/etc/monitorillo/config.yaml"
)

func main() {
	configPath := flag.String("config", defaultConfigPath, "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting Monitorillo daemon for server: %s", cfg.ServerName)
	log.Printf("API URL: %s", cfg.APIConfig.URL)
	log.Printf("Collection interval: %ds", cfg.Interval)

	// Create API client
	client := reporter.NewClient(cfg.APIConfig.URL, cfg.APIConfig.APIKey, cfg.ServerName)

	// Setup signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("Received shutdown signal, stopping...")
		cancel()
	}()

	// Main collection loop
	ticker := time.NewTicker(time.Duration(cfg.Interval) * time.Second)
	defer ticker.Stop()

	// Collect and send immediately on start
	if err := collectAndSend(ctx, client); err != nil {
		log.Printf("Error collecting/sending metrics: %v", err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Println("Shutting down gracefully...")
			return
		case <-ticker.C:
			if err := collectAndSend(ctx, client); err != nil {
				log.Printf("Error collecting/sending metrics: %v", err)
			}
		}
	}
}

func collectAndSend(ctx context.Context, client *reporter.Client) error {
	log.Println("Collecting metrics...")

	// Collect system metrics
	systemMetrics, err := collector.CollectSystemMetrics(ctx)
	if err != nil {
		return fmt.Errorf("failed to collect system metrics: %w", err)
	}

	// Collect Docker metrics (if available)
	dockerMetrics, err := collector.CollectDockerMetrics(ctx)
	if err != nil {
		log.Printf("Warning: Failed to collect Docker metrics: %v", err)
		// Continue with empty Docker metrics
		dockerMetrics = &collector.DockerMetrics{Containers: []collector.ContainerMetrics{}}
	}

	// Send to API
	if err := client.SendMetrics(ctx, systemMetrics, dockerMetrics); err != nil {
		return fmt.Errorf("failed to send metrics: %w", err)
	}

	log.Printf("Metrics sent successfully (CPU: %.1f%%, Memory: %.1f%%, Containers: %d)",
		systemMetrics.CPU.UsagePercent,
		systemMetrics.Memory.UsedPercent,
		len(dockerMetrics.Containers))

	return nil
}
