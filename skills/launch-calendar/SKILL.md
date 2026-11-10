---
name: launch-calendar
description: Add, confirm, move or remove product launches, pricing changes and billing changes on PostHog's "Product and pricing launches" Google Calendar, following its naming rules. Use when someone asks to put a public beta, GA, pricing change, billing change or deprecation on the launch calendar, to set, confirm or push back a launch date, or to list what's launching soon. Needs a Google Calendar tool that can read and write that calendar.
---

# Launch calendar

The **Product and pricing launches** Google Calendar tells the whole company what's shipping and when. An app watches it: every change you make posts in Slack, and owners are reminded there before a tentative date. Write events exactly as the naming guide says, or they show up wrong.

- Calendar: find it by name. List the user's calendars and use the one called **Product and pricing launches**. If it isn't listed, ask the user to subscribe to it first (the link is in the handbook and in the launch channel) and stop until they have.
- Naming rules: `references/naming-guide.md`. Read it before writing anything. It wins over this file if they disagree.

## Before you write

1. **Look for an existing event.** List all upcoming events on the calendar and check for one about the same product or change. If there is one, update it. A new event for a launch that moved shows in Slack as a removal plus a new launch.
2. **Collect the details.** Ask for anything missing. Never guess a date.
   - Type: public beta, GA, pricing, billing, deprecation, marketing launch, or other. Use marketing launch only when marketing launches on a different day from the release; otherwise one event covers both
   - Whether it starts charging. If so, add `+ Pricing` to the type (`GA + Pricing: Example product`), and add a separate `Pricing:` event for the day grandfathered customers start paying
   - Name, as customers will see it
   - The week (tentative) or the day (confirmed)
   - Owner: the PM or team lead who answers questions, or the product marketer for a marketing launch. Default to the user
   - The launch's Slack channel, if it has one. Ask for the channel link so it shows as a clickable channel
   - Links: RFC, marketing launch issue
3. **Confirm first.** Show the user the title, dates, description and color you will write, and wait for a yes. Every change posts in Slack for the whole company.

## Event fields

| Field                    | Value                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary`                | `[Tentative] Type: Name`, or `Type: Name` once confirmed                                                                                                |
| `start.date`, `end.date` | All-day dates. Tentative: the Monday of the week, ending the following Saturday, since `end.date` is exclusive. Confirmed: the day, ending the next day |
| `description`            | One item per line: `Owner: email`, `Slack channel: channel link`, `RFC: url`, `Marketing launch issue: url`                                             |
| `transparency`           | `transparent`, so subscribers stay free                                                                                                                 |
| `colorId`                | Public beta `3`, GA `10`, Pricing `6`, Billing `5`, Deprecation `8`, Marketing launch `4`, Other `7`. Anything with `+ Pricing` uses `6`                |

Create the event on the launch calendar itself, never on the user's own calendar with the launch calendar invited: the app ignores invitations. Add no attendees and send no invitations (`sendUpdates: none`). The calendar itself is how people subscribe.

## Common jobs

- **Add a launch about 4 weeks out:** create a tentative event across the expected week.
- **Confirm a date:** update the same event. Remove `[Tentative]` from the title and make it a single day.
- **Push a launch back:** update the same event's dates. Keep its status.
- **Cancel a launch:** delete the event, after the user confirms.
- **List what's coming:** read all upcoming events and report type, name, date and status from each title as the guide describes.

## Don't

- Put dates in the title.
- Put words or dashes before the type: `Example product - Pricing ends` has no type.
- Create one event per task or team. One launch is one event.
- Edit events that aren't on this calendar.

If you can't write to the calendar, the user needs edit access. Product managers have it and can share it, so tell the user to ask a product manager or the calendar's owner.
