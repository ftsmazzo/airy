/**
 * Skills = markdown de instrução injetado no prompt.
 * Bundled (resources/skills) + pasta do usuário (~/Airy/skills ou userData).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { homedir } from "node:os";

export type SkillMeta = {
  id: string;
  label: string;
  /** bundled | user */
  source: "bundled" | "user";
  path: string;
  enabled: boolean;
};

function resourcesRoots(): string[] {
  const roots: string[] = [];
  const res = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (res) roots.push(res);
  // monorepo / cwd
  roots.push(join(process.cwd()));
  roots.push(join(process.cwd(), "../.."));
  return roots;
}

export function defaultUserSkillsDir(): string {
  return join(homedir(), "Airy", "skills");
}

function skillIdFromFile(file: string): string {
  return basename(file, extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function labelFromId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function listMdInDir(dir: string, source: "bundled" | "user"): Omit<SkillMeta, "enabled">[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .map((f) => {
        const path = join(dir, f);
        const id = skillIdFromFile(f);
        return { id, label: labelFromId(id), source, path };
      })
      .filter((s) => s.id);
  } catch {
    return [];
  }
}

/** Catálogo: bundled + user; enabledSkills vazio = todas ligadas. */
export function listSkills(opts: {
  userSkillsDir?: string;
  enabledSkills?: string[] | null;
}): SkillMeta[] {
  const userDir = opts.userSkillsDir || defaultUserSkillsDir();
  const bundled: Omit<SkillMeta, "enabled">[] = [];
  for (const root of resourcesRoots()) {
    bundled.push(...listMdInDir(join(root, "skills"), "bundled"));
  }
  // dedupe bundled by id (primeiro path ganha)
  const byId = new Map<string, Omit<SkillMeta, "enabled">>();
  for (const s of bundled) {
    if (!byId.has(s.id)) byId.set(s.id, s);
  }
  for (const s of listMdInDir(userDir, "user")) {
    byId.set(s.id, s); // user sobrescreve bundled do mesmo id
  }

  const enabledSet =
    Array.isArray(opts.enabledSkills) && opts.enabledSkills.length > 0
      ? new Set(opts.enabledSkills)
      : null;

  return [...byId.values()]
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
    .map((s) => ({
      ...s,
      enabled: enabledSet ? enabledSet.has(s.id) : true,
    }));
}

/** Texto concatenado das skills ligadas (cap por skill). */
export function loadEnabledSkillsMarkdown(opts: {
  userSkillsDir?: string;
  enabledSkills?: string[] | null;
  maxCharsPerSkill?: number;
}): string {
  const max = opts.maxCharsPerSkill ?? 6000;
  const skills = listSkills(opts).filter((s) => s.enabled);
  if (!skills.length) return "";
  const parts: string[] = [];
  for (const s of skills) {
    try {
      let text = readFileSync(s.path, "utf8").trim();
      if (text.length > max) text = `${text.slice(0, max)}\n…`;
      parts.push(`### Skill: ${s.label} (\`${s.id}\`)\n\n${text}`);
    } catch {
      /* skip */
    }
  }
  return parts.join("\n\n");
}

/** Copia .md para a pasta de skills do usuário. */
export function importSkillFile(
  sourcePath: string,
  userSkillsDir?: string,
): { ok: true; meta: SkillMeta } | { ok: false; error: string } {
  const dir = userSkillsDir || defaultUserSkillsDir();
  const ext = extname(sourcePath).toLowerCase();
  if (ext !== ".md") return { ok: false, error: "Só arquivos .md" };
  const id = skillIdFromFile(sourcePath);
  if (!id) return { ok: false, error: "Nome de skill inválido" };
  try {
    mkdirSync(dir, { recursive: true });
    const dest = join(dir, `${id}.md`);
    copyFileSync(sourcePath, dest);
    // sanity size
    const text = readFileSync(dest, "utf8");
    if (text.length > 200_000) {
      writeFileSync(dest, text.slice(0, 200_000), "utf8");
    }
    return {
      ok: true,
      meta: {
        id,
        label: labelFromId(id),
        source: "user",
        path: dest,
        enabled: true,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function ensureUserSkillsDir(dir?: string): string {
  const d = dir || defaultUserSkillsDir();
  mkdirSync(d, { recursive: true });
  return d;
}
