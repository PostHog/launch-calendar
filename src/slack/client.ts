import type { WebClient } from "@slack/web-api";
import { errorFields, log } from "../log.js";

export interface SlackApi {
  postMessage(args: { channel: string; text: string }): Promise<{ ts?: string }>;
  /** The Slack user for a work email, or null when there isn't one. */
  userIdByEmail(email: string): Promise<string | null>;
}

export class WebSlackApi implements SlackApi {
  private readonly users = new Map<string, string | null>();

  constructor(private readonly client: WebClient) {}

  async postMessage(args: { channel: string; text: string }) {
    const res = await this.client.chat.postMessage({
      channel: args.channel,
      text: args.text,
      unfurl_links: false,
      unfurl_media: false,
    });
    return { ts: res.ts };
  }

  async userIdByEmail(email: string) {
    if (this.users.has(email)) return this.users.get(email) ?? null;
    let id: string | null = null;
    try {
      const res = await this.client.users.lookupByEmail({ email });
      id = res.user?.id ?? null;
    } catch (err) {
      log.warn("slack user lookup failed", { email, ...errorFields(err) });
    }
    this.users.set(email, id);
    return id;
  }
}

/** Posts when posting is on. Otherwise logs what it would have posted and reports false. */
export interface Poster {
  readonly enabled: boolean;
  post(channel: string, text: string): Promise<{ posted: boolean; ts?: string }>;
  userIdByEmail(email: string): Promise<string | null>;
}

export function createPoster(slack: SlackApi | undefined, enabled: boolean): Poster {
  const live = Boolean(slack) && enabled;
  return {
    enabled: live,
    async post(channel, text) {
      if (!slack || !live) {
        log.info("dry run, not posting to Slack", { channel, text });
        return { posted: false };
      }
      const { ts } = await slack.postMessage({ channel, text });
      return { posted: true, ts };
    },
    async userIdByEmail(email) {
      return slack ? slack.userIdByEmail(email) : null;
    },
  };
}
