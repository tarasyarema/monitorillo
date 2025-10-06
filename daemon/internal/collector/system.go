package collector

import (
	"context"
	"fmt"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type SystemMetrics struct {
	CPU     CPUMetrics     `json:"cpu"`
	Memory  MemoryMetrics  `json:"memory"`
	Disk    DiskMetrics    `json:"disk"`
	Network NetworkMetrics `json:"network"`
}

type CPUMetrics struct {
	UsagePercent float64   `json:"usage_percent"`
	PerCore      []float64 `json:"per_core"`
	LoadAvg      []float64 `json:"load_avg"`
}

type MemoryMetrics struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	Available   uint64  `json:"available"`
}

type DiskMetrics struct {
	Partitions map[string]PartitionMetrics `json:"partitions"`
}

type PartitionMetrics struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	Free        uint64  `json:"free"`
	Mountpoint  string  `json:"mountpoint"`
}

type NetworkMetrics struct {
	BytesSent   uint64                   `json:"bytes_sent"`
	BytesRecv   uint64                   `json:"bytes_recv"`
	Interfaces  map[string]InterfaceStats `json:"interfaces"`
}

type InterfaceStats struct {
	BytesSent   uint64 `json:"bytes_sent"`
	BytesRecv   uint64 `json:"bytes_recv"`
	PacketsSent uint64 `json:"packets_sent"`
	PacketsRecv uint64 `json:"packets_recv"`
}

func CollectSystemMetrics(ctx context.Context) (*SystemMetrics, error) {
	metrics := &SystemMetrics{}

	// CPU metrics
	cpuPercent, err := cpu.PercentWithContext(ctx, 0, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get CPU percent: %w", err)
	}
	if len(cpuPercent) > 0 {
		metrics.CPU.UsagePercent = cpuPercent[0]
	}

	// Per-core CPU
	perCore, err := cpu.PercentWithContext(ctx, 0, true)
	if err == nil {
		metrics.CPU.PerCore = perCore
	}

	// Load average (platform specific - skip for now)
	// On Linux, this would typically read from /proc/loadavg
	metrics.CPU.LoadAvg = []float64{0, 0, 0}

	// Memory metrics
	memInfo, err := mem.VirtualMemoryWithContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get memory info: %w", err)
	}
	metrics.Memory = MemoryMetrics{
		Total:       memInfo.Total,
		Used:        memInfo.Used,
		UsedPercent: memInfo.UsedPercent,
		Available:   memInfo.Available,
	}

	// Disk metrics
	partitions, err := disk.PartitionsWithContext(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get disk partitions: %w", err)
	}

	metrics.Disk.Partitions = make(map[string]PartitionMetrics)
	for _, partition := range partitions {
		usage, err := disk.UsageWithContext(ctx, partition.Mountpoint)
		if err != nil {
			continue // Skip partitions we can't read
		}

		metrics.Disk.Partitions[partition.Mountpoint] = PartitionMetrics{
			Total:       usage.Total,
			Used:        usage.Used,
			UsedPercent: usage.UsedPercent,
			Free:        usage.Free,
			Mountpoint:  partition.Mountpoint,
		}
	}

	// Network metrics
	netIO, err := net.IOCountersWithContext(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get network IO: %w", err)
	}

	if len(netIO) > 0 {
		metrics.Network.BytesSent = netIO[0].BytesSent
		metrics.Network.BytesRecv = netIO[0].BytesRecv
	}

	// Per-interface network stats
	perInterface, err := net.IOCountersWithContext(ctx, true)
	if err == nil {
		metrics.Network.Interfaces = make(map[string]InterfaceStats)
		for _, iface := range perInterface {
			metrics.Network.Interfaces[iface.Name] = InterfaceStats{
				BytesSent:   iface.BytesSent,
				BytesRecv:   iface.BytesRecv,
				PacketsSent: iface.PacketsSent,
				PacketsRecv: iface.PacketsRecv,
			}
		}
	}

	return metrics, nil
}
