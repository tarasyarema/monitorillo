package collector

import (
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

type DockerMetrics struct {
	Containers []ContainerMetrics `json:"containers"`
}

type ContainerMetrics struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Image       string  `json:"image"`
	Status      string  `json:"status"`
	State       string  `json:"state"`
	CPUPercent  float64 `json:"cpu_percent"`
	MemoryUsage uint64  `json:"memory_usage"`
	MemoryLimit uint64  `json:"memory_limit"`
	NetworkRx   uint64  `json:"network_rx"`
	NetworkTx   uint64  `json:"network_tx"`
	BlockRead   uint64  `json:"block_read"`
	BlockWrite  uint64  `json:"block_write"`
}

func CollectDockerMetrics(ctx context.Context) (*DockerMetrics, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}
	defer cli.Close()

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	metrics := &DockerMetrics{
		Containers: make([]ContainerMetrics, 0, len(containers)),
	}

	for _, ctr := range containers {
		containerMetric := ContainerMetrics{
			ID:     ctr.ID[:12], // Short ID
			Image:  ctr.Image,
			Status: ctr.Status,
			State:  ctr.State,
		}

		// Get container name (remove leading slash)
		if len(ctr.Names) > 0 {
			name := ctr.Names[0]
			if len(name) > 0 && name[0] == '/' {
				containerMetric.Name = name[1:]
			} else {
				containerMetric.Name = name
			}
		}

		// Get stats only for running containers
		if ctr.State == "running" {
			stats, err := cli.ContainerStats(ctx, ctr.ID, false)
			if err != nil {
				// Continue even if we can't get stats for one container
				continue
			}

			var containerStats types.StatsJSON
			if err := readStats(&stats, &containerStats); err == nil {
				// Calculate CPU percentage
				// Note: When stream=false, PreCPUStats might be empty on first call
				cpuDelta := float64(containerStats.CPUStats.CPUUsage.TotalUsage) -
					float64(containerStats.PreCPUStats.CPUUsage.TotalUsage)
				systemDelta := float64(containerStats.CPUStats.SystemUsage) -
					float64(containerStats.PreCPUStats.SystemUsage)

				// If PreCPUStats is empty (first call), calculate based on total usage
				if systemDelta > 0.0 && cpuDelta > 0.0 {
					numCPU := float64(len(containerStats.CPUStats.CPUUsage.PercpuUsage))
					if numCPU == 0 {
						numCPU = 1.0
					}
					cpuPercent := (cpuDelta / systemDelta) * numCPU * 100.0
					containerMetric.CPUPercent = cpuPercent
				} else if containerStats.CPUStats.CPUUsage.TotalUsage > 0 {
					// Fallback: calculate approximate CPU usage based on online CPU count
					numCPU := float64(containerStats.CPUStats.OnlineCPUs)
					if numCPU == 0 {
						numCPU = float64(len(containerStats.CPUStats.CPUUsage.PercpuUsage))
					}
					if numCPU == 0 {
						numCPU = 1.0
					}
					// Simple approximation: total usage / system time
					if containerStats.CPUStats.SystemUsage > 0 {
						cpuPercent := (float64(containerStats.CPUStats.CPUUsage.TotalUsage) /
							float64(containerStats.CPUStats.SystemUsage)) * numCPU * 100.0
						containerMetric.CPUPercent = cpuPercent
					}
				}

				// Memory stats
				containerMetric.MemoryUsage = containerStats.MemoryStats.Usage
				containerMetric.MemoryLimit = containerStats.MemoryStats.Limit

				// Network stats
				for _, network := range containerStats.Networks {
					containerMetric.NetworkRx += network.RxBytes
					containerMetric.NetworkTx += network.TxBytes
				}

				// Block I/O stats
				for _, blkio := range containerStats.BlkioStats.IoServiceBytesRecursive {
					if blkio.Op == "read" {
						containerMetric.BlockRead += blkio.Value
					} else if blkio.Op == "write" {
						containerMetric.BlockWrite += blkio.Value
					}
				}
			}
			stats.Body.Close()
		}

		metrics.Containers = append(metrics.Containers, containerMetric)
	}

	return metrics, nil
}

func readStats(resp *types.ContainerStats, stats *types.StatsJSON) error {
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	return json.Unmarshal(body, stats)
}
