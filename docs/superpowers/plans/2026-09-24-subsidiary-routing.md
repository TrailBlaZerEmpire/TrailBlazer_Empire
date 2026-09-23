# Subsidiary-Routing Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Teach the shared Langflow flow about TrailBlazer Empire's five subsidiary ventures so it recommends the relevant one in context, and make both chatbot widgets render those recommendations as real clickable links.

**Architecture:** One prompt-content change to the shared Langflow flow (via its REST API, not a code change), plus one identical `linkify()` rendering helper duplicated into two separate, unbundled static-JS widgets.

**Tech Stack:** Langflow 1.10.0 REST API (`PATCH /api/v1/flows/{id}`), Node (ad hoc scripts, no framework — same tooling used earlier in this session), vanilla JS/CSS in both widgets.

## Global Constraints

- Langflow base URL: `http://localhost:7860`. Credentials (superuser password, API key) are never hardcoded in this plan — every step sources them at run time from `F:\Projects\trailblazer-rag-chatbot\trailblazer-rag-chatbot-starter\.env`, which already holds them (`LANGFLOW_SUPERUSER`, `LANGFLOW_SUPERUSER_PASSWORD`, `LANGFLOW_API_KEY`).
- Flow id (shared by both widgets): `af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40`.
- Prompt component node id within that flow: `Prompt-POcpa`.
- Venture URLs are exact and verbatim — never invent or alter them:
  - Vision Craft: `https://visioncraft.trailblazerempire.com/`
  - Capital Compass: `https://capitalcompass.trailblazerempire.com/`
  - Vector Bound: `https://vectorbound.trailblazerempire.com/`
  - TrailBite: `https://trailbite.trailblazerempire.com/`
  - Nexora: `https://nexora.trailblazerempire.com/`
- No changes to either relay/proxy server (`nexora-chat-relay/server.js`, `trailblazer-rag-chatbot-starter/server.js`) — both already pass model text through unchanged.
- No changes to any knowledge base.

**Post-hoc addendum (2026-09-24):** the Language Model component (`LanguageModelComponent-XSmrK`) was switched away from Google Gemini to OpenRouter (model `openai/gpt-4o-mini`) partway through this plan's execution, because the Google API key's free-tier daily quota (20 requests/day) was exhausted. Its `api_key` field is now `{load_from_db: true, value: "OPENROUTER_API_KEY"}`, referencing a Langflow global variable of that name (Settings → Global Variables) rather than any hardcoded value. This component only offers Google Generative AI or OpenRouter as providers — there is no native Groq option in this build.

---

### Task 1: Update the shared Langflow flow's Prompt component

**Files:** none in either repo — this is a live API mutation against the running Langflow instance's Postgres-backed flow definition.

**Interfaces:**
- Consumes: `POST /api/v1/login` (existing, already used earlier this session), `GET /api/v1/flows/{id}`, `PATCH /api/v1/flows/{id}`.
- Produces: nothing consumed by Task 2 or 3 — those only depend on the *rendering* side, not on this task having run first. Order doesn't matter, but doing this one first lets you verify the AI's actual answer text before touching any frontend.

- [x] **Step 1: Fetch the current flow and confirm the baseline template**

```bash
set -a; source "F:/Projects/trailblazer-rag-chatbot/trailblazer-rag-chatbot-starter/.env"; set +a
TOKEN=$(curl -s -X POST http://localhost:7860/api/v1/login -d "username=$LANGFLOW_SUPERUSER&password=$LANGFLOW_SUPERUSER_PASSWORD" -H "Content-Type: application/x-www-form-urlencoded" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--Projects-trailblazer-rag-chatbot-trailblazer-rag-chatbot-starter/5d9af071-5f73-4016-968e-db9cd2df54b8/scratchpad"
curl -s http://localhost:7860/api/v1/flows/af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40 -H "Authorization: Bearer $TOKEN" -o "$SP/flow_before.json" -w "HTTP %{http_code}\n"
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$SP/flow_before.json', 'utf8'));
const p = d.data.nodes.find(n => n.id === 'Prompt-POcpa');
console.log(p.data.node.template.template.value);
"
```

Expected output (must match exactly before proceeding — if it doesn't, someone has already changed this prompt and you need to re-plan, not blindly overwrite):

```
{context}

---

Given the context above, answer the question as best as possible.

Question: {question}

Answer:
```

- [x] **Step 2: Build the mutated flow payload**

```bash
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--Projects-trailblazer-rag-chatbot-trailblazer-rag-chatbot-starter/5d9af071-5f73-4016-968e-db9cd2df54b8/scratchpad"
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$SP/flow_before.json', 'utf8'));
const p = d.data.nodes.find(n => n.id === 'Prompt-POcpa');
const newTemplate = \`{context}

---

TrailBlazer Empire has five subsidiary ventures. When the visitor's question relates to one of these areas, mention the most relevant venture by name and include its link so they can learn more or engage directly. Only recommend a venture when it is genuinely relevant to what was asked — do not list all five every time, and never invent a URL that is not in this list.

- Vision Craft — strategic diagnosis and organizational framing (clarifying ownership, resolving cross-team disconnects): https://visioncraft.trailblazerempire.com/
- Capital Compass — financial, capital and ecosystem strategy (fiscal priorities, monetary conditions, capital flows; research only, not investment advice): https://capitalcompass.trailblazerempire.com/
- Vector Bound — industry and value-chain market intelligence (competitive positioning, sector and semiconductor dynamics): https://vectorbound.trailblazerempire.com/
- TrailBite — Penang food and travel discovery and recommendations: https://trailbite.trailblazerempire.com/
- Nexora — AI, automation and digital enablement (AI strategy, software, workflows, systems): https://nexora.trailblazerempire.com/

Given the context above, answer the question as best as possible.

Question: {question}

Answer:\`;
p.data.node.template.template.value = newTemplate;
fs.writeFileSync('$SP/flow_patch.json', JSON.stringify({ data: d.data }));
console.log('wrote flow_patch.json, bytes:', fs.statSync('$SP/flow_patch.json').size);
"
```

- [x] **Step 3: PATCH the flow**

```bash
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--Projects-trailblazer-rag-chatbot-trailblazer-rag-chatbot-starter/5d9af071-5f73-4016-968e-db9cd2df54b8/scratchpad"
set -a; source "F:/Projects/trailblazer-rag-chatbot/trailblazer-rag-chatbot-starter/.env"; set +a
TOKEN=$(curl -s -X POST http://localhost:7860/api/v1/login -d "username=$LANGFLOW_SUPERUSER&password=$LANGFLOW_SUPERUSER_PASSWORD" -H "Content-Type: application/x-www-form-urlencoded" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")
curl -s -X PATCH http://localhost:7860/api/v1/flows/af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data @"$SP/flow_patch.json" \
  -w "\nHTTP %{http_code}\n" -o "$SP/flow_patch_response.json"
```

Expected: `HTTP 200`.

- [x] **Step 4: Verify the new template is live**

```bash
set -a; source "F:/Projects/trailblazer-rag-chatbot/trailblazer-rag-chatbot-starter/.env"; set +a
TOKEN=$(curl -s -X POST http://localhost:7860/api/v1/login -d "username=$LANGFLOW_SUPERUSER&password=$LANGFLOW_SUPERUSER_PASSWORD" -H "Content-Type: application/x-www-form-urlencoded" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")
SP="C:/Users/Owner/AppData/Local/Temp/claude/F--Projects-trailblazer-rag-chatbot-trailblazer-rag-chatbot-starter/5d9af071-5f73-4016-968e-db9cd2df54b8/scratchpad"
curl -s http://localhost:7860/api/v1/flows/af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40 -H "Authorization: Bearer $TOKEN" -o "$SP/flow_after.json"
node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$SP/flow_after.json', 'utf8'));
const p = d.data.nodes.find(n => n.id === 'Prompt-POcpa');
console.log(p.data.node.template.template.value.includes('Vision Craft') ? 'PASS: venture directory present' : 'FAIL: venture directory missing');
"
```

Expected: `PASS: venture directory present`.

- [x] **Step 5: Run 5 test questions against the live flow and manually judge the answers**

```bash
set -a; source "F:/Projects/trailblazer-rag-chatbot/trailblazer-rag-chatbot-starter/.env"; set +a
ask() {
  curl -s -X POST "http://localhost:7860/api/v1/run/af5f8f1f-d4b5-4ad4-a725-a72e66c4fd40?stream=false" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $LANGFLOW_API_KEY" \
    -d "{\"input_value\":\"$1\",\"input_type\":\"chat\",\"output_type\":\"chat\"}" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.outputs[0].outputs[0].results.message.data.text);})"
  echo "---"
}
ask "Who can help me with market intelligence for the semiconductor industry?"
ask "I need help thinking through capital strategy and cash flow."
ask "Can you recommend somewhere to eat in Penang?"
ask "I need to automate some workflows with AI."
ask "What is TrailBlazer Empire's five-stage method?"
```

Expected, read manually (this is judgment, not an exact-match assertion — an LLM's exact wording varies):
- Q1 → mentions **Vector Bound** and its URL.
- Q2 → mentions **Capital Compass** and its URL.
- Q3 → mentions **TrailBite** and its URL.
- Q4 → mentions **Nexora** and its URL.
- Q5 → does **not** shoehorn in a venture mention (this is a general question about the group's method, already covered by the knowledge base — answering it doesn't require picking one venture).

If any answer recommends a venture with a URL not in the fixed list, or recommends a venture on the unrelated Q5, revise the prompt wording (strengthen "only when genuinely relevant" / "never invent a URL") and repeat from Step 2.

**Outcome (actual run):** the model used at test time was `openai/gpt-4o-mini` via OpenRouter (the Google Gemini free-tier quota was exhausted, and the flow was switched to OpenRouter with its `api_key` field linked to the `OPENROUTER_API_KEY` global variable). The first version of the prompt above **failed** 3 of 5: Q1 named Capital Compass instead of Vector Bound, Q2 and Q3 didn't mention any venture at all, and the one correct case (Q4, Nexora) omitted the URL. Root cause: the single free-form paragraph wasn't strong enough disambiguation for "market" (which could plausibly mean Capital Compass or Vector Bound) and didn't hard-require the URL.

Revised template (this is what's actually live now):

```
{context}

---

TrailBlazer Empire has five subsidiary ventures:

- Vision Craft — strategic diagnosis and organizational framing (clarifying ownership, resolving cross-team disconnects): https://visioncraft.trailblazerempire.com/
- Capital Compass — financial, capital and ecosystem strategy (fiscal priorities, monetary conditions, capital flows; research only, not investment advice): https://capitalcompass.trailblazerempire.com/
- Vector Bound — industry and value-chain market intelligence (competitive positioning, sector and semiconductor dynamics): https://vectorbound.trailblazerempire.com/
- TrailBite — Penang food and travel discovery and recommendations: https://trailbite.trailblazerempire.com/
- Nexora — AI, automation and digital enablement (AI strategy, software, workflows, systems): https://nexora.trailblazerempire.com/

Before answering, check whether the question clearly matches ONE of these five ventures based on their descriptions above — match the actual topic, not just shared words. Financial, capital, fundraising or cash-flow topics go to Capital Compass. Industry, competitive, sector or semiconductor topics go to Vector Bound. Food, dining or travel topics go to TrailBite. AI, automation or software topics go to Nexora. Organizational or strategy-framing topics go to Vision Craft.

- If it matches one venture: name that venture and include its exact URL from the list above, verbatim, in your answer. This is required whenever you recommend a venture — never recommend one without also giving its URL.
- If it matches no venture, or the question is a general question about TrailBlazer Empire itself: do not mention any venture.
- Never invent a URL that is not in the list above.

Example:
Question: "Who can help me benchmark competitors in the auto industry?"
Answer: "That falls within Vector Bound's focus on industry and value-chain intelligence. You can learn more at https://vectorbound.trailblazerempire.com/."

Given the context above, answer the question as best as possible.

Question: {question}

Answer:
```

Key changes from v1: (1) explicit per-venture keyword disambiguation instead of one vague "when relevant" line — this is what fixed the Capital Compass/Vector Bound confusion; (2) "never recommend one without also giving its URL" as its own hard rule instead of folded into a softer sentence; (3) a one-shot worked example to anchor the expected phrasing and format. Re-run against all 5 questions: all 5 passed (correct venture + verbatim URL for Q1–Q4, no venture mentioned for Q5).

- [x] **Step 6: No commit for this task** — the change lives in Langflow's Postgres database, not in either git repo. Proceed to Task 2.

---

### Task 2: Clickable links in the Nexora widget

**Files:**
- Modify: `assets/nexora-chat.js`

**Interfaces:**
- Consumes: nothing from Task 1 or 3.
- Produces: `linkify(text)` — a local function returning a `DocumentFragment`. Not exported or consumed elsewhere; Task 3 defines its own independent copy in the other project.

- [x] **Step 1: Add the `linkify` helper**

In `assets/nexora-chat.js`, right after the `openBooking` function definition, add:

```js
  const linkify = (text) => {
    const fragment = document.createDocumentFragment();
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      let url = match[0];
      let trailing = "";
      const trailingMatch = url.match(/[.,;:!?)]+$/);
      if (trailingMatch) {
        trailing = trailingMatch[0];
        url = url.slice(0, -trailing.length);
      }
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.textContent = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      fragment.appendChild(anchor);
      if (trailing) fragment.appendChild(document.createTextNode(trailing));
      lastIndex = urlPattern.lastIndex;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    return fragment;
  };
```

- [x] **Step 2: Use it in `addMessage`**

Find this line inside `addMessage`:

```js
    item.textContent = text;
```

Replace with:

```js
    item.appendChild(linkify(text));
```

- [x] **Step 3: Manually verify in a real browser**

Serve the site locally (`npx serve .` from the repo root, or reuse the `.claude/launch.json` config from the Book a Call task), open the Nexora panel, and use the browser console to call `addMessage` indirectly by mocking `fetch` the same way it was done for the Book a Call nudge testing earlier — or simpler, since Task 1 is already live, just ask a real venture-relevant question (e.g. "Can you recommend somewhere to eat in Penang?") and confirm:
1. The reply renders with a real, clickable, underlined-on-hover link (inspect the DOM: an `<a href="https://trailbite.trailblazerempire.com/">` element, not plain text).
2. Clicking it opens the venture site in a new tab.
3. The existing Book a Call chip, nudge (every 2nd message), and offline auto-button still work unchanged (regression check — `linkify` only changes step inside `addMessage`, not the `options.action` branch).

- [x] **Step 4: Commit**

```bash
cd "/e/TrailBlazer Empire"
git add assets/nexora-chat.js
git commit -m "feat: render clickable links in Nexora assistant replies"
```

---

### Task 3: Clickable links in the TrailBlazer AI Assistant widget

**Files:**
- Modify: `F:\Projects\trailblazer-rag-chatbot\trailblazer-rag-chatbot-starter\public\widget.js`

**Interfaces:**
- Consumes: nothing from Task 1 or 2.
- Produces: nothing consumed elsewhere.

- [x] **Step 1: Add the same `linkify` helper**

In `public/widget.js`, right after the line `root.querySelector('.tb-title').textContent = title;`, add:

```js
  const linkify = (text) => {
    const fragment = document.createDocumentFragment();
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = urlPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      let url = match[0];
      let trailing = '';
      const trailingMatch = url.match(/[.,;:!?)]+$/);
      if (trailingMatch) {
        trailing = trailingMatch[0];
        url = url.slice(0, -trailing.length);
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.textContent = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      fragment.appendChild(anchor);
      if (trailing) fragment.appendChild(document.createTextNode(trailing));
      lastIndex = urlPattern.lastIndex;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    return fragment;
  };
```

- [x] **Step 2: Use it in `addMessage`**

Find:

```js
  function addMessage(text, role) {
    const el = document.createElement('div');
    el.className = `tb-message ${role === 'user' ? 'tb-user' : 'tb-bot'}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
```

Replace with:

```js
  function addMessage(text, role) {
    const el = document.createElement('div');
    el.className = `tb-message ${role === 'user' ? 'tb-user' : 'tb-bot'}`;
    el.appendChild(linkify(text));
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }
```

- [x] **Step 3: Style links to match the widget's theme**

Find:

```css
      .tb-bot { align-self: flex-start; background: #fff; color: #111827; border: 1px solid #e5e7eb; border-bottom-left-radius: 5px; }
```

Add right after it, inside the same `<style>` template literal:

```css
      .tb-message a { color: ${accent}; font-weight: 700; text-decoration: underline; }
```

- [x] **Step 4: Rebuild the chatbot container so it picks up the change**

No commit for this task — `F:\Projects\trailblazer-rag-chatbot\trailblazer-rag-chatbot-starter` is not a git repository (confirmed: no `.git` directory). But the Dockerfile `COPY public ./public`s the widget into the image at build time and it isn't bind-mounted (only `./config` is), so a plain restart will keep serving the old file. Rebuild:

```bash
cd "F:/Projects/trailblazer-rag-chatbot/trailblazer-rag-chatbot-starter"
docker compose up -d --build chatbot
```

- [x] **Step 5: Manually verify in a real browser**

The chatbot container now serves the rebuilt widget at `http://localhost:3000`. Open it, open the chat widget, ask a venture-relevant question (e.g. "I need help thinking through capital strategy and cash flow."), and confirm:
1. The reply renders a real clickable `<a>` element styled in the widget's accent color with an underline, not plain text.
2. Clicking it opens the venture site in a new tab.
3. A normal reply with no URL still renders fine (regression check — empty match loop just returns the original text as a single text node).
