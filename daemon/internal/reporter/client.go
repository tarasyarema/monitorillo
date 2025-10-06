package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/monitorillo/daemon/internal/collector"
)

type Client struct {
	apiURL     string
	apiKey     string
	serverName string
	httpClient *http.Client
}

type MetricsPayload struct {
	ServerName string                   `json:"server_name"`
	Timestamp  string                   `json:"timestamp"`
	System     *collector.SystemMetrics `json:"system"`
	Docker     *collector.DockerMetrics `json:"docker"`
}

func NewClient(apiURL, apiKey, serverName string) *Client {
	return &Client{
		apiURL:     apiURL,
		apiKey:     apiKey,
		serverName: serverName,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) SendMetrics(ctx context.Context, system *collector.SystemMetrics, docker *collector.DockerMetrics) error {
	payload := MetricsPayload{
		ServerName: c.serverName,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		System:     system,
		Docker:     docker,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.apiURL+"/api/v1/metrics", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("API returned non-2xx status: %d", resp.StatusCode)
	}

	return nil
}
