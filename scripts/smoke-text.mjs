import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) config({ path: envPath });

const agentUrl = pathToFileURL(
  resolve(process.cwd(), "packages/agent/dist/index.js"),
).href;

const { AiryAgent, loadEnvFromProcess } = await import(agentUrl);
const q = process.argv.slice(2).join(" ") || "O que é a CABS em Ribeirão Preto?";

const agent = new AiryAgent(loadEnvFromProcess());
await agent.ready();
const turn = await agent.handleText(q);
console.log("USER:", turn.userText || q);
console.log("AIRY:", turn.assistantText);
console.log("TOOLS:", turn.toolTrace.join(" -> ") || "(none)");
console.log("AUDIO_BYTES:", turn.audioMp3?.length || 0);
