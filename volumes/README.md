# Volumes Directory

This directory contains persistent data for Docker containers.

- `postgres/`: PostgreSQL data directory.
- `minio/`: MinIO object storage data.

**Note**: This directory is ignored by git, except for this README file.
To clear all data, you can delete the contents of this directory (except README.md) or run `docker compose -f infra-local.yml down -v`.

## Adding New Services (Redis, RabbitMQ, etc.)
If you add new services (like Redis or RabbitMQ) and mount them here, you might encounter **permission issues**. This happens because many containers run as a specific user (not root), but Docker might create the mounted directory as `root`.

**Solutions:**
1.  **Let Docker create it**: Often works if the container starts as root and drops privileges (fixing permissions itself).
2.  **Pre-create with open permissions**:
    ```bash
    mkdir volumes/redis
    chmod 777 volumes/redis
    ```
3.  **Check logs**: If a container exits immediately, check `docker compose logs <service>`. If it says "Permission denied", use solution #2.

> [!WARNING]
> **Avoid `chmod -R 777 volumes/`**
> While it seems convenient to give full permissions to everyone, some services (like **PostgreSQL**) have strict security checks.
> If the Postgres data directory has "group" or "world" write permissions, **Postgres will refuse to start**.
> It is better to only open permissions for specific directories that need it (like Redis or generic file storage), rather than the entire `volumes` folder recursively.

## Convention for Future Services
**All Docker services requiring persistent storage MUST mount their data volumes within this `volumes/` directory.**

When adding new services (e.g., Redis, RabbitMQ), follow this pattern in `infra-local.yml`:
- **Redis**: `./volumes/redis:/data`
- **RabbitMQ**: `./volumes/rabbitmq:/var/lib/rabbitmq`

