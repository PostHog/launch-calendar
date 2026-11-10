/**
 * One-time Google sign-in for the prototype (option C in the PRD).
 * Opens a local callback, prints a sign-in URL, and prints the refresh token to put in .env.
 *
 *   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… pnpm google:auth
 */
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { auth } from "@googleapis/calendar";
import { CALENDAR_SCOPES } from "../src/google/calendar.js";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first (a Desktop app OAuth client).",
  );
  process.exit(1);
}

const state = randomBytes(16).toString("hex");
let client: InstanceType<typeof auth.OAuth2>;

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (url.searchParams.get("state") !== state || !code) {
    res.writeHead(400).end("Sign-in failed: missing code or wrong state.");
    return;
  }
  client
    .getToken(code)
    .then(({ tokens }) => {
      res.end("Signed in. You can close this tab and go back to the terminal.");
      if (!tokens.refresh_token) {
        console.error(
          "Google returned no refresh token. Remove the app's access at myaccount.google.com/permissions and run this again.",
        );
      } else {
        console.log("\nAdd this line to .env (and as a HostHog secret). Keep it private:\n");
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      }
    })
    .catch((err: unknown) => {
      res.writeHead(500).end("Sign-in failed. See the terminal.");
      console.error(err);
    })
    .finally(() => server.close());
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address() as AddressInfo;
  client = new auth.OAuth2(clientId, clientSecret, `http://127.0.0.1:${port}/callback`);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: CALENDAR_SCOPES,
    state,
  });
  console.log("Open this link and sign in with your PostHog Google account:\n");
  console.log(url);
});
