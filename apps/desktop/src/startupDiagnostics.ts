import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import log from 'electron-log/main';

export type StartupStage =
  | 'boot'
  | 'app-ready'
  | 'database-init'
  | 'ipc-registration'
  | 'startup-recovery'
  | 'worker-start'
  | 'settings-init'
  | 'window-create'
  | 'preload'
  | 'renderer-load'
  | 'renderer-bootstrap'
  | 'ready'
  | 'failed';

export interface StartupFailurePayload {
  title: string;
  message: string;
  stage: string;
  stack?: string;
  diagnosticsPath?: string;
}

type StartupEvent = {
  ts: string;
  stage: string;
  event: string;
  details?: Record<string, unknown>;
};

const state = {
  currentStage: 'boot' as StartupStage | string,
  events: [] as StartupEvent[],
  lastFailure: null as StartupFailurePayload | null,
};

function diagnosticsDir(): string {
  return path.join(app.getPath('userData'), 'diagnostics');
}

export function getStartupDiagnosticsPath(): string {
  return path.join(diagnosticsDir(), 'startup-report.json');
}

export function recordStartupEvent(stage: StartupStage | string, event: string, details?: Record<string, unknown>): void {
  state.currentStage = stage;
  const entry: StartupEvent = { ts: new Date().toISOString(), stage, event, details };
  state.events.push(entry);
  const suffix = details ? ` ${JSON.stringify(details)}` : '';
  log.info(`[startup:${stage}] ${event}${suffix}`);
}

export function markStartupFailure(payload: Omit<StartupFailurePayload, 'diagnosticsPath'>): StartupFailurePayload {
  const failure: StartupFailurePayload = {
    ...payload,
    diagnosticsPath: getStartupDiagnosticsPath(),
  };
  state.lastFailure = failure;
  recordStartupEvent('failed', payload.title, {
    message: payload.message,
    stack: payload.stack,
    stage: payload.stage,
  });
  return failure;
}

export function getStartupDiagnostics() {
  return {
    generatedAt: new Date().toISOString(),
    currentStage: state.currentStage,
    app: {
      packaged: app.isPackaged,
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      resourcesPath: process.resourcesPath,
    },
    paths: {
      userData: app.getPath('userData'),
      logs: app.getPath('logs'),
      diagnostics: diagnosticsDir(),
    },
    failure: state.lastFailure,
    events: state.events,
  };
}

export function writeStartupDiagnostics(): string {
  const outPath = getStartupDiagnosticsPath();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(getStartupDiagnostics(), null, 2), 'utf8');
  return outPath;
}
