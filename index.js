// index.js
// =============================================================================
// QUEUE CURE '26 — Smart Clinic Queue System (single-file build)
// Everything lives in this one file on purpose: server, persistence,
// real-time logic, and both screens (HTML+CSS+JS inlined as template
// strings — so the whole project is just this file + package.json.
// =============================================================================

const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const DB_FILE = path.join(__dirname, "db.json");

// -----------------------------------------------------------------------------
// STORE — persistence + queue business logic
// -----------------------------------------------------------------------------
const DEFAULT_STATE = {
  nextTokenNumber: 1,
  avgConsultationTime: 15,
  currentToken: null,
  queue: [], // { id, tokenNumber, label, name, status, createdAt, calledAt? }
  lastResetDate: new Date().toDateString(),
};

function readState() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { ...DEFAULT_STATE, lastResetDate: new Date().toDateString() };
    writeState(initial);
    return initial;
  }
  const state = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  const today = new Date().toDateString();
  if (state.lastResetDate !== today) {
    state.queue = [];
    state.nextTokenNumber = 1;
    state.currentToken = null;
    state.lastResetDate = today;
    writeState(state);
  }
  return state;
}

function writeState(state) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

function addPatient(name) {
  const state = readState();
  const cleanName = (name || "").trim();
  if (!cleanName) throw new Error("Patient name is required.");

  state.queue.push({
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tokenNumber: state.nextTokenNumber,
    label: `Q-${String(state.nextTokenNumber).padStart(3, "0")}`,
    name: cleanName,
    status: "Waiting",
    createdAt: new Date().toISOString(),
  });
  state.nextTokenNumber += 1;
  writeState(state);
  return state;
}

function callNext() {
  const state = readState();

  if (state.currentToken) {
    const current = state.queue.find((t) => t.id === state.currentToken.id);
    if (current) current.status = "Completed";
  }

  const next = state.queue.find((t) => t.status === "Waiting");

  if (!next) {
    state.currentToken = null;
    writeState(state);
    const err = new Error("No patients currently in queue.");
    err.code = "EMPTY_QUEUE";
    throw err;
  }

  next.status = "In-Consultation";
  next.calledAt = new Date().toISOString();
  state.currentToken = { id: next.id, tokenNumber: next.tokenNumber, label: next.label, name: next.name };

  writeState(state);
  return state;
}

function cancelToken(id) {
  const state = readState();
  const token = state.queue.find((t) => t.id === id);
  if (!token) throw new Error("That token no longer exists.");
  if (token.status !== "Waiting") throw new Error("Only a patient still Waiting can be cancelled.");

  token.status = "No-show";
  token.cancelledAt = new Date().toISOString();
  writeState(state);
  return state;
}

function resetQueue() {
  const state = readState();
  state.queue = [];
  state.nextTokenNumber = 1;
  state.currentToken = null;
  state.lastResetDate = new Date().toDateString();
  writeState(state);
  return state;
}

function setAvgConsultationTime(minutes) {
  const state = readState();
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Average consultation time must be a positive number.");
  state.avgConsultationTime = value;
  writeState(state);
  return state;
}

function getState() {
  return readState();
}

function getPublicView() {
  const state = readState();
  const waitingList = state.queue.filter((t) => t.status === "Waiting");
  const tokensAhead = waitingList.length;

  return {
    currentToken: state.currentToken,
    tokensAhead,
    noWait: tokensAhead === 0,
    avgConsultationTime: state.avgConsultationTime,
    estimatedWaitMinutes: tokensAhead * state.avgConsultationTime,
  };
}

function getAnalytics() {
  const state = readState();
  const todayKey = new Date().toDateString();
  const todaysTokens = state.queue.filter((t) => new Date(t.createdAt).toDateString() === todayKey);

  const waits = todaysTokens.filter((t) => t.calledAt).map((t) => (new Date(t.calledAt) - new Date(t.createdAt)) / 60000);
  const averageWaitMinutes = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : 0;

  return {
    patientsToday: todaysTokens.length,
    servedToday: todaysTokens.filter((t) => t.status === "Completed" || t.status === "In-Consultation").length,
    noShowsToday: todaysTokens.filter((t) => t.status === "No-show").length,
    averageWaitMinutes,
  };
}

// -----------------------------------------------------------------------------
// SHARED CSS — used by both pages
// -----------------------------------------------------------------------------
const STYLES = `
:root {
  --paper:#faf6ee; --paper-card:#ffffff; --ink:#16302c; --ink-soft:#5b6e69;
  --teal:#0e3b36; --teal-deep:#082522; --coral:#ff5a45; --coral-deep:#d6402d; --line:#e4ddcc;
  --board:#0a1614; --board-panel:#0f201d; --amber:#ffb454; --amber-dim:#7a5a2c;
  --amber-glow:rgba(255,180,84,.55); --board-line:#1c322d;
  --font-display: ui-monospace,"SF Mono","Cascadia Code","Courier New",monospace;
  --font-body: -apple-system,"Segoe UI",system-ui,sans-serif; --radius:14px;
}
[data-theme="dark"]{ --paper:#11201d; --paper-card:#16302c; --ink:#ecf3ef; --ink-soft:#9fb3ad; --teal:#6fd9c4; --teal-deep:#0a1a17; --line:#234039; }
[data-theme="dark"] .desk__title{color:#f3ede0;}
[data-theme="dark"] .now-serving{background:#0a1a17;}
[data-theme="dark"] .input{color:#ecf3ef;}
[data-theme="dark"] .btn--primary{color:#0a1a17;}
[data-theme="dark"] .ticket--Completed{opacity:.55;}
* { box-sizing:border-box; } body{margin:0;font-family:var(--font-body);color:var(--ink);} button{font-family:inherit;}

.desk{min-height:100vh;background:radial-gradient(circle at 100% 0%,#fff 0%,transparent 45%),var(--paper);padding:32px 20px 60px;}
.desk__header{max-width:720px;margin:0 auto 28px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.desk__brand{display:flex;align-items:center;gap:10px;}
.desk__logo{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:var(--teal-deep);color:#fff;flex-shrink:0;}
.desk__header-actions{display:flex;align-items:center;gap:14px;}
.theme-toggle{border:1px solid var(--line);background:var(--paper-card);border-radius:8px;width:34px;height:34px;font-size:15px;cursor:pointer;line-height:1;}
.desk__eyebrow{font-family:var(--font-display);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--coral-deep);margin:0 0 4px;}
.desk__title{font-size:26px;font-weight:700;margin:0;color:var(--teal-deep);}
.desk__link{font-size:13px;color:var(--teal);text-decoration:none;border-bottom:1px solid var(--teal);white-space:nowrap;}
.card{max-width:720px;margin:0 auto 20px;background:var(--paper-card);border:1px solid var(--line);border-radius:var(--radius);padding:24px;box-shadow:0 1px 0 var(--line);}
.card__label{font-family:var(--font-display);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 14px;}
.add-form{display:flex;gap:10px;}
.input{flex:1;padding:13px 14px;border-radius:10px;border:1.5px solid var(--line);font-size:15px;background:var(--paper);color:var(--ink);}
.input:focus{outline:2px solid var(--teal);outline-offset:1px;}
.btn{border:none;border-radius:10px;padding:13px 20px;font-size:15px;font-weight:600;cursor:pointer;transition:transform .08s ease,opacity .15s ease;}
.btn:active{transform:scale(.97);} .btn:disabled{opacity:.45;cursor:not-allowed;}
.btn--primary{background:var(--teal);color:#fff;} .btn--primary:hover:not(:disabled){background:var(--teal-deep);}
.btn--call{width:100%;background:var(--coral);color:#fff;font-size:18px;padding:18px;}
.btn--call:hover:not(:disabled){background:var(--coral-deep);}
.btn--reset{width:100%;background:transparent;color:var(--coral-deep);border:1.5px solid var(--coral-deep);font-size:14px;padding:11px;}
.btn--reset:hover:not(:disabled){background:#fff0ee;}
.now-serving{display:flex;align-items:center;justify-content:space-between;background:var(--teal-deep);color:#fff;border-radius:10px;padding:16px 20px;margin-bottom:16px;}
.now-serving__token{font-family:var(--font-display);font-size:28px;font-weight:700;letter-spacing:.04em;}
.now-serving__name{font-size:13px;opacity:.75;margin-top:2px;}
.now-serving__waiting{text-align:right;font-size:13px;opacity:.85;}
.avg-row{display:flex;align-items:center;gap:10px;} .avg-row .input{flex:none;width:90px;} .avg-row span{font-size:14px;color:var(--ink-soft);}
.stat-row{display:flex;gap:10px;}
.mini-stat{flex:1;text-align:center;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:14px 8px;}
.mini-stat__value{font-family:var(--font-display);font-size:22px;font-weight:700;margin:0 0 4px;color:var(--teal-deep);}
[data-theme="dark"] .mini-stat__value{color:var(--teal);}
.mini-stat__label{font-size:11px;color:var(--ink-soft);margin:0;}
.queue-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;}
.ticket{position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;border:1px dashed var(--line);}
.ticket__token{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--teal-deep);min-width:56px;}
.ticket__name{flex:1;font-size:14px;}
.ticket__status{font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:99px;font-weight:600;}
.ticket--Waiting .ticket__status{background:#fdeede;color:#a35b16;}
.ticket--In-Consultation .ticket__status{background:#ffe2dc;color:var(--coral-deep);}
.ticket--Completed{opacity:.45;} .ticket--Completed .ticket__status{background:#e7efe9;color:var(--ink-soft);}
.ticket--No-show{opacity:.5;} .ticket--No-show .ticket__status{background:#f3e3e0;color:var(--coral-deep);}
.ticket__cancel{border:none;background:transparent;color:var(--ink-soft);font-size:14px;width:26px;height:26px;border-radius:50%;cursor:pointer;flex-shrink:0;}
.ticket__cancel:hover{background:#ffe2dc;color:var(--coral-deep);}
.empty-note{font-size:13px;color:var(--ink-soft);text-align:center;padding:14px 0;}
.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:var(--teal-deep);color:#fff;padding:12px 18px;border-radius:10px;font-size:14px;opacity:0;pointer-events:none;transition:opacity .2s ease,transform .2s ease;}
.toast--show{opacity:1;transform:translateX(-50%) translateY(0);}

.board{min-height:100vh;background:var(--board);color:#f3ede0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;position:relative;overflow:hidden;}
.board::before{content:"";position:absolute;inset:18px;border:1px solid var(--board-line);border-radius:18px;pointer-events:none;}
.board__eyebrow{font-family:var(--font-display);font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--amber-dim);margin:0 0 18px;}
.board__current-label{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#8c9b95;margin:0 0 6px;}
.board__token{font-family:var(--font-display);font-weight:700;font-size:clamp(72px,18vw,180px);line-height:1;color:var(--amber);text-shadow:0 0 18px var(--amber-glow),0 0 60px rgba(255,180,84,.25);letter-spacing:.02em;}
.board__token--empty{color:var(--amber-dim);font-size:clamp(32px,6vw,48px);text-shadow:none;}
@keyframes board-flicker{0%{opacity:.2;}18%{opacity:1;}26%{opacity:.4;}34%{opacity:1;}100%{opacity:1;}}
.board__token.is-fresh{animation:board-flicker .6s steps(2,end);}
.board__patient-name{margin-top:10px;font-size:18px;color:#cfc6b3;}
.board__stats{margin-top:48px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.stat{background:var(--board-panel);border:1px solid var(--board-line);border-radius:14px;padding:18px 28px;min-width:160px;}
.stat__label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8c9b95;margin:0 0 8px;}
.stat__value{font-family:var(--font-display);font-size:34px;font-weight:700;color:#f3ede0;}
.stat__value--highlight{color:var(--amber);}
.board__next-up{margin-top:28px;font-size:14px;color:#8c9b95;}
.sound-enable{position:absolute;top:22px;left:50%;transform:translateX(-50%);background:var(--board-panel);border:1px solid var(--board-line);color:var(--amber);font-size:13px;padding:9px 16px;border-radius:99px;cursor:pointer;z-index:2;}
.sound-enable:hover{border-color:var(--amber-dim);}
@media (prefers-reduced-motion: reduce){.board__token.is-fresh{animation:none;}}
@media (max-width:480px){
  .desk{padding:20px 14px 50px;} .card{padding:18px;}
  .now-serving{flex-direction:column;align-items:flex-start;gap:10px;} .now-serving__waiting{text-align:left;}
  .add-form{flex-direction:column;} .stat-row{flex-wrap:wrap;} .mini-stat{min-width:calc(50% - 5px);}
  .desk__header-actions{width:100%;justify-content:space-between;}
  .board{padding:90px 16px 40px;} .board__stats{gap:10px;} .stat{min-width:130px;padding:14px 18px;}
  .sound-enable{top:14px;font-size:12px;padding:7px 12px;}
}
`;

// -----------------------------------------------------------------------------
// RECEPTIONIST PAGE
// -----------------------------------------------------------------------------
const RECEPTIONIST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Queue Cure '26 — Receptionist Desk</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="desk">
    <header class="desk__header">
      <div class="desk__brand">
        <span class="desk__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v18M3 12h18" /></svg>
        </span>
        <div><p class="desk__eyebrow">Queue Cure '26</p><h1 class="desk__title">Receptionist Desk</h1></div>
      </div>
      <div class="desk__header-actions">
        <a class="desk__link" href="/patient" target="_blank" rel="noopener">Open patient board →</a>
        <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode">🌙</button>
      </div>
    </header>

    <div class="card now-serving" id="nowServingCard">
      <div>
        <div class="now-serving__token" id="nowServingToken">—</div>
        <div class="now-serving__name" id="nowServingName">No patient called yet</div>
      </div>
      <div class="now-serving__waiting"><div id="waitingCount">0</div><div>waiting</div></div>
    </div>

    <section class="card">
      <p class="card__label">Today at a glance</p>
      <div class="stat-row">
        <div class="mini-stat"><p class="mini-stat__value" id="statPatients">0</p><p class="mini-stat__label">Patients today</p></div>
        <div class="mini-stat"><p class="mini-stat__value" id="statAvgWait">0 min</p><p class="mini-stat__label">Average wait today</p></div>
        <div class="mini-stat"><p class="mini-stat__value" id="statNoShows">0</p><p class="mini-stat__label">No-shows today</p></div>
      </div>
    </section>

    <section class="card">
      <p class="card__label">Add patient to queue</p>
      <form class="add-form" id="addForm">
        <input class="input" id="nameInput" type="text" placeholder="Patient name" autocomplete="off" maxlength="60" required />
        <button class="btn btn--primary" type="submit">Add</button>
      </form>
    </section>

    <section class="card">
      <p class="card__label">Doctor's room</p>
      <button class="btn btn--call" id="callNextBtn">Call Next Patient</button>
    </section>

    <section class="card">
      <p class="card__label">Average consultation time</p>
      <div class="avg-row">
        <input class="input" id="avgInput" type="number" min="1" step="1" />
        <span>minutes per patient</span>
        <button class="btn btn--primary" id="avgSaveBtn" type="button">Save</button>
      </div>
    </section>

    <section class="card">
      <p class="card__label">Today's queue</p>
      <ul class="queue-list" id="queueList"></ul>
      <p class="empty-note" id="emptyNote" style="display:none;">No patients yet. Add the first one above.</p>
      <button class="btn btn--reset" id="resetQueueBtn" type="button" style="margin-top:14px;">Reset Queue</button>
    </section>
  </div>

  <div class="toast" id="toast"></div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const nowServingToken = document.getElementById("nowServingToken");
    const nowServingName = document.getElementById("nowServingName");
    const waitingCount = document.getElementById("waitingCount");
    const addForm = document.getElementById("addForm");
    const nameInput = document.getElementById("nameInput");
    const callNextBtn = document.getElementById("callNextBtn");
    const avgInput = document.getElementById("avgInput");
    const avgSaveBtn = document.getElementById("avgSaveBtn");
    const queueList = document.getElementById("queueList");
    const resetQueueBtn = document.getElementById("resetQueueBtn");
    const emptyNote = document.getElementById("emptyNote");
    const toast = document.getElementById("toast");
    const themeToggle = document.getElementById("themeToggle");
    const statPatients = document.getElementById("statPatients");
    const statAvgWait = document.getElementById("statAvgWait");
    const statNoShows = document.getElementById("statNoShows");

    let toastTimer = null;
    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("toast--show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("toast--show"), 2600);
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    }
    applyTheme(localStorage.getItem("qc26-theme") || "light");
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem("qc26-theme", next);
      applyTheme(next);
    });

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function render(state) {
      if (state.currentToken) {
        nowServingToken.textContent = state.currentToken.label;
        nowServingName.textContent = state.currentToken.name;
      } else {
        nowServingToken.textContent = "—";
        nowServingName.textContent = "No patient called yet";
      }

      const waitingPatients = state.queue.filter((t) => t.status === "Waiting");
      waitingCount.textContent = waitingPatients.length;
      callNextBtn.disabled = waitingPatients.length === 0;

      if (document.activeElement !== avgInput) avgInput.value = state.avgConsultationTime;

      queueList.innerHTML = "";
      if (state.queue.length === 0) {
        emptyNote.style.display = "block";
      } else {
        emptyNote.style.display = "none";
        state.queue.forEach((t) => {
          const li = document.createElement("li");
          li.className = "ticket ticket--" + t.status.replace(/\s+/g, "-");
          const cancelBtn = t.status === "Waiting"
            ? '<button class="ticket__cancel" data-id="' + t.id + '" type="button" title="Cancel / mark no-show">✕</button>'
            : "";
          li.innerHTML =
            '<span class="ticket__token">' + t.label + '</span>' +
            '<span class="ticket__name">' + escapeHtml(t.name) + '</span>' +
            '<span class="ticket__status">' + t.status + '</span>' + cancelBtn;
          queueList.appendChild(li);
        });
      }
    }

    function renderAnalytics(a) {
      statPatients.textContent = a.patientsToday;
      statAvgWait.textContent = a.averageWaitMinutes + " min";
      statNoShows.textContent = a.noShowsToday;
    }

    Promise.all([
      fetch("/api/queue").then((r) => r.json()),
      fetch("/api/analytics").then((r) => r.json()),
    ]).then(([state, analytics]) => { render(state); renderAnalytics(analytics); })
      .catch(() => showToast("Could not load the queue. Is the server running?"));

    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) return;
      socket.emit("addPatient", { name });
      nameInput.value = "";
      nameInput.focus();
    });

    callNextBtn.addEventListener("click", () => socket.emit("nextPatient"));

    resetQueueBtn.addEventListener("click", () => {
      if (!confirm("Reset the queue? This will clear all patients and restart token numbering from Q-001.")) return;
      socket.emit("resetQueue");
    });

    avgSaveBtn.addEventListener("click", () => {
      socket.emit("setAvgTime", { minutes: Number(avgInput.value) });
      showToast("Average consultation time updated.");
    });

    queueList.addEventListener("click", (e) => {
      const btn = e.target.closest(".ticket__cancel");
      if (!btn) return;
      socket.emit("cancelToken", { id: btn.dataset.id });
    });

    socket.on("queueUpdated", (payload) => { render(payload.full); renderAnalytics(payload.analytics); });
    socket.on("queueError", (err) => showToast(err.message || "Something went wrong."));
  </script>
</body>
</html>`;

// -----------------------------------------------------------------------------
// PATIENT BOARD PAGE
// -----------------------------------------------------------------------------
const PATIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Queue Cure '26 — Now Serving</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="board">
    <button class="sound-enable" id="soundEnableBtn" type="button">🔊 Tap to enable sound</button>
    <p class="board__eyebrow">Queue Cure '26 · Waiting Room</p>
    <p class="board__current-label">Now serving</p>
    <div class="board__token" id="currentToken">—</div>
    <div class="board__patient-name" id="currentName"></div>
    <div class="board__stats">
      <div class="stat"><p class="stat__label">Tokens ahead</p><p class="stat__value" id="tokensAhead">0</p></div>
      <div class="stat"><p class="stat__label">Estimated wait</p><p class="stat__value stat__value--highlight" id="waitValue">0 min</p></div>
    </div>
    <p class="board__next-up" id="nextUpNote"></p>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const currentToken = document.getElementById("currentToken");
    const currentName = document.getElementById("currentName");
    const tokensAhead = document.getElementById("tokensAhead");
    const waitValue = document.getElementById("waitValue");
    const nextUpNote = document.getElementById("nextUpNote");
    const soundEnableBtn = document.getElementById("soundEnableBtn");

    let lastTokenLabel = null;
    let isFirstRender = true;
    let audioCtx = null;
    let soundEnabled = false;

    soundEnableBtn.addEventListener("click", () => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      soundEnabled = true;
      soundEnableBtn.style.display = "none";
    });

    function playChime() {
      if (!soundEnabled || !audioCtx) return;
      const now = audioCtx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    }

    function render(view) {
      if (view.currentToken) {
        currentToken.textContent = view.currentToken.label;
        currentToken.classList.remove("board__token--empty");
        currentName.textContent = view.currentToken.name;
        if (view.currentToken.label !== lastTokenLabel) {
          currentToken.classList.remove("is-fresh");
          void currentToken.offsetWidth;
          currentToken.classList.add("is-fresh");
          if (!isFirstRender) playChime();
          lastTokenLabel = view.currentToken.label;
        }
      } else {
        currentToken.textContent = "Please wait";
        currentToken.classList.add("board__token--empty");
        currentName.textContent = "";
        lastTokenLabel = null;
      }

      tokensAhead.textContent = view.tokensAhead;

      if (view.noWait) {
        waitValue.textContent = "You're next!";
        nextUpNote.textContent = "";
      } else {
        waitValue.textContent = view.estimatedWaitMinutes + " min";
        nextUpNote.textContent = "Based on " + view.avgConsultationTime + " min per patient";
      }
      isFirstRender = false;
    }

    fetch("/api/state").then((r) => r.json()).then(render).catch(() => {
      currentToken.textContent = "Offline";
      currentToken.classList.add("board__token--empty");
    });

    socket.on("queueUpdated", (payload) => render(payload.public));
  </script>
</body>
</html>`;

// -----------------------------------------------------------------------------
// SERVER
// -----------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => res.redirect("/receptionist"));
app.get("/receptionist", (req, res) => res.send(RECEPTIONIST_HTML));
app.get("/patient", (req, res) => res.send(PATIENT_HTML));

app.get("/api/state", (req, res) => res.json(getPublicView()));
app.get("/api/queue", (req, res) => res.json(getState()));
app.get("/api/analytics", (req, res) => res.json(getAnalytics()));

function broadcastQueueUpdate() {
  io.emit("queueUpdated", { full: getState(), public: getPublicView(), analytics: getAnalytics() });
}

io.on("connection", (socket) => {
  socket.emit("queueUpdated", { full: getState(), public: getPublicView(), analytics: getAnalytics() });

  socket.on("addPatient", ({ name } = {}) => {
    try { addPatient(name); broadcastQueueUpdate(); }
    catch (err) { socket.emit("queueError", { message: err.message }); }
  });

  socket.on("nextPatient", () => {
    try { callNext(); broadcastQueueUpdate(); }
    catch (err) { socket.emit("queueError", { message: err.message, code: err.code }); }
  });

  socket.on("cancelToken", ({ id } = {}) => {
    try { cancelToken(id); broadcastQueueUpdate(); }
    catch (err) { socket.emit("queueError", { message: err.message }); }
  });

  socket.on("setAvgTime", ({ minutes } = {}) => {
    try { setAvgConsultationTime(minutes); broadcastQueueUpdate(); }
    catch (err) { socket.emit("queueError", { message: err.message }); }
  });

  socket.on("resetQueue", () => {
    try { resetQueue(); broadcastQueueUpdate(); }
    catch (err) { socket.emit("queueError", { message: err.message }); }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Queue Cure '26 running at http://${HOST}:${PORT}`);
  console.log(`Receptionist: http://${HOST}:${PORT}/receptionist`);
  console.log(`Patient screen: http://${HOST}:${PORT}/patient`);
});
