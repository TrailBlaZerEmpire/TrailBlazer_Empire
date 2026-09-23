# Nexora Assistant "Book a Call" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent "📅 Book a Call" action to the Nexora Assistant widget that opens a branded Calendly popup, independent of the chat/relay/Langflow flow.

**Architecture:** Pure client-side addition to the existing static widget (`assets/nexora-chat.js`, `assets/nexora-chat.css`) loaded from `index.html`. No backend, relay, or Langflow changes.

**Tech Stack:** Vanilla JS/CSS/HTML (no build step, no test runner in this repo). Calendly's official embed script (`assets.calendly.com/assets/external/widget.js`).

## Global Constraints

- Calendly URL (exact, verbatim): `https://calendly.com/trailblazerempire/30min?background_color=001f29&text_color=f5f4ee&primary_color=8ad5c7`
- No changes to `nexora-chat-relay` or the Langflow flow (spec: "Out of scope").
- No changes to the separate `trailblazer-rag-chatbot-starter` project.
- This repo has no automated test tooling — verification is manual, run in a real browser.

---

### Task 1: Add "Book a Call" button to Nexora widget

**Files:**
- Modify: `index.html:26-27` (add Calendly embed assets)
- Modify: `assets/nexora-chat.js` (add constant, button markup, click handler, loop guard)
- Modify: `assets/nexora-chat.css` (add `.nexora-chat__prompt--book` modifier)

**Interfaces:**
- Consumes: `window.Calendly.initPopupWidget({ url })` — provided globally by Calendly's embed script once it loads. No guarantee on load timing, so every use must check `window.Calendly?.initPopupWidget` first.
- Produces: nothing consumed by other tasks — this is the only task.

- [ ] **Step 1: Add Calendly's embed assets to `index.html`**

Open `index.html`. At line 27, right after the existing Nexora stylesheet link, add Calendly's stylesheet:

```html
    <link rel="stylesheet" href="assets/nexora-chat.css" />
    <link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css" />
```

At line 219, right before the existing `nexora-chat.js` script tag, add Calendly's script:

```html
    <script src="https://assets.calendly.com/assets/external/widget.js" async></script>
    <script defer src="assets/nexora-chat.js" data-endpoint="https://assistant.trailblazerempire.com/nexora-chat"></script>
```

- [ ] **Step 2: Add the Calendly URL constant and button markup in `assets/nexora-chat.js`**

Near the top of the IIFE (after the existing `const sessionKey = ...` line, before `const createId = ...`), add:

```js
  const calendlyUrl = "https://calendly.com/trailblazerempire/30min?background_color=001f29&text_color=f5f4ee&primary_color=8ad5c7";
```

In the `root.innerHTML` template, inside `<div class="nexora-chat__prompts" ...>`, add a 4th button after the existing three (`Tell me about Nexora`), before the closing `</div>`:

```html
        <button class="nexora-chat__prompt nexora-chat__prompt--book" type="button" data-action="book-call">📅 Book a Call</button>
```

- [ ] **Step 3: Wire the button to open Calendly, with a fallback, and exclude it from the chat-prompt loop**

Find this existing block near the end of the file:

```js
  root.querySelectorAll(".nexora-chat__prompt").forEach((button) => {
    button.addEventListener("click", () => submitMessage(button.textContent));
  });
```

Replace it with:

```js
  const openBooking = () => {
    if (window.Calendly?.initPopupWidget) {
      window.Calendly.initPopupWidget({ url: calendlyUrl });
    } else {
      window.open(calendlyUrl, "_blank", "noopener");
    }
  };

  root.querySelectorAll(".nexora-chat__prompt").forEach((button) => {
    if (button.dataset.action === "book-call") {
      button.addEventListener("click", openBooking);
      return;
    }
    button.addEventListener("click", () => submitMessage(button.textContent));
  });
```

- [ ] **Step 4: Style the button as a call-to-action in `assets/nexora-chat.css`**

After the existing rule:

```css
.nexora-chat__prompt:hover { border-color: var(--nexora-green); color: var(--nexora-green); }
```

add:

```css
.nexora-chat__prompt--book {
  border-color: var(--nexora-gold);
  color: var(--nexora-gold);
  font-weight: 800;
}
.nexora-chat__prompt--book:hover { border-color: var(--nexora-gold); color: #b5822e; background: #fdf6e8; }
```

- [ ] **Step 5: Manually verify in a real browser**

Serve the site locally (any static server works, e.g. from the repo root: `npx serve .` or open `index.html` directly), then:

1. Load the homepage, open the Nexora panel (bottom-right launcher).
2. Confirm 4 chips are visible: the 3 original question chips, plus a visually distinct gold "📅 Book a Call" chip.
3. Click "📅 Book a Call" — confirm the Calendly popup overlay opens, styled with the dark background (`#001f29`), light text (`#f5f4ee`), and teal accent (`#8ad5c7`) from the URL's query params. Confirm no message was added to the chat log and no request went to `assistant.trailblazerempire.com` (check the Network tab).
4. Click one of the original 3 chips (e.g. "Tell me about Nexora") — confirm it still sends a chat message as before (regression check).
5. In devtools, block requests matching `assets.calendly.com`, hard-reload the page, open the panel, click "📅 Book a Call" again — confirm it opens `calendly.com/trailblazerempire/30min...` in a new tab instead of doing nothing or throwing a console error.

Expected: all 5 checks pass.

- [ ] **Step 6: Commit**

```bash
cd "/e/TrailBlazer Empire"
git add index.html assets/nexora-chat.js assets/nexora-chat.css
git commit -m "feat: add Book a Call action to Nexora Assistant widget"
```
