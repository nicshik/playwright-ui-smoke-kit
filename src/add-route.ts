import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseRoute } from "./routes.js";
import type { RouteSpec } from "./types.js";

function renderRoute(route: RouteSpec) {
  return `  { path: ${JSON.stringify(route.path)}, marker: ${JSON.stringify(route.marker)} }`;
}

export async function addRouteToSpec(options: {
  appDir: string;
  testDir?: string;
  route: string;
  dryRun?: boolean;
}) {
  const route = parseRoute(options.route);
  const specPath = path.join(path.resolve(options.appDir), options.testDir ?? "tests", "ui-smoke.spec.ts");
  const current = await readFile(specPath, "utf8");

  if (current.includes(`path: ${JSON.stringify(route.path)}`)) {
    return { specPath, changed: false, route };
  }

  const replacement = current.replace(
    /(const routes = \[\n)([\s\S]*?)(\n\];)/,
    (_match, start: string, body: string, end: string) => {
      const trimmedBody = body.trimEnd();
      const separator = trimmedBody.trim().length > 0 && !trimmedBody.trimEnd().endsWith(",") ? "," : "";
      return `${start}${trimmedBody}${separator}\n${renderRoute(route)},${end}`;
    },
  );

  if (replacement === current) {
    throw new Error(`Could not find generated routes array in ${specPath}`);
  }

  if (!options.dryRun) {
    await writeFile(specPath, replacement, "utf8");
  }

  return { specPath, changed: true, route };
}
