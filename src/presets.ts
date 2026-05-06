import { runScriptCommand } from "./package-manager.js";
import type { PackageManager, RouteSpec, TemplateName } from "./types.js";

export interface TemplatePreset {
  name: TemplateName;
  webCommand: string;
  webPort: number;
  routes: RouteSpec[];
  apiCommand?: string;
  apiUrl?: string;
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
        apiCommand: `PORT=3001 ${runScriptCommand(manager, "dev:api")}`,
        apiUrl: "http://127.0.0.1:3001/api/health",
        routes: [
          { path: "/", marker: "Home" },
          { path: "/dashboard", marker: "Dashboard" },
        ],
      };
    case "static-site":
      return {
        name,
        webCommand: "npx http-server . -a 127.0.0.1 -p 4173",
        webPort: 4173,
        routes: [{ path: "/", marker: "Home" }],
      };
  }
}

export function assertTemplateName(value: string): asserts value is TemplateName {
  if (!templateNames.includes(value as TemplateName)) {
    throw new Error(`Unsupported template: ${value}`);
  }
}
