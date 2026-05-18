# Template Defaults

Use these defaults only as starting points. Prefer values discovered from the project.

| Template | Port | Web command |
| --- | ---: | --- |
| `vite-app` | 5173 | `npm run dev -- --host 127.0.0.1` |
| `next-app` | 3000 | `npm run dev -- --hostname 127.0.0.1` |
| `static-site` | 4173 | `npx http-server . -a 127.0.0.1 -p 4173` |
| `app-plus-api` | 5173 + API 3001 | `npm run dev -- --host 127.0.0.1` and `PORT=3001 npm run dev:api` |

Generated GitHub Actions workflows should keep the default cost controls unless the project requires broader coverage: base-branch triggers, `concurrency.cancel-in-progress`, a 10 minute timeout, and generated path filters. Use `--workflow-path` for shared monorepo packages and `--workflow-all-changes` only when every file change should run browser smoke.
