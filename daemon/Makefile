.PHONY: build clean test install

BINARY_NAME=monitorillo-daemon
BUILD_DIR=bin

build:
	@echo "Building daemon..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/daemon

build-linux:
	@echo "Building for Linux..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/daemon

clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@go clean

test:
	@echo "Running tests..."
	go test -v ./...

install: build
	@echo "Installing (requires sudo)..."
	@sudo ./install.sh

deps:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

run: build
	@echo "Running daemon..."
	@./$(BUILD_DIR)/$(BINARY_NAME) -config configs/config.example.yaml

.DEFAULT_GOAL := build
