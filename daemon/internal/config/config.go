package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	ServerName string     `yaml:"server_name"`
	APIConfig  APIConfig  `yaml:"api"`
	Interval   int        `yaml:"interval"` // Collection interval in seconds
}

type APIConfig struct {
	URL    string `yaml:"url"`
	APIKey string `yaml:"api_key"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	// Set defaults
	if cfg.Interval == 0 {
		cfg.Interval = 30
	}

	return &cfg, nil
}
