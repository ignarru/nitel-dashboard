import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { JWT } from "google-auth-library";

const TOKEN_PATH = path.join(process.cwd(), "secrets", "oauth-token.json");
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

/**
 * Si GOOGLE_SA_JSON + IMPERSONATE_EMAIL están seteados, usamos Service Account
 * con domain-wide delegation (producción). Si no, OAuth con refresh token (dev).
 */
function usarServiceAccount(): boolean {
  return !!(process.env.GOOGLE_SA_JSON?.trim() && process.env.IMPERSONATE_EMAIL?.trim());
}

/** Cliente JWT de la Service Account, impersonando IMPERSONATE_EMAIL. */
function buildServiceAccountClient(): JWT {
  const saPath = process.env.GOOGLE_SA_JSON!.trim();
  const impersonate = process.env.IMPERSONATE_EMAIL!.trim();
  const absPath = path.isAbsolute(saPath) ? saPath : path.join(process.cwd(), saPath);
  const key = JSON.parse(fsSync.readFileSync(absPath, "utf-8"));
  return new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: impersonate, // la casilla que "se hace pasar"
  });
}

function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI en .env.local",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function loadTokens(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveTokens(tokens: unknown): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf-8");
}

/** Devuelve el cliente autorizado o null si todavía no hay tokens. */
export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const client = buildOAuthClient();
  const tokens = await loadTokens();
  if (!tokens) return null;
  client.setCredentials(tokens);
  // Refrescar y persistir si Google nos devuelve un nuevo refresh_token
  client.on("tokens", (t) => {
    void saveTokens({ ...tokens, ...t });
  });
  return client;
}

export function getAuthUrl(): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // fuerza refresh_token incluso en re-auth
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const client = buildOAuthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
}

export async function isAuthorized(): Promise<boolean> {
  // Con Service Account no hace falta flujo interactivo: si está configurada, ok
  if (usarServiceAccount()) return true;
  const tokens = await loadTokens();
  return tokens !== null;
}

function encodeRFC2047(s: string): string {
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}): Promise<{ messageId: string; threadId: string }> {
  const auth: OAuth2Client | JWT | null = usarServiceAccount()
    ? buildServiceAccountClient()
    : await getAuthorizedClient();
  if (!auth) throw new Error("Gmail no está autorizado todavía. Andá a /api/auth/google/init");

  const fromEmail = params.fromEmail ?? process.env.FROM_EMAIL ?? "";
  const fromName = params.fromName ?? process.env.FROM_NAME ?? "Nitel";
  const fromHeader = fromName ? `${encodeRFC2047(fromName)} <${fromEmail}>` : fromEmail;

  const mime = [
    `From: ${fromHeader}`,
    `To: ${params.to}`,
    `Subject: ${encodeRFC2047(params.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    params.html,
  ].join("\r\n");

  const raw = Buffer.from(mime, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    messageId: res.data.id ?? "",
    threadId: res.data.threadId ?? "",
  };
}
