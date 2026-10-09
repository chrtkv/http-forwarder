# HTTP forwarder

Internal-only Fastify service that forwards HTTP requests to a URL supplied in a dedicated header, with source IP allowlisting.

## Warnings

- **Internal use only.** Do not expose this service to the public internet. Callers can point requests at arbitrary URLs (SSRF risk) and may put sensitive tokens in headers or encoded URLs.
- **Trust model:** Anyone who can reach the service from a whitelisted IP can trigger outbound HTTP(S) from the forwarder. Combine network controls, strict `TRUSTED_IPS`, and mutual TLS or private networking as appropriate.
- **Logging:** Full target URLs are not logged by default; only the target **hostname** is included when the forward header is present.

## Requirements

- Node.js 24+

## Configuration

Environment variables (see [`.env.example`](.env.example)):

| Variable | Description |
| -------- | ----------- |
| `PORT` | HTTP listen port (default **`3000`**). Set to any free port when another service already uses `3000` on the same host. |
| `HEARTBEAT_PATH` | Liveness path (default `/health`) |
| `FORWARD_TARGET_HEADER` | Header carrying the absolute upstream URL (default `x-forward-url`) |
| `TRUSTED_IPS` | Comma-separated IPv4/IPv6 addresses or CIDR ranges allowed to use the forwarder (`GET` on the heartbeat path is exempt) |
| `TRUST_PROXY` | Where the client IP for `TRUSTED_IPS` comes from. `false` (default): the connecting address. Comma-separated proxy addresses or CIDRs: `X-Forwarded-For` is honoured only on connections from those — use this behind a reverse proxy. `true`: honoured from anyone, so only when nothing but the proxy can reach the port |
| `UPSTREAM_TIMEOUT_MS` | Upstream request timeout |
| `MAX_BODY_BYTES` | Maximum request body size |
| `LOG_LEVEL` | Pino log level |

## Usage

Forward header must contain a full `http://` or `https://` URL. Supported methods: **GET, HEAD, POST, PUT, PATCH, DELETE**. **OPTIONS** is not supported (405).

```bash
make install
TRUSTED_IPS=127.0.0.1 make dev
```

With a `.env` file, Node 20+ can load it for local runs, e.g. `NODE_OPTIONS='--env-file=.env' pnpm dev` (or export variables from `.env` in your shell). Docker Compose loads `.env` by itself when you use `docker compose`; no extra flag.

Example:

```bash
curl -H "X-Forward-Url: https://httpbingo.org/get" http://127.0.0.1:3000/proxy-path
```

The path on the forwarder is ignored for upstream routing; only the header URL matters. Proxy-chain headers (`Forwarded`, `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Real-IP`) are not passed upstream.

## Docker

Copy [`.env.example`](.env.example) to **`.env`** in the project root and set **`PORT`** (and anything else you need). You do **not** need a separate compose key for the port: Compose [loads `.env` automatically](https://docs.docker.com/compose/environment-variables/set-environment-variables/) from the same directory as `docker-compose.yml` and uses it when expanding **`${PORT:-3000}`** (and the other `${VAR:-…}` entries) in this file. Those resolved values are what get passed into the container under `environment:`.

```bash
cp .env.example .env
# edit .env — e.g. PORT=3001 if 3000 is taken
make docker-build
make up
```

The image compiles TypeScript in a build stage (`npm run build`) and runs `node dist/server.js`; `tsx` is a dev dependency, used only by `make dev` and `make test`.

The published host port and the process listen port inside the container both follow **`PORT`** (default `3000`). Compose publishes the port on **`127.0.0.1` only**: remote clients should come through a reverse proxy on the host (TLS, client allowlist). Requests from the host reach the container from the Docker network's gateway address (e.g. `172.20.0.1`): put that address in `TRUST_PROXY`, have the proxy set `X-Forwarded-For` to the client address (nginx: `proxy_set_header X-Forwarded-For $remote_addr;`), and list the real clients in `TRUSTED_IPS`.

Compose includes an [autoheal](https://hub.docker.com/r/willfarrell/autoheal) sidecar that restarts unhealthy containers. Set `TRUSTED_IPS` to include every client that may call the forwarder. **`GET` heartbeat requests skip the IP whitelist** (other methods on that path do not), so Docker health checks do not require listing `127.0.0.1` unless you also hit other routes from localhost.

## Development

```bash
make lint
make test
```
