# Nexora Assistant — "Book a Call" design

## Context

The Nexora Assistant widget (`assets/nexora-chat.js` + `assets/nexora-chat.css`, loaded from `index.html`) is a self-hosted chat bubble on the TrailBlazer Empire homepage. It sends visitor messages to `https://assistant.trailblazerempire.com/nexora-chat` (the `nexora-chat-relay` service), which proxies to the shared "Vector Store RAG" Langflow flow and returns a plain-text `answer`.

The widget renders assistant replies with `element.textContent`, so a URL embedded in the AI's answer would show as inert text, not a clickable link. There is no structured way today for the assistant to hand a visitor off to a booking flow.

Goal: let a visitor book a call with one click, without depending on the AI to produce or format a link correctly.

Calendly link (already branded for this site):
```
https://calendly.com/trailblazerempire/30min?background_color=001f29&text_color=f5f4ee&primary_color=8ad5c7
```

## Decision

Add a 4th, always-visible action to the widget's existing quick-reply row: **"📅 Book a Call"**. It opens Calendly's official popup widget directly — it does not go through `submitMessage`, the relay, or Langflow. This keeps booking available immediately, regardless of AI behavior, and keeps no visitor data flowing through the chatbot backend for this action.

Scope is limited to the Nexora Assistant widget only (`E:\TrailBlazer Empire`). The shared Langflow flow's system prompt is intentionally left untouched, since it's also used by the separate "TrailBlazer AI Assistant" widget (a different project) and prompt changes there were explicitly out of scope for this change.

## Components

### 1. `index.html`
Add Calendly's official embed assets right after the existing Nexora script tag:
```html
<link href="https://assets.calendly.com/assets/external/widget.css" rel="stylesheet" />
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
```
These must be present (or at least requested) before the button can be clicked, so `window.Calendly` is available.

### 2. `assets/nexora-chat.js`
- Define the Calendly URL as a constant at the top of the IIFE.
- Add a 4th `<button>` inside `.nexora-chat__prompts`, class `nexora-chat__prompt nexora-chat__prompt--book`, label `📅 Book a Call`.
- Wire it to a dedicated handler (not `submitMessage`):
  - If `window.Calendly?.initPopupWidget` exists, call `Calendly.initPopupWidget({ url: CALENDLY_URL })` and `event.preventDefault()`.
  - Otherwise (script blocked/failed to load), fall back to `window.open(CALENDLY_URL, "_blank", "noopener")`.
- The existing `root.querySelectorAll(".nexora-chat__prompt").forEach(...)` wiring loop, which binds every prompt chip to `submitMessage`, gets a guard that skips any button carrying the book button's identifying class/attribute, so this button never sends a chat message.

### 3. `assets/nexora-chat.css`
- Add `.nexora-chat__prompt--book` modifier: reuses the base `.nexora-chat__prompt` shape/sizing, but with a gold accent (`--nexora-gold` / `#d39a3c`-family border and hover color) so it visually reads as a call-to-action distinct from the 3 question chips.

## Data flow

```
Visitor clicks "📅 Book a Call"
  → Calendly script loaded? 
      yes → Calendly.initPopupWidget({url}) renders a branded iframe overlay
      no  → window.open(url, "_blank") as fallback
  → Visitor books directly with Calendly.
```
No request is sent to `assistant.trailblazerempire.com` or Langflow for this action.

## Error handling

- Calendly script fails to load (ad blocker, offline, CDN issue): click handler checks for `window.Calendly` before use and falls back to opening the URL in a new tab rather than doing nothing or throwing.
- No other new failure modes are introduced; the existing 3 prompt buttons and chat flow are unchanged.

## Testing

Manual, since this is static frontend with no build/test tooling in this repo:
1. Open `index.html` (local preview or the live site), open the Nexora panel, click "📅 Book a Call" — confirm the Calendly popup renders with the configured background/text/primary colors.
2. In devtools, block requests to `assets.calendly.com`, reload, click the button — confirm it opens `calendly.com/trailblazerempire/30min...` in a new tab instead of failing silently.
3. Confirm the existing 3 question chips and the composer still work unchanged (regression check).

## Out of scope

- No changes to `nexora-chat-relay` (server.js).
- No changes to the Langflow "Vector Store RAG" flow or its prompt.
- No changes to the separate `trailblazer-rag-chatbot-starter` project's widget.
- No booking-intent detection in the AI's replies.
