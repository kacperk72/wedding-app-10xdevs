# Overview — {{APP_NAME}}

> **TL;DR**: {{ONE_PARAGRAPH_SUMMARY — what the app is, who it's for, what problem it solves}}

**Source URL**: {{TARGET_URL}}
**Reverse-engineered on**: {{DATE}}
**Confidence**: {{HIGH | MEDIUM | LOW}} — {{one-line note on coverage}}

---

## Purpose & audience

{{Two or three sentences. Who uses this app? What outcome do they want? What does the app give them that alternatives don't?}}

## Core features

{{Bullet list. Group related features. Be specific — "task management" is too vague; "create / edit / delete tasks; group by project; filter by status" is right.}}

- {{Feature 1}}
- {{Feature 2}}
- {{Feature 3}}

## Primary user flows

For each flow: entry point → steps → result. Each step includes the API call it triggers (if observed).

### Flow 1 — {{flow name, e.g. "User signs up and creates first project"}}

1. {{step}} — *no network call*
2. {{step}} — `POST /api/auth/register` → `201 Created`
3. {{step}} — `POST /api/projects` → `201 Created`
4. {{step}} — UI redirects to `/projects/:id`

![{{caption}}](screenshots/desktop/{{slug}}.png)

### Flow 2 — {{flow name}}

{{...}}

## Pages discovered

| Path                  | Auth required | Purpose                          | Screenshot                                       |
| --------------------- | ------------- | -------------------------------- | ------------------------------------------------ |
| `/`                   | No            | Marketing landing                | `screenshots/desktop/home.png`                   |
| `/login`              | No            | Sign-in form                     | `screenshots/desktop/login.png`                  |
| `/dashboard`          | Yes           | Authenticated home               | `screenshots/desktop/dashboard.png`              |
| {{...}}               |               |                                  |                                                  |

## Out of scope / not investigated

{{What didn't get covered. Examples: admin pages without credentials, payment flow that needed real card, features behind a feature flag.}}

## Notes for the implementer

{{Anything unusual the rebuilder should know up front: a tricky feature, a specific UX detail to preserve, a known limitation of the original.}}
