import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { STATE_DIR } from "./constants.js";

export const GITHUB_CLIENT_ID = "Ov23lihLeOlzBtN5di4E";
export const GITHUB_CLIENT_SECRET =
  "c593ee8eaeae73a1dca655bad285e7a2ff657261";

export function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    console.log("[github] Using GITHUB_TOKEN from environment variable");
    return process.env.GITHUB_TOKEN;
  }

  const oauthPath = path.join(STATE_DIR, "github-oauth.json");
  if (fs.existsSync(oauthPath)) {
    try {
      const oauth = JSON.parse(fs.readFileSync(oauthPath, "utf8"));
      if (oauth.access_token) return oauth.access_token;
    } catch {}
  }

  const dashboardOAuthPath = path.join(
    os.homedir(),
    ".openclaw",
    "github-oauth.json",
  );
  if (fs.existsSync(dashboardOAuthPath)) {
    try {
      const oauth = JSON.parse(fs.readFileSync(dashboardOAuthPath, "utf8"));
      if (oauth.access_token) return oauth.access_token;
    } catch {}
  }

  const cfgPath = path.join(STATE_DIR, "github.json");
  if (fs.existsSync(cfgPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (config.token) return config.token;
    } catch {}
  }

  return process.env.GITHUB_TOKEN?.trim() || "";
}

// Start GitHub device flow -- returns { device_code, user_code, verification_uri, ... }
export async function startDeviceAuth() {
  const response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      scope: "repo read:user",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${errorText}`);
  }

  return response.json();
}

// Poll for device auth completion
export async function pollDeviceAuth(deviceCode) {
  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${errorText}`);
  }

  return response.json();
}

// Fetch user info and persist OAuth token
export async function completeDeviceAuth(tokenData) {
  if (tokenData.error) {
    return { status: tokenData.error === "authorization_pending" ? "pending" : "error", error: tokenData.error };
  }

  const accessToken = tokenData.access_token;
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    return { status: "error", error: "Failed to fetch user info" };
  }

  const userData = await userRes.json();
  const username = userData.login;

  fs.mkdirSync(STATE_DIR, { recursive: true });
  const oauthData = {
    access_token: accessToken,
    token_type: tokenData.token_type || "bearer",
    scope: tokenData.scope || "repo,read:user",
    username,
    connected_at: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(STATE_DIR, "github-oauth.json"),
    JSON.stringify(oauthData, null, 2),
    { mode: 0o600 },
  );

  return { status: "success", access_token: accessToken, username };
}

// Fetch repos for the authenticated user
export async function fetchRepos(token) {
  let repos = [];

  try {
    const installRes = await fetch(
      "https://api.github.com/installation/repositories?per_page=100",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (installRes.ok) {
      const installData = await installRes.json();
      if (installData.repositories?.length > 0) {
        repos = installData.repositories;
      }
    }
  } catch {}

  if (repos.length === 0) {
    const userRes = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!userRes.ok) {
      throw new Error(`GitHub API error: ${userRes.statusText}`);
    }
    repos = await userRes.json();
  }

  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name || `${repo.owner?.login}/${repo.name}`,
    owner: repo.owner?.login || "",
    private: repo.private,
    default_branch: repo.default_branch,
    html_url: repo.html_url,
    description: repo.description || "",
    language: repo.language || "",
  }));
}
