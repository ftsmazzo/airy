/**
 * Pasta vigiada — avisa o renderer quando entra arquivo novo.
 */
import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import type { BrowserWindow } from "electron";

export type InboxSettings = {
  enabled: boolean;
  path: string;
  autoSummarizePdf: boolean;
};

let watcher: FSWatcher | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
const seen = new Set<string>();

export function defaultInboxPath(): string {
  return join(homedir(), "Airy", "inbox");
}

export function ensureInboxDir(path: string): string {
  const p = path?.trim() || defaultInboxPath();
  mkdirSync(p, { recursive: true });
  return p;
}

export function stopInboxWatch(): void {
  if (debounce) clearTimeout(debounce);
  debounce = null;
  try {
    watcher?.close();
  } catch {
    /* ignore */
  }
  watcher = null;
}

export function startInboxWatch(
  win: BrowserWindow | null,
  settings: InboxSettings,
): void {
  stopInboxWatch();
  if (!settings.enabled || !win || win.isDestroyed()) return;

  const dir = ensureInboxDir(settings.path);
  if (!existsSync(dir)) return;

  try {
    watcher = watch(dir, { persistent: true }, (event, filename) => {
      if (!filename) return;
      const name = filename.toString();
      if (name.startsWith(".")) return;
      const key = `${event}:${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      setTimeout(() => seen.delete(key), 2500);

      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!win || win.isDestroyed()) return;
        const full = join(dir, name);
        win.webContents.send("airy:inbox-file", {
          path: full,
          name: basename(full),
          autoSummarizePdf: settings.autoSummarizePdf,
        });
      }, 400);
    });
  } catch (e) {
    console.error("[airy] inbox watch failed", e);
  }
}
