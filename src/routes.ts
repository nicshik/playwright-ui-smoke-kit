import type { RouteSpec } from "./types.js";

export function parseRoute(value: string): RouteSpec {
  const [path, ...markerParts] = value.split("::");
  const marker = markerParts.join("::").trim();

  if (!path?.startsWith("/")) {
    throw new Error(`Route must start with "/": ${value}`);
  }
  if (!marker) {
    throw new Error(`Route must use "/path::Visible marker" format: ${value}`);
  }

  return { path: path.trim(), marker };
}

export function parseRoutes(values: string[] | undefined, defaults: RouteSpec[]) {
  if (!values?.length) return defaults;
  return values.map(parseRoute);
}
