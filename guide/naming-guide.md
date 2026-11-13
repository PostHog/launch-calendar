# How to add a launch to the launch calendar

The **Product and pricing launches** calendar tells the whole company what's shipping and when. Add every public beta, GA, pricing change and billing change that affects what customers pay. Leave minor launches off for now.

Add a launch about **4 weeks before** it ships, as a tentative week. Confirm the exact day about **1 week before**. Pricing changes need a confirmed date at least **10 business days** before customer emails go out.

This matches the handbook on [releasing new products](https://posthog.com/handbook/product/releasing-new-products-and-features): marketing and billing need at least two weeks' notice before a major launch, and Developer Marketing wants to hear at the start of a quarter about launches planned for it.

## Get access

- **To see it:** everyone at PostHog can view the calendar. Every Monday digest in Slack links to it; open the link to subscribe.
- **To add or change launches:** product managers can edit it and share it. Anyone else can ask a product manager, or the calendar's owner, for edit access.

## Name the event

```
[Tentative] Type: Product or change
```

| Part   | Write                                                                                                                                                                            | Leave it out when                              |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Status | `[Tentative]`                                                                                                                                                                    | The date is confirmed                          |
| Type   | `Public beta:`, `GA:`, `Pricing:`, `Billing:`, `Deprecation:`, `Marketing launch:`, or `Other:` for anything else. Add `+ Pricing` when it starts charging, like `GA + Pricing:` | Never. Without a type the event shows as Other |
| Name   | The product or the change, as customers will see it                                                                                                                              | Never                                          |

Examples:

| Situation                                        | Title                                                |
| ------------------------------------------------ | ---------------------------------------------------- |
| A public beta expected in the week of 23 Nov     | `[Tentative] Public beta: Session replay for mobile` |
| A GA with a fixed day                            | `GA: Error tracking`                                 |
| A GA that starts charging new customers          | `GA + Pricing: Example product`                      |
| New pricing, week not fixed yet                  | `[Tentative] Pricing: Example product volume tiers`  |
| Grandfathered pricing ending                     | `Pricing: Example product grandfathering ends`       |
| A billing fix that starts charging for something | `Billing: Example feature leaves the free tier`      |
| A product being turned off                       | `Deprecation: Example legacy feature`                |
| Marketing launches a released product later      | `Marketing launch: Example product`                  |

Avoid:

- **Dashes or other words in front of the type:** `Example product - Grandfathered pricing ends` has no type, so it shows as Other.
- **Dates in the title:** `GA: Error tracking (24 Nov)`. The event's dates are what count.
- **One event per team or task:** one launch is one event. Link the details instead.
- **Invitations:** create the event on the launch calendar itself. Inviting the launch calendar to an event on your own calendar doesn't work: the app ignores invitations, so outsiders can't post through it.

### Releases and marketing launches

The handbook separates a [release](https://posthog.com/handbook/marketing/product-announcements#releases-vs-launches), when users can use something, from a marketing launch, when marketing puts it in front of existing and new people. Usually both happen on the same day: one event covers them, with the marketing launch issue linked in the description.

Only when marketing launches on a different day, add a second event for that day: `Marketing launch: Product name`, owned by the product marketer.

### Releases that start charging

Most GAs come with pricing. Add `+ Pricing` to the type when a release starts charging: `GA + Pricing: Example product`. Slack shows it as "GA + Pricing", and its owner gets the reminder 14 days out, like any pricing change.

When existing customers are grandfathered, add a second event for the day they start paying: `Pricing: Example product grandfathering ends`.

## Set the dates

- **Tentative:** an all-day event across the expected week, Monday to Friday.
- **Confirmed:** a single all-day event on the launch day, without `[Tentative]`.
- **Date moves:** drag or edit the **same** event. Never delete it and create a new one: Slack would show a removal and a new launch instead of a move.
- **Cancelled:** delete the event. Slack shows that it was removed.

An event of one day without `[Tentative]` counts as confirmed. An event of several days counts as tentative, unless its title starts with `[Confirmed]`.

## Fill in the description

One item per line. The app picks these up:

```
Owner: someone@posthog.com
Slack channel: https://posthog.slack.com/archives/C0123ABCDEF
RFC: https://github.com/PostHog/requests-for-comments-internal/pull/…
Marketing launch issue: https://github.com/PostHog/marketing/issues/…
```

- **Owner** is the PM or team lead who answers questions, or the product marketer for a marketing launch. Leave it out when that's you and you created the event. The owner is mentioned in the reminder.
- **Slack channel** is the launch's own channel, if it has one. Paste the channel's link (in Slack: the channel name → **Copy link**) so it shows as a clickable channel. A plain `#channel-name` works too, but shows as text.
- **Marketing launch issue** is the launch issue in the marketing repo. `Marketing:` works as a shorter label.
- Any other `Label: https://…` line becomes a link in Slack, up to 4.

## Set color and availability

- **Show as:** Free, so subscribers' calendars aren't blocked.
- **Color** by type, so people can scan the month. Anything with `+ Pricing` takes the pricing color:

| Type             | Color              |
| ---------------- | ------------------ |
| Public beta      | Grape (purple)     |
| GA               | Basil (green)      |
| Pricing          | Tangerine (orange) |
| Billing          | Banana (yellow)    |
| Deprecation      | Graphite (gray)    |
| Marketing launch | Flamingo (pink)    |
| Other            | Peacock (blue)     |

## What happens next

- Adding, confirming, moving or removing an event posts in Slack, with the old and new dates.
- When a tentative launch is 7 days away (14 for anything with pricing), a reminder in the same channel mentions the owner and asks them to confirm or move it. Reminders go out on weekday mornings from 09:00 London time.
- Every Monday at 09:00 London time, a digest lists everything coming up.
