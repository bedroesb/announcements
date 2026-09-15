# COMPANY NAME — status & announcements

Public status page for the services run by COMPANY NAME:
**https://bedroesb.github.io/announcements/**

Everything on that page comes from Markdown files in this repository. Adding an
incident or an announcement means adding one file — no HTML, no CSS, no build
step on your side.

Two things live here, and they are kept deliberately apart:

|  | What it is | Where it goes | Shown as |
| --- | --- | --- | --- |
| **Incident** | Something broke unexpectedly | [`_incidents/`](_incidents/) | Warning icon, `severity: critical` or `degraded` |
| **Announcement** | Something we planned or want to tell you | [`_announcements/`](_announcements/) | Megaphone / wrench icon, `type: maintenance` or `info` |

Planned maintenance is an announcement, not an incident: you knew about it in
advance, so it is news, not a failure.

Items that have not ended yet appear as callouts at the top of the page.
Closed items drop into the **Past incidents & announcements** timeline, newest
first, filterable by service, type, severity and free text.

---

## Quick start: report an incident

1. Go to [`_incidents/`](_incidents/) and click **Add file → Create new file**.
2. Name it `YYYY-MM-DD-short-slug.md`, for example `2026-09-14-storage-latency.md`.
3. Paste the template below, edit it, and open a pull request.

```markdown
---
title: Elevated latency on research storage volumes
start: 2026-09-14 08:20:00 +02:00
severity: degraded
services_affected:
  - storage
  - galaxy
summary: >-
  One or two sentences shown on the card and in the timeline.
---

What is happening, who is affected, and what people can do in the meantime.
Normal Markdown: **bold**, lists, `code`, [links](https://datacore.vib.be).
```

Leave `end:` out entirely while the incident is still open. When it is over,
edit the same file and add the end time:

```yaml
end: 2026-09-14 18:00:00 +02:00
```

A pull request is enough; the page rebuilds automatically after it is merged.

## Quick start: post an announcement

Identical, but the file goes in [`_announcements/`](_announcements/) and the
field is `type:` instead of `severity:`:

```markdown
---
title: Planned firmware upgrade of the storage controllers
start: 2026-09-20 18:00:00 +02:00
end: 2026-09-20 22:00:00 +02:00
type: maintenance
services_affected:
  - storage
summary: >-
  Short interruptions of up to five minutes during the window.
---

What will happen, and what people should avoid doing during the window.
```

For an announcement, `start` is when it becomes relevant and `end` is when it
stops being current (the end of a maintenance window, a deadline, the last day
of a call). Without an `end`, it stays pinned at the top forever — occasionally
what you want, usually not.

---

## Front matter reference

| Field | Required | Type | Notes |
| --- | --- | --- | --- |
| `title` | yes | text | Keep it under ~90 characters. Describe the impact, not the cause. |
| `start` | yes | date-time | Unquoted, with timezone offset: `2026-09-14 08:20:00 +02:00`. Use `+02:00` in summer, `+01:00` in winter. |
| `end` | no | date-time | Omit while it is still going on. Once it is in the past, the entry moves to the history timeline. |
| `severity` | incidents only | keyword | `critical` or `degraded`. |
| `type` | announcements only | keyword | `maintenance` or `info`. |
| `services_affected` | yes for incidents | list | Ids from [`_data/services.yml`](_data/services.yml). Unknown ids fail the build check. |
| `summary` | recommended | text | One or two sentences, shown on cards, in the timeline and in the feed. |
| `updates` | no | list | Chronological updates during a long incident, see below. |

Anything else you add is ignored by the templates (and flagged as a warning by
the validator).

### The vocabulary

All four values live in [`_data/levels.yml`](_data/levels.yml) together with
their colour and icon. They are mutually exclusive — pick the one that fits:

| Value | Field | Use it when |
| --- | --- | --- |
| `critical` | `severity` | The service is down or unusable, or data is at risk. |
| `degraded` | `severity` | The service still works, but it is slow, flaky or partially broken. |
| `maintenance` | `type` | Planned work, with downtime or disruption to be expected. |
| `info` | `type` | News or a heads-up, no impact on availability. |

A service is marked as non-operational in the services grid while a `critical`,
`degraded` or `maintenance` entry affecting it is running. `info` never changes
a service badge.

### Services

Defined in [`_data/services.yml`](_data/services.yml). Use the `id` in front
matter; the `name` is what readers see:

```yaml
- id: storage
  name: Research Storage
  description: Shared project storage and archive volumes.
  url: https://example.vib.be   # optional
```

To cover a service that is not in the list yet, add it there in the same pull
request. Ids are lowercase with dashes and should not change afterwards —
they appear in shareable filter links such as `?services=storage,galaxy`.

### Updates during a long incident

Newest first or oldest first, both work; the page sorts them. The most recent
update is also shown on the callout card on the front page.

```yaml
updates:
  - time: 2026-09-14 10:05:00 +02:00
    status: Identified
    body: >-
      One of the metadata servers is saturated after a failed failover.
  - time: 2026-09-14 08:40:00 +02:00
    status: Investigating
    body: >-
      We are aware of slow access to shared project storage.
```

`status` is free text — `Investigating`, `Identified`, `Monitoring`,
`Resolved` are the usual suspects.

---

## How "ongoing" is decided

Purely from the timestamps, in the reader's browser:

- no `end` → ongoing
- `end` in the future, `start` in the past → ongoing
- `start` in the future → scheduled
- `end` in the past → history timeline

The site is static, but this classification is **not** frozen at build time.
[`assets/js/status.js`](assets/js/status.js) recomputes it on load and once a
minute afterwards, and moves entries between the three lists, including the
banner, the service badges and the durations. An incident that ends at 18:00
drops into the history at 18:00 without anyone pushing anything and without a
scheduled rebuild.

Jekyll still renders the state as it was at build time, so the page is complete
and correct with JavaScript disabled — it is then simply as fresh as the last
deploy.

---

## Working on it locally

You need Ruby (3.1+) and Node (18+).

```bash
bundle install     # Jekyll and friends
npm install        # Tailwind CLI

npm run serve      # builds the CSS, watches it, and serves on http://localhost:3001/announcements/
```

Other commands:

```bash
npm run css        # one-off, minified stylesheet
npm run build      # CSS + full Jekyll build into _site/
npm run validate   # check all entries against the vocabularies

ruby script/new.rb incident "Storage is slow"
ruby script/new.rb announcement "Galaxy upgrade" --level maintenance
```

`assets/css/main.css` is generated and git-ignored — never edit it by hand,
edit [`assets/css/tailwind.css`](assets/css/tailwind.css) instead.

### Checks on every pull request

[`script/validate.rb`](script/validate.rb) runs in CI and fails on:

- missing `title`, `start`, `severity` or `type`
- `severity` in an announcement, or `type` in an incident
- a value used in the wrong collection (`maintenance` in `_incidents/`, say)
- quoted or malformed date-times, and an `end` before the `start`
- unknown service ids
- malformed `updates` entries

It also prints warnings (empty body, missing summary, odd file name) that do
not block a merge.

---

## Repository layout

```
_incidents/          incident Markdown files
_announcements/      announcement Markdown files
_data/levels.yml     the controlled vocabulary + its colours and icons
_data/services.yml   the services that can be referenced
_layouts/            page shells (default, single entry)
_includes/           reusable fragments (entry card, icons, badges, tags)
assets/css/          Tailwind input (tailwind.css); main.css is generated
assets/js/status.js  state, filtering, search, relative times (vanilla JS)
index.html           the status page itself
feed.xml             Atom feed of incidents and announcements
script/              validation and scaffolding helpers
.github/workflows/   CI check + build & deploy to GitHub Pages
```

## Design & tooling notes

- **Jekyll** with two collections (`incidents`, `announcements`) that share one
  card component and differ only in icon, label and vocabulary.
- **Tailwind CSS v4**, compiled by the GitHub Actions workflow — so the classic
  GitHub Pages Jekyll build is *not* used; deployment goes through
  [`.github/workflows/pages.yml`](.github/workflows/pages.yml) with
  *Settings → Pages → Source: GitHub Actions*.
- **Lucide** icons, inlined as SVG in [`_includes/icon.html`](_includes/icon.html)
  (ISC licensed) — no icon font, no runtime fetch.
- Colours follow the VIB house style: navy `#00264F`, blue `#197CC0`,
  teal `#1CBBBA`.
- Filtering is plain JavaScript over `data-` attributes and mirrors its state in
  the URL (`?services=galaxy,storage&kind=incident&level=critical&q=slow`), so a
  filtered view can be shared. Stacking services widens the selection: an entry
  matches if it touches any of them.

## Licence

Code in this repository is MIT licensed (see [LICENSE](LICENSE)).
