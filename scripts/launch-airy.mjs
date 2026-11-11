/** Launcher do atalho Windows — sobe o Airy mesmo depois de fechar. */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

function run(cmd, args) {
  return new Promise((resolveP, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: true,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) =>
      code === 0 ? resolveP() : reject(new Error(`${cmd} exit ${code}`)),
    );
  });
}

async function main() {
  console.log("Airy →", ROOT);
  if (!existsSync("node_modules")) {
    console.log("Instalando dependências…");
    await run("npm", ["install"]);
  }
  // packages precisam estar buildados
  await run("npm", ["run", "build", "-w", "@airy/voice"]).catch(() => {});
  await run("npm", ["run", "build", "-w", "@airy/agent"]).catch(() => {});
  console.log("Abrindo Airy (npm run dev)…");
  await run("npm", ["run", "dev"]);
}

main().catch((e) => {
  console.error(e);
  console.log("\nSe falhar: abra o Cursor nesta pasta e rode npm run dev");
  process.exit(1);
});
