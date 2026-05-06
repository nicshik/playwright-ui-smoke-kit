# Templates

Templates are starter presets. They set default commands, ports, and route markers, but every value can be overridden from the CLI.

## `vite-app`

Default web command:

```bash
npm run dev -- --host 127.0.0.1
```

Default port: `5173`.

## `next-app`

Default web command:

```bash
npm run dev -- --hostname 127.0.0.1
```

Default port: `3000`.

## `app-plus-api`

Starts a web app and an API server through Playwright `webServer`.

Defaults:

```bash
npm run dev -- --host 127.0.0.1
PORT=3001 npm run dev:api
```

API health URL:

```text
http://127.0.0.1:3001/api/health
```

Override both values for real projects:

```bash
npx playwright-ui-smoke-kit init \
  --template app-plus-api \
  --api-command "PORT=3001 npm run api" \
  --api-url "http://127.0.0.1:3001/health"
```

## `static-site`

Default command:

```bash
node tests/static-server.mjs
```

Default port: `4173`.

The kit generates `tests/static-server.mjs`, so this template does not require `http-server` or any other external static server dependency.

## Auto-detection

When `--template` is omitted, the CLI inspects dependencies and config files:

- `next` -> `next-app`;
- `astro` -> Vite-style command on port `4321`;
- `@sveltejs/kit` -> Vite-style command on port `5173`;
- `nuxt` -> Vite-style command on port `3000`;
- `vite` or `vite.config.*` -> `vite-app`;
- otherwise `vite-app`.
