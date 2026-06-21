# Queue Cure '26 — Smart Clinic Queue System

A real-time token queue for small clinics. A receptionist calls patients
forward from one screen; a waiting-room display updates instantly on another
— no page reloads, no manual refreshing.

## The Pitch

**Problem.** Small clinics still run their queue on paper, a whiteboard, or
shouted names. Patients have no idea how long they'll actually wait, and the
front desk has no clean way to keep the waiting room updated as the line moves.

**Solution.** Queue Cure '26 splits the job across two screens that stay in
perfect sync: the receptionist adds and calls patients from a simple desk
view, and a public board shows everyone — in real time — who's being seen,
how many are ahead of them, and roughly how long the wait is.

**Impact.** Patients relax instead of hovering at the desk. Receptionists get
a no-shows/cancellations workflow and same-day wait-time analytics instead of
a messy paper list. State is persisted, so the system survives a page refresh.

## Tech Stack

- **Backend:** Node.js + Express
- **Real-time layer:** Socket.io
- **Database:** Lightweight JSON-file-backed store (`db.json`), auto-created
  on first run — no native DB driver to install
- **Frontend:** Plain HTML/CSS/JS, inlined directly in `index.js` — the
  whole app is a single file by design, for simplicity and easy deployment

## Setup Instructions
