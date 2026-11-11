/**
 * Cria atalho "Airy" na Área de Trabalho com ícone Jarvis.
 * Mac: Airy.app | Windows: Airy.lnk
 */
import { existsSync, mkdirSync, writeFileSync, copyFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ICON_PNG = join(ROOT, "apps/desktop/assets/icon.png");
const ICON_JPG = join(ROOT, "apps/desktop/assets/icon.jpg");
const iconSrc = existsSync(ICON_PNG) ? ICON_PNG : ICON_JPG;

if (!existsSync(iconSrc)) {
  console.error("Ícone não encontrado em apps/desktop/assets/");
  process.exit(1);
}

const desktop = join(homedir(), "Desktop");
const desktopPt = join(homedir(), "Área de Trabalho");
const desktopDir = existsSync(desktop) ? desktop : existsSync(desktopPt) ? desktopPt : desktop;

function macShortcut() {
  const appPath = join(desktopDir, "Airy.app");
  const contents = join(appPath, "Contents");
  const macos = join(contents, "MacOS");
  const resources = join(contents, "Resources");
  mkdirSync(macos, { recursive: true });
  mkdirSync(resources, { recursive: true });

  const launcher = `#!/bin/bash
cd "${ROOT}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ ! -d node_modules ]]; then
  osascript -e 'display notification "Instalando dependências do Airy…" with title "Airy"'
  npm install
  npm run build -w @airy/voice
  npm run build -w @airy/agent
fi
exec npm run dev
`;
  const bin = join(macos, "Airy");
  writeFileSync(bin, launcher, "utf8");
  chmodSync(bin, 0o755);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>Airy</string>
  <key>CFBundleIdentifier</key><string>com.fabriai.airy</string>
  <key>CFBundleName</key><string>Airy</string>
  <key>CFBundleDisplayName</key><string>Airy</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key>
  <string>Airy precisa do microfone para ouvir comandos de voz e palmas.</string>
</dict>
</plist>
`;
  writeFileSync(join(contents, "Info.plist"), plist, "utf8");

  // Gera .icns a partir do PNG (sips + iconutil)
  const iconset = join(resources, "AppIcon.iconset");
  mkdirSync(iconset, { recursive: true });
  const workPng = join(resources, "_icon.png");
  copyFileSync(iconSrc, workPng);
  try {
    execFileSync("sips", ["-s", "format", "png", workPng, "--out", workPng], { stdio: "ignore" });
  } catch {
    /* já é png/jpg */
  }
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const s of sizes) {
    const out = join(iconset, `icon_${s}x${s}.png`);
    const out2 = join(iconset, `icon_${s}x${s}@2x.png`);
    try {
      execFileSync("sips", ["-z", String(s), String(s), workPng, "--out", out], { stdio: "ignore" });
      execFileSync("sips", ["-z", String(s * 2), String(s * 2), workPng, "--out", out2], {
        stdio: "ignore",
      });
    } catch {
      copyFileSync(workPng, out);
    }
  }
  try {
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", join(resources, "AppIcon.icns")], {
      stdio: "ignore",
    });
  } catch {
    copyFileSync(iconSrc, join(resources, "AppIcon.icns"));
  }

  console.log(`OK  Atalho Mac: ${appPath}`);
  console.log("    Duplo clique na Área de Trabalho → sobe o Airy.");
}

function winShortcut() {
  // gera .ico real para o Explorer
  spawnSync(process.execPath, [join(ROOT, "scripts/make-icon-ico.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  const ico = join(ROOT, "apps/desktop/assets/icon.ico");
  const iconPath = existsSync(ico) ? ico : iconSrc;

  const bat = join(desktopDir, "Airy.bat");
  const batBody = `@echo off
title Airy
cd /d "${ROOT}"
where npm >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Instale Node 20+ e tente de novo.
  pause
  exit /b 1
)
node scripts\\launch-airy.mjs
if errorlevel 1 pause
`;
  writeFileSync(bat, batBody, "utf8");

  const lnk = join(desktopDir, "Airy.lnk");
  const ps = `
$W = New-Object -ComObject WScript.Shell
$S = $W.CreateShortcut('${lnk.replace(/'/g, "''")}')
$S.TargetPath = '${bat.replace(/'/g, "''")}'
$S.WorkingDirectory = '${ROOT.replace(/'/g, "''")}'
$S.IconLocation = '${iconPath.replace(/'/g, "''")},0'
$S.Description = 'Airy — agente de voz Jarvis'
$S.WindowStyle = 7
$S.Save()
`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    console.log(`OK  Fallback: use o Airy.bat na Área de Trabalho (${bat})`);
    return;
  }
  console.log(`OK  Atalho Windows: ${lnk}`);
  console.log(`OK  Launcher:       ${bat}`);
}

if (process.platform === "darwin") macShortcut();
else if (process.platform === "win32") winShortcut();
else {
  // Linux: .desktop
  const desk = join(desktopDir, "Airy.desktop");
  writeFileSync(
    desk,
    `[Desktop Entry]
Type=Application
Name=Airy
Comment=Agente de voz Airy
Exec=bash -lc 'cd "${ROOT}" && npm run dev'
Icon=${iconSrc}
Terminal=false
Categories=Utility;
`,
    "utf8",
  );
  chmodSync(desk, 0o755);
  console.log(`OK  Atalho Linux: ${desk}`);
}
