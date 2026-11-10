# Launch calendar

One Google Calendar for product launches, pricing changes and billing changes, so the whole company hears about them early. A tentative window goes on about 4 weeks before launch and is confirmed a week before.

Google Calendar is the source of truth: subscribe to it, or edit it like any other calendar. This app watches it and:

- posts to Slack when a launch is added, confirmed, moved, made tentative again or removed, showing old and new dates
- posts a digest every Monday at 09:00 London time with every upcoming launch
- posts a reminder that mentions the owner when a tentative launch is close and still not confirmed (7 days ahead, 14 for pricing changes)
- shows every upcoming launch at `/`, the naming guide at `/guide` and a digest preview at `/digest`

It's a prototype. See the PRD for the plan beyond it.

## Adding a launch

Add an event in Google Calendar, named like `[Tentative] Public beta: Session replay for mobile`. The full rules are in one place:

- **[guide/naming-guide.md](guide/naming-guide.md)**: the naming guide. The app serves it at `/guide`, and it's written to be copied into the handbook as is.
- **[skills/launch-calendar/SKILL.md](skills/launch-calendar/SKILL.md)**: the agent skill, so people can add launches by asking their agent. PostHog staff can use it from the [PostHog skill store](https://us.posthog.com/project/2/skills/launch-calendar) (`launch-calendar`, sign-in required). It ships the guide as `references/naming-guide.md`, so publish both together.

`test/guide.test.ts` checks that every example title in the guide parses as the guide says, and that the guide and skill cover every type. Change the parser, the guide and the skill together.

### Publishing the skill

Create or update the `launch-calendar` skill in the PostHog skill store (project 2) through the PostHog MCP's `skill-create` / `skill-update` tools. The body is `SKILL.md`, plus one bundled file at `references/naming-guide.md` with the guide's contents.

## Setup

### 1. Calendar

1. In Google Calendar, create a calendar called "Product and pricing launches".
2. Under **Share with specific people or groups**, give PostHog "Make changes to events".
3. Copy the **Calendar ID** from **Integrate calendar** into `LAUNCH_CALENDAR_ID`.

### 2. Google access (prototype: your own account)

1. In a Google Cloud project in the PostHog organisation, enable the **Google Calendar API**.
2. Set the OAuth consent screen to **Internal**, and create an OAuth client of type **Desktop app**.
3. Put its ID and secret in `.env`, then run `pnpm google:auth`, sign in and copy the refresh token it prints into `.env`.

The app asks only for `calendar.events.readonly`. To move to a delegated service account later, set `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_IMPERSONATE_USER`: they take over from the refresh token without code changes.

### 3. Slack

1. Create the Slack app from `slack-manifest.yaml` (api.slack.com/apps > Create New App > From a manifest), and install it.
1. Under **Basic Information > Display Information**, upload `assets/slack-icon.png` as the app icon: the town crier hedgehog from [brand.posthog.com](https://brand.posthog.com/).
1. Create a private test channel, invite the bot, and put the channel ID in `ALERT_CHANNEL_ID`.
1. Keep `SLACK_POSTING_ENABLED=false` until a dry run looks right: posts are logged instead of sent.

### 4. Run it locally

```bash
cp .env.example .env   # then fill it in
pnpm install
docker compose up -d   # Postgres on port 5433
pnpm migrate
pnpm sync:once         # first run records a baseline and posts nothing
pnpm dev               # http://localhost:3000
```

Then edit an event in Google Calendar and run `pnpm sync:once` again to see the Slack message it would post. `pnpm digest:preview` prints the digest, and `pnpm digest:preview --post` sends it to the channel.

### 5. Deploy on HostHog

1. Connect this repo as a server app (it has a `Dockerfile`) and add a managed Postgres database. HostHog sets `DATABASE_URL`.
2. Add the settings from `.env.example` as runtime env. Mark the Google and Slack values as secrets.
3. Make `/ping` a public path. Everything else stays behind Google SSO.
4. Set the repo variable `APP_URL` to the app's URL, so the keepalive workflow stops HostHog putting it to sleep.

## How it works

- Every 5 minutes, the app asks Google for changes since its last sync token and compares each event with its snapshot in Postgres. Everything in Postgres can be rebuilt from Google.
- When the token expires, the app lists the whole calendar and still compares it with the snapshot, so changes in between are posted.
- The very first sync records a baseline and posts nothing.
- Edits to launches that are already over aren't posted. Neither are renames or new links: only dates and status.
- The digest claims its week in Postgres before posting, so it goes out once.

| Command                                    | What it does                                |
| ------------------------------------------ | ------------------------------------------- |
| `pnpm dev`                                 | Server with the sync loop                   |
| `pnpm sync:once`                           | One sync, alerts, reminders and digest pass |
| `pnpm digest:preview [--post]`             | Print or post the digest                    |
| `pnpm google:auth`                         | Get a Google refresh token for your account |
| `pnpm test`, `pnpm typecheck`, `pnpm lint` | Checks                                      |
