# Deployment Checklist

## Critical: Always Rebuild Containers After Code Changes

**IMPORTANT**: When making code changes to backend or frontend, ALWAYS rebuild the Docker containers to ensure the latest code is deployed.

### Backend Changes
After modifying any backend code:
```bash
docker compose stop backend
docker compose rm -f backend
docker compose build backend --no-cache
docker compose up -d backend
```

### Frontend Changes
After modifying any frontend code:
```bash
docker compose stop frontend
docker compose rm -f frontend
docker compose build frontend --no-cache
docker compose up -d frontend
```

### Verification Steps
After rebuilding, always verify:
1. Check container is using latest image: `docker compose ps`
2. Verify code in container matches source: `docker compose exec backend cat /path/to/file.js | grep "key_identifier"`
3. Check logs for successful startup: `docker compose logs backend --tail 50`

### Why `--no-cache`?
Using `--no-cache` ensures:
- All layers are rebuilt from scratch
- No cached layers with old code are used
- Guarantees latest source code is in the container

### Common Mistakes to Avoid
- ❌ Only using `docker compose restart` (doesn't rebuild, uses old image)
- ❌ Using `docker compose build` without `--no-cache` (may use cached layers)
- ❌ Not removing container before rebuild (may reuse old container)

### Best Practice
Always follow this sequence:
1. Make code changes
2. Stop and remove container
3. Rebuild with `--no-cache`
4. Start fresh container
5. Verify code is updated

