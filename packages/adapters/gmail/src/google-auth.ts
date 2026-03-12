/**
 * Creates the OAuth client used by the Gmail adapter.
 * Credentials come from the shared environment loader.
 */
import { google } from "googleapis";
import type { GmailEnv } from "../../../contracts/src";

export function getGoogleAuth(env: GmailEnv) {
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

  return auth;
}
