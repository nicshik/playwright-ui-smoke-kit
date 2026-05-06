import { runScriptCommand } from "./package-manager.js";
import type { PackageManager, RouteSpec, TemplateName } from "./types.js";

export interface TemplatePreset {
  name: TemplateName;
  webCommand: string;
  webPort: number;
  routes: RouteSpec[];
  webEnv?: Record<string, string>;
  apiCommand?: string;
  apiUrl?: string;
  apiEnv?: Record<string, string>;
  staticServer?: boolean;
}

export const templateNames: TemplateName[] = [
  "vite-app",
  "next-app",
  "app-plus-api",
  "static-site",
];

export function getTemplatePreset(name: TemplateName, manager: PackageManager): TemplatePreset {
  switch (name) {
    case "vite-app":
      return {
        name,
        webCommand: runScriptCommand(manager, "dev", "-- --host 127.0.0.1"),
        webPort: 5173,
        routes: [{ path: "/", marker: "Vite" }],
      };
    case "next-app":
      return {
        name,
        webCommand: runScriptCommand(manager, "dev", "-- --hostname 127.0.0.1"),
        webPort: 3000,
        routes: [{ path: "/", marker: "Home" }],
      };
    case "app-plus-api":
      return {
        name,
        webCommand: runScriptCommand(manager, "dev", "-- --host 127.0.0.1"),
        webPort: 5173,
        apiCommand: runScriptCommand(manager, "dev:api"),
        apiUrl: "http://127.0.0.1:3001/api/health",
        apiEnv: { PORT: "3001" },
        routes: [
          { path: "/", marker: "Home" },
          { path: "/dashboard", marker: "Dashboard" },
        ],
      };
    case "static-site":
      return {
        name,
        webCommand: "node tests/static-server.mjs",
        webPort: 4173,
        webEnv: { PORT: "4173" },
        staticServer: true,
        routes: [{ path: "/", marker: "Home" }],
      };
  }
}

export function assertTemplateName(value: string): asserts value is TemplateName {
  if (!templateNames.includes(value as TemplateName)) {
    throw new Error(`Unsupported template: ${value}`);
  }
}
