(() => {
  const loader = document.currentScript;
  const endpoint = loader?.dataset.endpoint || "";
  const sessionKey = "trailblazer-nexora-session";
  const createId = () => window.crypto?.randomUUID?.() || `nexora-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = createId();
    sessionStorage.setItem(sessionKey, sessionId);
  }

  const root = document.createElement("aside");
  root.className = "nexora-chat";
  root.dataset.open = "false";
  root.setAttribute("aria-label", "Nexora website assistant");
  root.innerHTML = `
    <section class="nexora-chat__panel" id="nexora-chat-panel" role="dialog" aria-modal="false" aria-labelledby="nexora-chat-title">
      <header class="nexora-chat__header">
        <div class="nexora-chat__identity">
          <span class="nexora-chat__avatar" aria-hidden="true">NX</span>
          <div><strong id="nexora-chat-title">Nexora Assistant</strong><span class="nexora-chat__status">Available during working hours</span></div>
        </div>
        <button class="nexora-chat__close" type="button" aria-label="Close Nexora Assistant">×</button>
      </header>
      <div class="nexora-chat__messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <div class="nexora-chat__prompts" aria-label="Suggested questions">
        <button class="nexora-chat__prompt" type="button">Which venture fits my problem?</button>
        <button class="nexora-chat__prompt" type="button">How can TrailBlazer Empire help?</button>
        <button class="nexora-chat__prompt" type="button">Tell me about Nexora</button>
      </div>
      <form class="nexora-chat__composer">
        <input class="nexora-chat__input" name="message" maxlength="2000" autocomplete="off" placeholder="Ask about our ventures or capabilities…" aria-label="Message Nexora Assistant" required />
        <button class="nexora-chat__send" type="submit" aria-label="Send message">↑</button>
      </form>
      <p class="nexora-chat__note">AI responses may contain errors. Please do not submit confidential information.</p>
    </section>
    <button class="nexora-chat__launcher" type="button" aria-controls="nexora-chat-panel" aria-expanded="false">
      <span class="nexora-chat__launcher-mark" aria-hidden="true">NX</span>
      <span class="nexora-chat__launcher-copy"><strong>Ask Nexora</strong><span>Explore the TrailBlazer ecosystem</span></span>
    </button>`;
  document.body.appendChild(root);

  const panel = root.querySelector(".nexora-chat__panel");
  const launcher = root.querySelector(".nexora-chat__launcher");
  const close = root.querySelector(".nexora-chat__close");
  const messages = root.querySelector(".nexora-chat__messages");
  const form = root.querySelector(".nexora-chat__composer");
  const input = root.querySelector(".nexora-chat__input");
  const send = root.querySelector(".nexora-chat__send");

  const addMessage = (text, kind = "assistant") => {
    const item = document.createElement("p");
    item.className = `nexora-chat__message${kind === "user" ? " nexora-chat__message--user" : ""}${kind === "typing" ? " nexora-chat__message--typing" : ""}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  };

  addMessage("Hello—I'm Nexora, the digital enablement venture within TrailBlazer Empire. I can help you understand the group, explore its five ventures, or identify where your business problem may fit.");

  const setOpen = (open) => {
    root.dataset.open = String(open);
    launcher.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => input.focus(), 30);
    else launcher.focus();
  };
  launcher.addEventListener("click", () => setOpen(root.dataset.open !== "true"));
  close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.dataset.open === "true") setOpen(false);
  });

  const submitMessage = async (value) => {
    const message = value.trim();
    if (!message || send.disabled) return;
    addMessage(message, "user");
    input.value = "";
    input.disabled = true;
    send.disabled = true;
    const typing = addMessage("Nexora is thinking…", "typing");
    try {
      if (!endpoint) throw new Error("Chat endpoint is not configured.");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The assistant is unavailable.");
      typing.remove();
      addMessage(payload.answer || "I couldn't produce a response. Please try again.");
    } catch (error) {
      typing.remove();
      const offline = /fetch|unavailable|offline|configured/i.test(error.message);
      addMessage(offline
        ? "Nexora is currently offline. This working-hours service will return when the TrailBlazer system is online. You can still reach the team through the Contact page."
        : "I couldn't complete that request. Please try again shortly.");
    } finally {
      input.disabled = false;
      send.disabled = false;
      input.focus();
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitMessage(input.value);
  });
  root.querySelectorAll(".nexora-chat__prompt").forEach((button) => {
    button.addEventListener("click", () => submitMessage(button.textContent));
  });
})();

