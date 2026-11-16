// SpendWise interactive demo: the spending moment flow.
//
// Calls the Nudge Lambda (via API Gateway) for the insight sentence.
// If the endpoint is not configured or unreachable, a local copy of the same
// rules runs instead, so the demo always works. Keep LOCAL_RULES in sync with
// infrastructure/lambda/nudge.py.
//
// Set nudgeApiEndpoint in demo-config.js to the CloudFormation ApiEndpoint output.

(function () {
  "use strict";

  const NUDGE_API_ENDPOINT = window.SPENDWISE_CONFIG?.nudgeApiEndpoint || "";
  const API_TIMEOUT_MS = 4000;
  const GROUNDING_SECONDS = 10;
  // ---------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------
  const QUESTIONS = {
    feeling: {
      prompt: "How are you feeling right now?",
      opts: ["Good", "Stressed", "Tired", "Bored", "Excited"],
    },
    planned: {
      prompt: "Was this on your mind before today?",
      opts: ["Been planning it", "Just saw it now", "Not sure"],
    },
    wait: {
      prompt: "Could you wait 20 minutes on this?",
      opts: ["Yes, easy", "Maybe", "I need it now"],
    },
  };

  const LOCAL_RULES = [
    [
      { feeling: "Stressed", planned: "Just saw it now" },
      "You found this while stressed and hadn't planned on it. Worth sitting with that for a moment.",
    ],
    [
      { feeling: "Tired", planned: "Just saw it now" },
      "Late-night browsing while tired is when most things end up in carts. This one might look different in the morning.",
    ],
    [
      { feeling: "Bored", planned: "Just saw it now" },
      "Boredom-browsing accounts for a lot of things people end up not keeping. No judgment, just worth noticing.",
    ],
    [
      { feeling: "Stressed", wait: "I need it now" },
      "The urgency feels real right now. It usually does when you're stressed. Give it twenty minutes and the feeling tends to shift.",
    ],
    [
      { feeling: "Excited", planned: "Just saw it now" },
      "Excitement is a good feeling to buy from, as long as it is about the thing itself and not just the act of buying.",
    ],
    [
      { planned: "Been planning it", wait: "Yes, easy" },
      "You planned this one and you're not in a rush. That's about as confident as a purchase decision gets.",
    ],
    [
      { planned: "Been planning it" },
      "This was on your mind before today. Planned purchases tend to stick, and this one probably will too.",
    ],
    [
      { feeling: "Good", planned: "Just saw it now" },
      "You're feeling good and saw something you liked. Just check it's the thing you want, not the feeling you're chasing.",
    ],
    [
      { wait: "I need it now" },
      "When something feels urgent, that urgency is worth a closer look. Twenty minutes almost never changes whether something is right for you.",
    ],
    [
      { wait: "Yes, easy" },
      "You're relaxed about this one. That's usually a good sign: not anxious to buy, just interested.",
    ],
    [
      { feeling: "Tired" },
      "Decisions made when you are tired tend to look different the next morning. Not always, but often enough to be worth a pause.",
    ],
  ];
  const DEFAULT_INSIGHT =
    "No wrong answer here. The fact that you paused at all is worth something.";

  const OUTCOMES = {
    bought: { title: "Continue shopping", sub: "You chose to continue. This demo has not made a purchase." },
    paused: { title: "Consider it later", sub: "You chose to take more time. No item is reserved and no reminder is scheduled." },
    removed: { title: "Sample item dismissed", sub: "You chose to leave this item. No retailer cart has changed." },
    skipped: { title: "Reflection skipped", sub: "You can leave whenever you like. No purchase or cart action was taken." },
  };
  const NOTES = {
    cart: { tag: "Sample scenario", title: "A check in before a decision", body: "This sample purchase starts a reflection. You can exit at any point. SpendWise does not connect to a retailer or payment service." },
    scan: { tag: "Optional mirror", title: "Camera access is your choice", body: "The mirror shows a local preview only. No emotion model runs, no recording is made, and camera frames are not sent to the insight API." },
    question: { tag: "Three questions", title: "Answer in your own terms", body: "Question order varies between runs. There are no right answers, and no score is calculated." },
    grounding: { tag: "Optional pause", title: "Take ten seconds, or skip", body: "An urgent answer offers a short pause. You can skip it or exit immediately." },
    reason: { tag: "Optional reflection", title: "A few words for yourself", body: "Your reason stays in this page's memory. It is not sent to the API or saved as history." },
    insight: { tag: "Rules-based insight", title: "A reflection, not a verdict", body: "An ordered set of rules returns one sentence from your three answers. When configured, AWS Lambda runs those rules. The same rules run locally when the API is unavailable." },
    outcome: { tag: "Demo outcome", title: "The decision stays with you", body: "All outcomes are simulated. This prototype does not store history, reserve items, change carts, schedule reminders, or make purchases." },
  };

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  const state = {
    queue: [],
    i: 0,
    order: [],
    answers: {},
    reason: "",
    outcome: null,
    insight: null,
    insightToken: 0,
    interacted: false,
    cameraDenied: false,
  };
  let mirrorStream = null;
  let mirrorToken = 0;
  let insightController = null;
  let groundingTimer = null;
  let mount = null;

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function localInsight(answers) {
    for (const [conditions, text] of LOCAL_RULES) {
      if (Object.keys(conditions).every((k) => answers[k] === conditions[k]))
        return text;
    }
    return DEFAULT_INSIGHT;
  }

  async function getNudgeInsight(feeling, planned, wait) {
    const answers = { feeling, planned, wait };
    const started = performance.now();
    if (!NUDGE_API_ENDPOINT || !/^https:\/\//.test(NUDGE_API_ENDPOINT)) {
      return {
        insight: localInsight(answers),
        source: "local",
        note: "API endpoint not configured yet",
      };
    }
    const controller = new AbortController();
    insightController = controller;
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const res = await fetch(NUDGE_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      if (!data || typeof data.insight !== "string" || !data.insight.trim() || data.insight.length > 1000) throw new Error("Invalid insight response");
      return {
        insight: data.insight,
        source: "lambda",
        ms: Math.round(performance.now() - started),
      };
    } catch (err) {
      // Failure never prevents a reflection from finishing.
      return {
        insight: localInsight(answers),
        source: "local",
        note: "API unreachable",
      };
    } finally {
      clearTimeout(timer);
      if (insightController === controller) insightController = null;
    }
  }

  function stopMirror() {
    mirrorToken++;
    if (mirrorStream) {
      mirrorStream.getTracks().forEach((t) => t.stop());
      mirrorStream = null;
    }
  }
  function stopGrounding() {
    if (groundingTimer) {
      clearInterval(groundingTimer);
      groundingTimer = null;
    }
  }

  // ---------------------------------------------------------------
  // Flow control
  // ---------------------------------------------------------------
  function start() {
    stopMirror();
    stopGrounding();
    state.order = shuffle(["feeling", "planned", "wait"]);
    state.queue = [
      "cart",
      "scan",
      ...state.order.map((k) => "q:" + k),
      "reason",
      "insight",
      "outcome",
    ];
    state.i = 0;
    state.answers = {};
    state.reason = "";
    state.outcome = null;
    state.insight = null;
    render();
  }

  function go(offset) {
    const reason = mount.querySelector("#swd-reason");
    if (reason) state.reason = reason.value;
    state.i = Math.min(Math.max(state.i + offset, 0), state.queue.length - 1);
    render();
  }

  function setUrgentPause(isUrgent) {
    const activeKey = currentKey();
    const hasPause = state.queue.includes("grounding");
    if (isUrgent && !hasPause)
      state.queue.splice(state.queue.indexOf("reason"), 0, "grounding");
    if (!isUrgent && hasPause)
      state.queue.splice(state.queue.indexOf("grounding"), 1);
    state.i = state.queue.indexOf(activeKey);
  }

  function finish(outcome) {
    state.outcome = outcome;
    // Jump to the outcome screen
    state.i = state.queue.indexOf("outcome");
    render();
  }

  // ---------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------
  const ICON_STAR =
    '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 2L10.5 6.5H15.5L11.5 9.5L13 14L9 11L5 14L6.5 9.5L2.5 6.5H7.5L9 2Z" fill="#2455be"/></svg>';
  const ICON_CHECK =
    '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M6 13.5L11 18.5L20 8" stroke="#2455be" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function screenCart() {
    return `
      <div class="swd-product">
        <div class="swd-thumb" aria-hidden="true"></div>
        <div><div class="swd-pname">Sportswear club fleece</div><div class="swd-pprice">$68.00</div></div>
      </div>
      <div class="swd-center">
        <h3 class="swd-h" tabindex="-1">Quick check before this one</h3>
        <p class="swd-sub">Nudge here. Three quick questions. No wrong answers.</p>
      </div>
      <button class="swd-btn" data-action="next">Start reflection</button>`;
  }

  function screenScan() {
    return `
      <div class="swd-center">
        <div class="swd-mirror" id="swd-mirror"><span class="swd-mirror-ph" aria-hidden="true">&#9673;</span></div>
        <h3 class="swd-h" tabindex="-1">Optional mirror</h3>
        <p class="swd-sub" id="swd-scan-msg" aria-live="polite">Stays on your device. In this demo it is only a mirror: no emotion model runs and nothing is recorded.</p>
      </div>
      ${state.cameraDenied ? '<p class="swd-sub" role="status">Camera access was unavailable. You can skip this step.</p>' : '<button class="swd-btn" data-action="scan">Use camera</button>'}
      <button class="swd-quiet" data-action="next">Skip camera</button>`;
  }

  function screenQuestion(key) {
    const q = QUESTIONS[key];
    const sel = state.answers[key];
    return `
      <fieldset class="swd-opts">
        <legend class="swd-h swd-left" tabindex="-1">${q.prompt}</legend>
        ${q.opts.map((o) => `<label class="swd-opt"><input type="radio" name="${key}" value="${o}" data-key="${key}" ${sel === o ? "checked" : ""}> <span>${o}</span></label>`).join("")}
      </fieldset>
      <div class="swd-spacer"></div>
      <button class="swd-btn" data-action="next" ${sel ? "" : "disabled"}>Continue</button>`;
  }

  function screenGrounding() {
    return `
      <div class="swd-center">
        <div class="swd-avatar">${ICON_STAR}</div>
        <h3 class="swd-h" tabindex="-1">You said you need it now</h3>
        <p class="swd-sub">That is worth sitting with for ten seconds. No pressure either way.</p>
        <div class="swd-count" id="swd-count" aria-live="off">${GROUNDING_SECONDS}</div>
      </div>
      <button class="swd-btn" id="swd-ground-btn" data-action="next" disabled>Continue</button>
      <button class="swd-quiet" data-action="next">Skip pause</button>`;
  }

  function screenReason() {
    return `
      <div class="swd-label">Optional</div>
      <h3 class="swd-h swd-left" tabindex="-1">In your own words, why this one, right now?</h3>
      <label class="swd-reason-label" for="swd-reason">Your reason</label>
      <p class="swd-sub" id="swd-reason-help">Optional, up to 140 characters. Stays in this page and clears when you start another reflection.</p>
      <textarea id="swd-reason" class="swd-ta" rows="3" maxlength="140" aria-describedby="swd-reason-help" placeholder="A few words, or skip"></textarea>
      <div class="swd-spacer"></div>
      <button class="swd-btn" data-action="reason-next">Continue</button>
      <button class="swd-quiet" data-action="reason-skip">Skip. I'd rather not say</button>`;
  }

  function screenInsight() {
    return `
      <h3 class="swd-h" tabindex="-1">What feels right?</h3>
      <div class="swd-label">Based on what you shared</div>
      <div class="swd-insight" id="swd-insight" aria-live="polite">
        Preparing your reflection…
      </div>

      <div class="swd-pname" style="margin-top:12px">Sportswear club fleece, $68.00</div>
      <div class="swd-spacer"></div>
      <button class="swd-choice" data-action="choose" data-outcome="paused">Consider later</button>
      <button class="swd-choice" data-action="choose" data-outcome="removed">Dismiss sample item</button>
      <button class="swd-choice" data-action="choose" data-outcome="bought">Continue shopping</button>`;
  }

  function screenOutcome() {
    const o = OUTCOMES[state.outcome] || OUTCOMES.paused;
    return `
      <div class="swd-center">
        <div class="swd-ring">${ICON_CHECK}</div>
        <h3 class="swd-h" tabindex="-1">${o.title}</h3>
        <p class="swd-sub">${o.sub}</p>
      </div>
      <button class="swd-btn" data-action="restart">Start another reflection</button>`;
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  function currentKey() {
    return state.queue[state.i];
  }

  function noteFor(key) {
    if (key.startsWith("q:")) {
      const n = NOTES.question;
      const sequence = state.order
        .map((k) =>
          k === "feeling" ? "feeling" : k === "planned" ? "planned" : "wait",
        )
        .join(", ");
      return { ...n, extra: "Order this run: " + sequence + "." };
    }
    return NOTES[key];
  }

  function render() {
    const key = currentKey();
    mount.querySelector("#swd-meta").textContent = "";
    mount.querySelector("#swd-status").textContent = "";
    state.insightToken++;
    if (insightController) insightController.abort();
    if (key !== "scan") stopMirror();
    if (key !== "grounding") stopGrounding();

    let html = "";
    if (key === "cart") html = screenCart();
    else if (key === "scan") html = screenScan();
    else if (key.startsWith("q:")) html = screenQuestion(key.slice(2));
    else if (key === "grounding") html = screenGrounding();
    else if (key === "reason") html = screenReason();
    else if (key === "insight") html = screenInsight();
    else if (key === "outcome") html = screenOutcome();

    const back = state.i > 0 && key !== "outcome" ? '<button class="swd-ghost swd-back" data-action="back">Back</button>' : "";
    mount.querySelector("#swd-screen").innerHTML = html + back + (key !== "outcome" ? '<button class="swd-quiet swd-exit" data-action="choose" data-outcome="skipped">Exit reflection</button>' : '');
    const reason = mount.querySelector("#swd-reason");
    if (reason) reason.value = state.reason;
    const stages = { cart: "Sample purchase", scan: "Optional mirror", grounding: "Optional pause", reason: "Optional written reflection", insight: "Your decision", outcome: "Decision summary" };
    mount.querySelector("#swd-progress").textContent = key.startsWith("q:") ? "Question " + (state.order.indexOf(key.slice(2)) + 1) + " of 3" : stages[key];

    const note = noteFor(key);
    mount.querySelector("#swd-notes").innerHTML = `
      <span class="swd-tag">${note.tag}</span>
      <h3>${note.title}</h3>
      <p>${note.body}</p>
      ${note.extra ? `<p class="swd-extra">${note.extra}</p>` : ""}`;

    if (state.interacted) {
      const h = mount.querySelector(".swd-h");
      if (h) h.focus();
    }

    if (key === "grounding") runGrounding();
    if (key === "insight") loadInsight();

  }

  function runGrounding() {
    let left = GROUNDING_SECONDS;
    const countEl = mount.querySelector("#swd-count");
    const btn = mount.querySelector("#swd-ground-btn");
    groundingTimer = setInterval(() => {
      left -= 1;
      if (countEl) countEl.textContent = Math.max(left, 0);
      if (left <= 0) {
        stopGrounding();
        if (btn) { btn.disabled = false; mount.querySelector("#swd-status").textContent = "Pause complete. You can continue."; }
      }
    }, 1000);
  }

  async function loadInsight() {
    const token = ++state.insightToken;
    const { feeling = "", planned = "", wait = "" } = state.answers;
    const result = await getNudgeInsight(feeling, planned, wait);
    if (token !== state.insightToken || currentKey() !== "insight") return;
    state.insight = result;
    const box = mount.querySelector("#swd-insight");
    const meta = mount.querySelector("#swd-meta");
    if (box) box.textContent = result.insight;
    if (meta) {
      meta.textContent =
        result.source === "lambda"
          ? "Generated by AWS Lambda in " +
            result.ms +
            " ms. Sent: feeling, planned, wait."
          : "Local fallback (" + result.note + "). " + (NUDGE_API_ENDPOINT ? "A request with the three selected answers may have reached the API." : "No API request was made." );
    }
  }

  // ---------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------
  async function startMirror() {
    const box = mount.querySelector("#swd-mirror");
    const msg = mount.querySelector("#swd-scan-msg");
    const btn = mount.querySelector('[data-action="scan"]');
    const token = ++mirrorToken;
    btn.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (token !== mirrorToken || currentKey() !== "scan") {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      mirrorStream = stream;
      const v = document.createElement("video");
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.srcObject = mirrorStream;
      v.setAttribute("aria-label", "Mirror preview");
      box.innerHTML = "";
      box.appendChild(v);
      msg.textContent =
        "Just you. Take a breath, then continue when you are ready.";
      btn.disabled = false;
      btn.textContent = "Continue";
      btn.dataset.action = "next";
    } catch (e) {
      if (token !== mirrorToken || currentKey() !== "scan") return;
      msg.textContent =
        "Camera is not available here, and that is completely fine. Skipping loses nothing.";
      state.cameraDenied = true;
      btn.style.display = "none";
      mount.querySelector('[data-action="next"]').focus();
    }
  }

  function onClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    state.interacted = true;
    switch (el.dataset.action) {
      case "back":
        go(-1);
        break;
      case "next":
        go(1);
        break;
      case "scan":
        startMirror();
        break;
      case "reason-next": {
        const ta = mount.querySelector("#swd-reason");
        state.reason = ta ? ta.value.trim() : "";
        go(1);
        break;
      }
      case "reason-skip":
        state.reason = "";
        mount.querySelector("#swd-reason").value = "";
        go(1);
        break;
      case "choose":
        finish(el.dataset.outcome);
        break;
      case "restart":
        start();
        break;
    }
  }

  // ---------------------------------------------------------------
  // Mount and styles
  // ---------------------------------------------------------------
  function init() {
    mount = document.getElementById("demo-mount");
    if (!mount) {
      console.log("[SpendWise] demo.js loaded, no #demo-mount on this page");
      return;
    }


    mount.innerHTML = `
      <div class="swd">
        <div class="app-device swd-phone" role="group" aria-label="SpendWise interactive demo">
          <div class="app-status" aria-hidden="true"><span>9:41</span><span>▰</span></div>
          <div class="app-screen-content swd-phone-content" tabindex="0" role="region" aria-label="Demo screen; scroll to reach all controls">
            <p class="swd-progress" id="swd-progress"></p>
            <div id="swd-screen"></div>
          </div>
          <div class="swd-home-indicator" aria-hidden="true"></div>
        </div>
        <details class="swd-notes" id="swd-explanation">
          <summary>About this step</summary>
          <div class="swd-explanation-content">
          <div id="swd-notes"></div>
          <p class="swd-meta" id="swd-meta" aria-live="polite"></p>
          <div class="swd-foot">This is a prototype. Your answers are not stored. Only the three selected answers are included in the API request body when configured. The API provider receives normal connection metadata such as an IP address. Your optional written reason and camera frames stay in your browser.</div>
          </div>
        </details>
      </div>`;

    function responsiveDisclosure(element, query) {
      if (!element) return;
      const media = window.matchMedia(query);
      const sync = () => { element.open = media.matches; };
      sync();
      media.addEventListener("change", sync);
    }
    responsiveDisclosure(mount.querySelector("#swd-explanation"), "(min-width: 1001px)");
    mount.insertAdjacentHTML("beforeend", '<p id="swd-status" class="swd-sr" role="status"></p>');
    mount.addEventListener("click", onClick);
    mount.addEventListener("change", event => {
      const input = event.target;
      if (!input.matches('input[type="radio"][data-key]')) return;
      state.interacted = true;
      state.answers[input.dataset.key] = input.value;
      if (input.dataset.key === "wait") setUrgentPause(input.value === "I need it now");
      mount.querySelector('[data-action="next"]').disabled = false;
    });
    window.addEventListener("pagehide", () => { stopMirror(); stopGrounding(); state.insightToken++; if (insightController) insightController.abort(); });
    start();
  }

  // Debugging surface for local verification
  window.SpendWise = { state, getNudgeInsight };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
