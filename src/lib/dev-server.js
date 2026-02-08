import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { DEV_DIR, DEV_SERVER_PORT } from "./constants.js";
import { runCmd } from "./helpers.js";

let devServerProcess = null;

export function getDevServerProcess() {
  return devServerProcess;
}

export async function startDevServer() {
  if (devServerProcess) return;
  if (!fs.existsSync(path.join(DEV_DIR, "package.json"))) {
    console.log("[dev-server] No package.json in dev dir, skipping");
    return;
  }

  console.log(`[dev-server] Starting on port ${DEV_SERVER_PORT}...`);

  const devBinPath = path.join(DEV_DIR, "node_modules", ".bin");
  const devEnv = {
    ...process.env,
    PATH: `${devBinPath}:${process.env.PATH}`,
    PORT: String(DEV_SERVER_PORT),
    HOST: "0.0.0.0",
    NODE_ENV: "development",
  };

  if (!fs.existsSync(path.join(DEV_DIR, "node_modules"))) {
    console.log("[dev-server] Installing dependencies...");
    await runCmd("npm", ["install"], { cwd: DEV_DIR, env: devEnv });
  }

  try {
    const lsof = childProcess
      .execSync(`lsof -ti:${DEV_SERVER_PORT} 2>/dev/null || true`)
      .toString()
      .trim();
    if (lsof) {
      console.log(
        `[dev-server] Killing stale process on port ${DEV_SERVER_PORT}: ${lsof}`,
      );
      childProcess.execSync(`kill -9 ${lsof} 2>/dev/null || true`);
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch {}

  devServerProcess = childProcess.spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--port",
      String(DEV_SERVER_PORT),
      "--host",
      "0.0.0.0",
    ],
    {
      cwd: DEV_DIR,
      env: devEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  devServerProcess.stdout.on("data", (d) =>
    console.log("[dev-server]", d.toString().trim()),
  );
  devServerProcess.stderr.on("data", (d) =>
    console.error("[dev-server]", d.toString().trim()),
  );
  devServerProcess.on("close", (code) => {
    console.log("[dev-server] Process exited with code", code);
    devServerProcess = null;
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`http://127.0.0.1:${DEV_SERVER_PORT}/`);
      if (res.ok || res.status === 304) {
        console.log("[dev-server] Ready");
        return;
      }
    } catch {}
  }
  console.warn("[dev-server] Timed out waiting for dev server to start");
}

export function stopDevServer() {
  if (!devServerProcess) return;
  console.log("[dev-server] Stopping...");
  devServerProcess.kill("SIGTERM");
  devServerProcess = null;
}

export async function restartDevServer() {
  stopDevServer();
  await new Promise((r) => setTimeout(r, 1000));
  await startDevServer();
}
