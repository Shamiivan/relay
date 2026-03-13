/**
 * Local helper for generating a Gmail OAuth URL and exchanging an auth code
 * for the refresh token Relay needs at runtime.
 */
import dotenv from "dotenv";
import { google } from "googleapis";
import { z } from "zod";

const envSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

const argsSchema = z.object({
  redirectUri: z.string().url(),
  code: z.string().min(1).optional(),
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
  });
}

async function main(): Promise<void> {
  dotenv.config({ path: "convex/.env.local", quiet: true });
  dotenv.config({ path: ".env.local", override: true, quiet: true });

  const env = envSchema.parse(process.env);
  const args = parseArgs(process.argv.slice(2));
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    args.redirectUri,
  );

  if (!args.code) {
    const url = auth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    console.log("Open this URL and complete Google consent:");
    console.log(url);
    console.log("");
    console.log(
      `Then rerun this command with --redirect-uri=${args.redirectUri} --code=YOUR_CODE`,
    );
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
