/**
 * Shared Google OAuth client used by Google Workspace adapters.
 */
import { google } from "googleapis";
import type { GoogleOAuthEnv } from "../contracts/src";

export function getGoogleAuth(env: GoogleOAuthEnv) {
  const auth = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );

  auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });

  return auth;
}
