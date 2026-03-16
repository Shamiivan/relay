/**
 * Local helper for generating a Google Workspace OAuth URL and exchanging it
 * for the refresh token Relay needs at runtime.
 *
 * Default mode runs a local callback server and opens the browser for you.
 * Manual mode is still supported with --redirect-uri and --code.
 */
import dotenv from "dotenv";
import { google } from "googleapis";
import http from "node:http";
import { URL } from "node:url";
import { exec } from "node:child_process";
import { z } from "zod";
import { GOOGLE_WORKSPACE_SCOPES } from "./lib/google-scopes";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

const argsSchema = z.object({
  redirectUri: z.string().url().optional(),
  code: z.string().min(1).optional(),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
});

function parseArgs(argv: string[]) {
  const entries = argv
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [rawKey, ...rest] = arg.slice(2).split("=");
      return [rawKey, rest.join("=")];
    });

  const raw = Object.fromEntries(entries);

  return argsSchema.parse({
    redirectUri: raw["redirect-uri"] || process.env.GOOGLE_REDIRECT_URI,
    code: raw.code || process.env.GOOGLE_AUTH_CODE,
    port: raw.port || process.env.GOOGLE_AUTH_PORT,
  });
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";

  exec(`${cmd} "${url}"`);
}

async function main(): Promise<void> {
  dotenv.config({ path: "convex/.env.local", quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });

  const env = envSchema.parse(process.env);
  const args = parseArgs(process.argv.slice(2));
  const redirectUri = args.redirectUri ?? `http://127.0.0.1:${args.port}/oauth2callback`;
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );

  if (!args.code) {
    const url = auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_WORKSPACE_SCOPES as unknown as string[],
    });

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/oauth2callback")) {
        res.writeHead(404);
        res.end();
        return;
      }

      const callbackUrl = new URL(req.url, `http://127.0.0.1:${args.port}`);
      const code = callbackUrl.searchParams.get("code");

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Missing code parameter");
        return;
      }

      try {
        const response = await auth.getToken(code);
        const refreshToken = response.tokens.refresh_token;

        if (!refreshToken) {
          throw new Error(
            "Google did not return a refresh token. Re-run consent with prompt=consent and use a new approval.",
          );
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Relay is authorized. You can close this tab.</h1>");

        console.log("Add this to .env.local:");
        console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown token exchange error";
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Token exchange failed: ${message}`);
        throw error;
      } finally {
        server.close();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(args.port, "127.0.0.1", () => {
        console.log("Opening browser for Google consent:");
        console.log(url);
        console.log("");
        console.log(`Listening for OAuth callback on ${redirectUri}`);
        openBrowser(url);
        resolve();
      });
    });
    return;
  }

  const response = await auth.getToken(args.code);
  const refreshToken = response.tokens.refresh_token;

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Re-run consent with prompt=consent and use a new approval.",
    );
  }

  console.log("Add this to .env.local:");
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
}

void main();
