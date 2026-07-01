# Queue Cure '26 — Smart Clinic Queue System

**A real-time token queue management system** built for small clinics. The receptionist manages the queue from one screen while the waiting room display updates instantly on another — no page refreshes, no manual updates.

---

## 🎯 The Pitch

### Problem
76% of India's 1.5 million clinics still rely on paper tokens, whiteboards, or shouted names. Patients have no idea how long they will wait, leading to frustration and crowding at the reception. Receptionists struggle to track the queue, no-shows, and average wait times manually.

### Solution
**Queue Cure '26** provides three beautifully synced screens:
- **Receptionist Desk** — Add patients, call next, cancel/no-show, adjust consultation time, view live analytics, and share a QR code for self check-in
- **Patient Waiting Board** — Large TV-like display showing current token, tokens ahead, and estimated wait
- **Patient Self Check-In** — Patients scan a QR code on their phone, enter their name, and instantly get their token number with a live personal wait tracker that updates automatically

Everything updates **instantly** using WebSockets — no page refresh needed, ever.

### Impact
- Patients check themselves in by scanning a QR code — no queue at reception
- Patients track their own wait live on their phone — "2 ahead, 20 min wait"
- Receptionists get real-time control with analytics and no-show tracking
- Clinics get same-day analytics: patients served, average wait, no-shows

---

## ✨ Key Features

- ⚡ Real-time sync across ALL screens using Socket.io
- 📱 QR code self check-in — patients join the queue from their own phone
- 📲 Personal live wait tracker — each patient sees their own position update in real time
- 🎫 Sequential token numbers (Q-001, Q-002...)
- 📢 Sound notification when next patient is called
- ❌ Cancel / Mark as No-show per patient
- ⏱ Live estimated wait time (tokens ahead × average consultation time)
- 📊 Today's analytics: patients today, average wait, no-shows
- 🌙 Dark / Light mode toggle
- 💾 Fully persistent state via `db.json` — survives page refresh and server restart
- 🔄 Reset Queue button with confirmation dialog
- 🔒 Safe concurrency handling via synchronous file operations
- 📺 TV-like patient board with large amber token display
- 📱 Responsive UI — works on mobile too

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Real-time | Socket.io |
| Database | Lightweight JSON file (`db.json`) |
| Frontend | Vanilla HTML, CSS, JS (inlined) |
| QR Code | qrcode.js via CDN (zero npm installs) |

---

## 🚀 Quick Start

```bash
git clone https://github.com/padminipalabathuni/queue-cure-26
cd queue-cure-26
npm install
node index.js
Then open these in your browser:
🖥 Receptionist Desk → http://localhost:3000/receptionist
📺 Patient Waiting Board → http://localhost:3000/patient
📱 Patient Check-In → http://localhost:3000/checkin
No environment variables. No external database. No extra setup. Just two commands.
🏗 Architecture Highlights
Single Source of Truth
All state lives on the server. Neither screen calculates anything independently — they only display what the server sends. This prevents screens from ever drifting out of sync.
Concurrency Safety
Synchronous read/write operations prevent race conditions even if two receptionists click "Call Next" at the exact same moment.
Three Invisible Edge Cases — All Handled
Empty queue → "Call Next" auto-disables, no crash
Zero wait → shows "You're next!" instead of confusing "0 min"
Page refresh → state read from disk instantly, never resets to blank
QR Self Check-In Flow
Patient scans QR code displayed at reception
Opens /checkin on their own phone
Enters name → instantly gets their token number
Page stays live — shows current serving token, tokens ahead, estimated wait
Updates automatically as queue moves — no refresh needed
Future Improvements
Authentication for receptionist screen
Real database (PostgreSQL / MongoDB)
Historical reports and charts
SMS notification when patient is about to be called
Multi-doctor support
📄 Documentation
📡 Socket Event Diagram
🧠 Thought Process
