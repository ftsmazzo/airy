/**
 * Gera icon.ico a partir de icon.png/jpg (Windows atalho).
 * Sem dependência extra: ICO BMP-in-ICO mínimo 256x256 via PowerShell se possível,
 * senão copia referência e o .lnk aponta pro png.
 */
import { existsSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(ROOT, "apps/desktop/assets");
const src = existsSync(join(assets, "icon.png"))
  ? join(assets, "icon.png")
  : join(assets, "icon.jpg");
const ico = join(assets, "icon.ico");

if (!existsSync(src)) {
  console.error("Sem icon.png/jpg");
  process.exit(1);
}

if (process.platform === "win32") {
  const ps = `
Add-Type -AssemblyName System.Drawing
$src = '${src.replace(/'/g, "''")}'
$dst = '${ico.replace(/'/g, "''")}'
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(2,4,10))
$g.DrawImage($img, 0, 0, 256, 256)
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$fs = [System.IO.File]::Create($dst)
$icon.Save($fs)
$fs.Close()
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
`;
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if (r.status === 0 && existsSync(ico)) {
    console.log("OK icon.ico", ico);
    process.exit(0);
  }
  console.warn("PowerShell ICO falhou, mantendo png para o atalho:", r.stderr || r.stdout);
}

// fallback: não é ICO real, mas evita crash do script
if (!existsSync(ico)) copyFileSync(src, ico);
console.log("icon path:", existsSync(ico) ? ico : src);
