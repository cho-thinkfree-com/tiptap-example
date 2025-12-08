#!/bin/bash

# ododocs Infrastructure Management Script
# Usage: ./manage.sh [command]

set -e

# Configuration
APP_NAME="ododocs"
BASE_DIR="$(pwd)"
VOLUMES_DIR="$HOME/volumes/$APP_NAME"
ENV_FILE="$BASE_DIR/.env"
COMPOSE_FILE="$BASE_DIR/compose.prod.yaml"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$APP_NAME]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed."
        exit 1
    fi
}

init() {
    log "Initializing infrastructure..."
    
    # Create volume directories
    log "Creating volume directories at $VOLUMES_DIR..."
    mkdir -p "$VOLUMES_DIR/postgres"
    mkdir -p "$VOLUMES_DIR/redis"
    mkdir -p "$VOLUMES_DIR/minio"
    mkdir -p "$VOLUMES_DIR/certs"
    mkdir -p "$VOLUMES_DIR/nginx_logs"
    
    # Check .env
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.prod.example" ]; then
            cp .env.prod.example .env
            warn "Created .env from .env.prod.example. PLEASE EDIT IT with your actual secrets!"
        else
            warn ".env file not found and .env.prod.example is missing."
        fi
    else
        log ".env file exists."
    fi

    log "Initialization complete. Don't forget to configure your .env file."
}

cert_issue() {
    log "Requesting Let's Encrypt Wildcard Certificate for *.ododocs.com..."
    
    if [ ! -f "$ENV_FILE" ]; then
        error ".env file missing. Run './manage.sh init' first."
        exit 1
    fi

    # Load env for checking
    source "$ENV_FILE"
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        error "CLOUDFLARE_API_TOKEN is not set in .env"
        exit 1
    fi

    # Create cloudflare.ini
    log "Creating cloudflare.ini..."
    echo "dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN" > "$BASE_DIR/cloudflare.ini"
    chmod 600 "$BASE_DIR/cloudflare.ini"

    log "Starting Certbot container..."
    # Run certbot to issue cert
    docker compose -f "$COMPOSE_FILE" run --rm certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
        --dns-cloudflare-propagation-seconds 10 \
        --email "$CLOUDFLARE_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "ododocs.com" \
        -d "*.ododocs.com" \
        --server https://acme-v02.api.letsencrypt.org/directory

    log "Certificate issuance process finished."
}

deploy() {
    log "Deploying services..."
    check_docker
    
    docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans
    
    log "Deployment completed. Checking status..."
    docker compose -f "$COMPOSE_FILE" ps
}

logs() {
    log "Streaming logs (Ctrl+C to exit)..."
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

reload_nginx() {
    log "Reloading Nginx configuration..."
    docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
    log "Nginx reloaded."
}

down() {
    log "Stopping all services..."
    docker compose -f "$COMPOSE_FILE" down
    log "Services stopped."
}

usage() {
    echo "Usage: ./manage.sh [command]"
    echo "Commands:"
    echo "  init          Create volume directories and .env template"
    echo "  cert-issue    Issue initial Let's Encrypt certificate (requires .env setup)"
    echo "  deploy        Build and start all services"
    echo "  logs          View logs of all services"
    echo "  reload-nginx  Reload Nginx (zero-downtime)"
    echo "  down          Stop all services"
}

# Main Switch
case "$1" in
    init)
        init
        ;;
    cert-issue)
        cert_issue
        ;;
    deploy)
        deploy
        ;;
    logs)
        logs
        ;;
    reload-nginx)
        reload_nginx
        ;;
    down)
        down
        ;;
    *)
        usage
        exit 1
        ;;
esac
