import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { createClapState, feedClapEnergy, DEFAULT_CLAP_CONFIG } = await import(
  pathToFileURL(resolve("packages/voice/dist/clap.js")).href
);

const cfg = DEFAULT_CLAP_CONFIG;
const state = createClapState();
let woke = false;
for (let t = 0; t < 500; t += 16) feedClapEnergy(state, 0.02, t, cfg);
woke = feedClapEnergy(state, 0.55, 600, cfg) || woke;
feedClapEnergy(state, 0.02, 650, cfg);
woke = feedClapEnergy(state, 0.6, 900, cfg) || woke;

if (!woke) {
  console.error("FAIL: esperado wake em 2 palmas");
  process.exit(1);
}

let woke2 = false;
feedClapEnergy(state, 0.02, 950, cfg);
woke2 = feedClapEnergy(state, 0.7, 1100, cfg) || woke2;
feedClapEnergy(state, 0.02, 1150, cfg);
woke2 = feedClapEnergy(state, 0.7, 1400, cfg) || woke2;
if (woke2) {
  console.error("FAIL: não deveria acordar no cooldown");
  process.exit(1);
}

console.log("PASS clap detector (2 palmas + cooldown)");
