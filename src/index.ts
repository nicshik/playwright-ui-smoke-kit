export { addRouteToSpec } from "./add-route.js";
export { checkBrowserTaskArtifact, initBrowserTaskArtifact, runBrowserTaskArtifact } from "./artifact.js";
export { doctorProject } from "./doctor.js";
export { detectProjectDefaults } from "./framework.js";
export { initProject } from "./init.js";
export { commandsForPackageManager, detectPackageManager } from "./package-manager.js";
export { getTemplatePreset, templateNames } from "./presets.js";
export { parseRoute, parseRoutes } from "./routes.js";
export { renderGithubWorkflow, renderPlaywrightConfig, renderUiSmokeSpec } from "./render.js";
export { installSkill, installSkills } from "./skills.js";
export type { DoctorCheck, DoctorStatus } from "./doctor.js";
export type {
  ArtifactCheck,
  ArtifactCheckResult,
  ArtifactCheckStatus,
  ArtifactInitOptions,
  ArtifactInitResult,
  ArtifactRunOptions,
  ArtifactRunResult,
  ArtifactScriptExt,
} from "./artifact.js";
export type { CiProvider, InitOptions, InitResult, PackageManager, RouteSpec, TemplateName } from "./types.js";
export type { InstallSkillOptions, InstallSkillsOptions, SkillInstallPaths, SkillKind, SkillSelection, SkillTarget } from "./skills.js";
