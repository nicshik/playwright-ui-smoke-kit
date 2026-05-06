# Template Defaults

Use these defaults only as starting points. Prefer values discovered from the project.

| Template | Port | Web command |
| --- | ---: | --- |
| `vite-app` | 5173 | `npm run dev -- --host 127.0.0.1` |
| `next-app` | 3000 | `npm run dev -- --hostname 127.0.0.1` |
| `static-site` | 4173 | `npx http-server . -a 127.0.0.1 -p 4173` |
| `app-plus-api` | 5173 + API 3001 | `npm run dev -- --host 127.0.0.1` and `PORT=3001 npm run dev:api` |
