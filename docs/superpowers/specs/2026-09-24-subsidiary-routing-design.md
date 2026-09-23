# Subsidiary-routing intelligence — design

## Context

TrailBlazer Empire has five subsidiary ventures, each with its own live site. Today, neither chatbot (Nexora Assistant on this site, or the separate "TrailBlazer AI Assistant" widget in the `trailblazer-rag-chatbot-starter` project) ever points a visitor toward the right subsidiary. Both bots share the same Langflow flow ("Vector Store RAG", flow id `af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40`), whose Prompt component currently has no knowledge of the ventures at all:

```
{context}
---
Given the context above, answer the question as best as possible.
Question: {question}
Answer:
```

Goal: when a visitor's question relates to one of the five ventures, the assistant should mention it and link to it — in both widgets, not just Nexora's.

Venture directory (pulled from `index.html`'s live venture cards):

| Venture | Focus | URL |
|---|---|---|
| Vision Craft | Strategic diagnosis & organizational framing | https://visioncraft.trailblazerempire.com/ |
| Capital Compass | Financial, capital & ecosystem strategy (research only, not investment advice) | https://capitalcompass.trailblazerempire.com/ |
| Vector Bound | Industry & value-chain market intelligence | https://vectorbound.trailblazerempire.com/ |
| TrailBite | Penang food & travel discovery | https://trailbite.trailblazerempire.com/ |
| Nexora | AI, automation & digital enablement | https://nexora.trailblazerempire.com/ |

## Decision

Two independent pieces, both required for the feature to be visible to a visitor:

1. **Prompt update (shared Langflow flow)** — add a fixed venture-directory block to the Prompt component's template, with an instruction to recommend the most relevant venture(s) only when genuinely relevant, and never fabricate a URL outside this list. This is plain prompt engineering: the set is small (5) and fixed, so it doesn't need vector retrieval or a knowledge-base entry — baking it into the system prompt is simpler and more reliable than depending on retrieval quality for 5 static facts.
2. **Clickable links in both widgets** — both `assets/nexora-chat.js` (this repo) and `F:\Projects\trailblazer-rag-chatbot\trailblazer-rag-chatbot-starter\public\widget.js` (the other project) currently render assistant replies with `textContent`, so a URL in the AI's answer is inert text today (the same issue hit and fixed for the Calendly link in Nexora). Add a `linkify()` helper to each that converts `https://...` substrings into real `<a target="_blank" rel="noopener noreferrer">` elements via safe DOM text-node splitting — never `innerHTML` on AI-authored text, so there's no injection risk. This benefits any URL the AI mentions, not just subsidiary links.

## Components

### 1. Langflow flow `af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40`, Prompt component (`Prompt-POcpa`)

New `template.value`:

```
{context}

---

TrailBlazer Empire has five subsidiary ventures. When the visitor's question relates to one of these areas, mention the most relevant venture by name and include its link so they can learn more or engage directly. Only recommend a venture when it is genuinely relevant to what was asked — do not list all five every time, and never invent a URL that is not in this list.

- Vision Craft — strategic diagnosis and organizational framing (clarifying ownership, resolving cross-team disconnects): https://visioncraft.trailblazerempire.com/
- Capital Compass — financial, capital and ecosystem strategy (fiscal priorities, monetary conditions, capital flows; research only, not investment advice): https://capitalcompass.trailblazerempire.com/
- Vector Bound — industry and value-chain market intelligence (competitive positioning, sector and semiconductor dynamics): https://vectorbound.trailblazerempire.com/
- TrailBite — Penang food and travel discovery and recommendations: https://trailbite.trailblazerempire.com/
- Nexora — AI, automation and digital enablement (AI strategy, software, workflows, systems): https://nexora.trailblazerempire.com/

Given the context above, answer the question as best as possible.

Question: {question}

Answer:
```

Applied via `PATCH /api/v1/flows/{flow_id}` against the running Langflow instance (same API used for diagnostics earlier in this project). No container restart needed — flow definitions are read from Postgres per run, not baked into the process.

### 2. `assets/nexora-chat.js` (this repo)

Add a `linkify(text)` function returning a `DocumentFragment`: splits `text` on a URL regex (`/(https?:\/\/[^\s]+)/g`), appending a `document.createTextNode` for each plain segment and an `<a>` element for each URL match (trimming common trailing punctuation like `.,;:!?)` off the URL before creating the link, then re-appending that punctuation as trailing text so sentences still read naturally).

In `addMessage`, replace `item.textContent = text;` with `item.appendChild(linkify(text));`. The existing `options.action` inline-button behavior (used by the Book a Call nudge and the offline message) is unaffected — it appends after the linkified text, same as today.

### 3. `public/widget.js` (`trailblazer-rag-chatbot-starter` project)

Same `linkify()` helper (duplicated — these are separate, unbundled static-JS projects with no shared module system, consistent with how the Calendly logic wasn't shared either). In `addMessage`, replace `el.textContent = text;` with `el.appendChild(linkify(text));`.

### 4. CSS (both repos)

Nexora already styles links inside message bubbles (`.nexora-chat__message a { color: var(--nexora-green); font-weight: 700; }`, in `assets/nexora-chat.css`) — no change needed there.

The TrailBlazer AI Assistant widget has no such rule. Its styles are inline, in the `<style>` block inside `widget.js`'s template literal (there is no separate stylesheet for this widget — `public/style.css` belongs to the main site, not it). Add, right after the existing `.tb-bot { ... }` rule:
```css
.tb-message a { color: ${accent}; font-weight: 700; text-decoration: underline; }
```
reusing the widget's existing `accent` variable (already used for the header, launcher and send button) so the link color matches the widget's own theme rather than introducing a new color.

## Data flow

```
Visitor asks a venture-relevant question
  → Langflow retrieves KB context (unchanged) + now also has the venture directory in its system prompt
  → Model's answer includes a venture mention + its URL, only when relevant
  → Relay/proxy returns the answer text unchanged (unchanged in both server.js files)
  → Widget's addMessage() renders it through linkify(), so the URL is a real clickable link
```

## Error handling

- If the model includes a malformed or partial URL, `linkify()`'s regex simply won't match it and it renders as plain text — no crash, no broken link.
- No new failure modes in the relay/proxy layer; this is purely a prompt content change plus a rendering change.

## Testing

Manual, consistent with how Book a Call was verified:
1. Run the flow directly via `/api/v1/run/{flow_id}` (or the Playground) with a handful of test questions per venture (e.g. "who can help with market intelligence?", "I need help with cash flow and capital strategy", "recommend me something for Penang food", "can Nexora help me automate a workflow?", and one off-topic question that should NOT trigger any venture mention) and confirm the right venture (or none) is recommended with the correct URL, before touching any frontend code.
2. In both widgets, confirm a reply containing a URL renders as a real clickable `<a>` element (inspect the DOM, not just visually) and opens in a new tab.
3. Regression check: confirm the Nexora Book a Call chip, nudge, and offline-message button still work unchanged (linkify only touches how `text` is rendered inside `addMessage`, not the action-button mechanism).

## Out of scope

- No changes to the knowledge bases themselves.
- No changes to `nexora-chat-relay/server.js` or `trailblazer-rag-chatbot-starter/server.js` — both already pass the model's text straight through.
- No per-venture tracking/analytics of which links get clicked.
