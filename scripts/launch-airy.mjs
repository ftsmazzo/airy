/** Launcher do atalho Windows/Linux. */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

async function main() {
  if (!existsSync("node_modules")) {
    await run("npm", ["install"]);
    await run("npm", ["run", "build", "-w", "@airy/voice"]);
    await run("npm", ["run", "build", "-w", "@airy/agent"]);
  }
  await run("npm", ["run", "dev"], { stdio: "inherit" });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolveP, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      shell: true,
      stdio: opts.stdio || "inherit",
      ...opts,
    });
    child.on("exit", (code) => (code === 0 ? resolveP() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
