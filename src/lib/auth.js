import crypto from "node:crypto";
import fs from "node:fs";
import { SETUP_PASSWORD } from "./constants.js";
import { configPath, getClientDomain } from "./config.js";

let telegramBotUsername = null;
let telegramBotId = null;

export async function getTelegramBotInfo() {
  if (telegramBotUsername && telegramBotId) return { username: telegramBotUsername, id: telegramBotId };
  try {
    const config = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    const botToken = config?.channels?.telegram?.botToken;
    if (!botToken) return { username: null, id: null };
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      telegramBotUsername = data.result.username;
      telegramBotId = String(data.result.id);
      return { username: telegramBotUsername, id: telegramBotId };
    }
  } catch (e) {
    console.error('[auth] Failed to get bot info:', e.message);
  }
  return { username: null, id: null };
}

export async function getTelegramBotUsername() {
  const info = await getTelegramBotInfo();
  return info.username;
}

export function verifyTelegramWidget(data, botToken) {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return hmac === hash;
}

export function requireSetupAuth(req, res, next) {
  const clientDomain = getClientDomain();
  const host = req.hostname?.toLowerCase();
  if (clientDomain && host === `gerald.${clientDomain}`) {
    return next();
  }

  if (!SETUP_PASSWORD) {
    return res
      .status(500)
      .type("text/plain")
      .send(
        "SETUP_PASSWORD is not set. Set it in Railway Variables before using /setup.",
      );
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Openclaw Setup"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (password !== SETUP_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Openclaw Setup"');
    return res.status(401).send("Invalid password");
  }
  return next();
}
