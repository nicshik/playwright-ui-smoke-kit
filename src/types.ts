export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type TemplateName = "vite-app" | "next-app" | "app-plus-api" | "static-site";

export type CiProvider = "github" | "none";

export interface RouteSpec {
  path: string;
  marker: string;
}

export interface WebServerSpec {
  command: string;
  url: string;
  env?: Record<string, string>;
}

export interface InitOptions {
  repoRoot?: string;
  appDir: string;
  template?: TemplateName;
  packageManager?: PackageManager;
  webCommand?: string;
  webPort?: number;
  apiCommand?: string;
  apiUrl?: string;
  routes?: string[];
  scriptName?: string;
  testDir?: string;
  workflowName?: string;
  webEnv?: string[];
  apiEnv?: string[];
  ci?: CiProvider;
  dryRun?: boolean;
  force?: boolean;
  yes?: boolean;
  skipInstall?: boolean;
}

export interface InitResult {
  repoRoot: string;
  appDir: string;
  packageManager: PackageManager;
  template: TemplateName;
  scriptName: string;
  testDir: string;
  files: string[];
  packageJsonUpdated: boolean;
  installCommand?: string;
  dryRun: boolean;
}
