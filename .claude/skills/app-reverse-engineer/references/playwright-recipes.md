# Playwright MCP Recipes

Quick reference for the Playwright MCP calls this skill needs. Tool names use the prefix `mcp__plugin_playwright_playwright__` — abbreviated below as `pw__`.

## Setup & navigation

```
pw__browser_navigate({ url: "https://example.com" })
pw__browser_resize({ width: 1440, height: 900 })   # desktop
pw__browser_resize({ width: 375, height: 812 })    # mobile (iPhone X-ish)
pw__browser_navigate_back()                        # go back one entry
```

After every navigation, give the page a moment to settle before snapshotting:

```
pw__browser_wait_for({ time: 1.5 })   # seconds; or wait_for text/selector
```

## Capturing evidence

```
pw__browser_take_screenshot({ filename: "screenshots/desktop/home.png", fullPage: true })
pw__browser_snapshot()                          # accessibility tree — best for structural overview
pw__browser_network_requests()                  # ALL requests since the page loaded
pw__browser_console_messages()                  # console output (framework warnings often appear here)
```

`browser_snapshot` returns an accessibility tree, not raw HTML. It's terser and easier to reason about. Use `browser_evaluate` if you need raw DOM details:

```
pw__browser_evaluate({ function: "() => document.documentElement.outerHTML.slice(0, 5000)" })
```

## Detecting the framework

Run these in `browser_evaluate` and note which return values:

| Hint                                                | Framework            |
| --------------------------------------------------- | -------------------- |
| `window.ng` exists                                  | Angular              |
| `window.__NEXT_DATA__` exists                       | Next.js              |
| `window.__NUXT__` exists                            | Nuxt                 |
| `window.Vue` exists                                 | Vue (CDN/global)     |
| `document.querySelector('[data-reactroot]')` truthy | React (older)        |
| `document.querySelector('#__svelte')` truthy        | SvelteKit            |
| `document.querySelector('astro-island')` truthy     | Astro                |
| `<meta name="generator">` content                   | varies — read it     |
| Script src patterns (`/_next/`, `/static/js/main.`) | Next, CRA, etc.      |

Also check `document.documentElement.outerHTML` for class prefixes (`ng-` = Angular, `data-v-` = Vue SFC, `_next` = Next.js).

## Exercising interactivity

The Playwright MCP uses **element refs** from the latest `browser_snapshot`. Pattern:

1. `browser_snapshot` → returns nodes with `ref` ids
2. `browser_click({ element: "Sign in button", ref: "<ref>" })`

```
pw__browser_click({ element: "Submit button", ref: "e123" })
pw__browser_type({ element: "Email field", ref: "e45", text: "test@example.com" })
pw__browser_fill_form({ fields: [
  { name: "Email", ref: "e45", type: "textbox", value: "test@example.com" },
  { name: "Password", ref: "e46", type: "textbox", value: "password123" }
]})
pw__browser_select_option({ element: "Country select", ref: "e88", values: ["PL"] })
pw__browser_press_key({ key: "Enter" })
pw__browser_hover({ element: "User menu", ref: "e9" })
```

After every interaction that could trigger a request, call `browser_network_requests` again and diff against the prior set — the new entries are what that interaction caused.

## Login flow

If credentials are hardcoded in the page, view the source:

```
pw__browser_evaluate({ function: "() => document.documentElement.outerHTML" })
```

Then search for things like `defaultValue=`, `value="…"`, comments containing creds, or hidden inputs. If creds aren't visible, ask the user.

Login sequence:
1. Navigate to login page, screenshot
2. `browser_snapshot` to get refs
3. `browser_fill_form` with credentials
4. `browser_click` the submit button
5. `browser_wait_for` either a redirect URL or a logged-in element
6. `browser_network_requests` — capture the auth call (URL, request body, response, set-cookie)

## Multi-tab / multi-page

```
pw__browser_tabs({ action: "list" })
pw__browser_tabs({ action: "new", url: "https://example.com/admin" })
pw__browser_tabs({ action: "select", index: 0 })
```

Useful for inspecting OAuth popups or comparing states.

## Closing up

```
pw__browser_close()
```

Always close at the end of recon, even on error paths.

---

## Tips that save time

- **Don't snapshot before the page settles.** Loading skeletons make snapshots noisy. Wait for a known element first (`browser_wait_for({ text: "Welcome" })`).
- **Network buffer is large but not infinite.** Capture network requests *per page*, not at the very end of the crawl.
- **Screenshots at `fullPage: true`** capture content below the fold — usually what you want for documentation.
- **`browser_evaluate` runs in the page context** — `window`, `document`, etc. are available. It's the escape hatch when MCP-level tools don't expose what you need.
- **If `browser_run_code_unsafe` is available**, prefer `browser_evaluate` for read-only DOM inspection. Reserve `unsafe` for cases where you need to wait on a Promise or do something stateful.
