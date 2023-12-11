version = v0.1

build:
	go build -o ./bin/wikiweaver-server -ldflags="-X 'main.Version=$(version)'" ./cmd/main/wikiweaver-server.go

dev:
	go run --race ./cmd/main/wikiweaver-server.go --dev
