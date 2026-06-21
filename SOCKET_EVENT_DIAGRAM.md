# Socket Event Diagram — Queue Cure '26

This diagram illustrates the real-time synchronization between the Receptionist and Patient screens.Our architecture follows a consistent event-driven pattern: when the Receptionist triggers an action, the Server processes the request, updates the data source, and broadcasts the current state to all connected clients simultaneously.

RECEPTIONIST SCREEN                    SERVER                      PATIENT SCREEN(S)
|                                 |                                |
| emit "addPatient" {name}        |                                |
|-------------------------------->|                                |
|                                 | addPatient() -> write db.json  |
|                                 |                                |
| emit "nextPatient"              |                                |
|-------------------------------->|                                |
|                                 | callNext()                     |
|                                 |  - if no one Waiting:          |
|                                 |      emit "queueError" back    |
|                                 |      to sender only            |
|                                 |  - else: write db.json         |
|                                 |                                |
| emit "cancelToken" {id}         |                                |
|-------------------------------->|                                |
|                                 | cancelToken() -> write db.json |
|                                 |                                |
| emit "setAvgTime" {minutes}     |                                |
|-------------------------------->|                                |
|                                 | setAvgConsultationTime()       |
|                                 |                                |
| emit "resetQueue"               |                                |
|-------------------------------->|                                |
|                                 | resets queue + token counter   |
|                                 |                                |
|          broadcast "queueUpdated" { full, public, analytics }    |
|<--------------------------------|------------------------------->|
| renders full state              |          renders public view  |
| (queue list, now serving)       |          (current token,      |
|                                 |           tokens ahead, wait) |
## Event Reference

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `addPatient` | Client → Server | `{ name }` | Registers a new patient token |
| `nextPatient` | Client → Server | *(none)* | Calls the next waiting patient |
| `cancelToken` | Client → Server | `{ id }` | Cancels a token or marks as no-show |
| `setAvgTime` | Client → Server | `{ minutes }` | Updates wait-time multiplier |
| `resetQueue` | Client → Server | *(none)* | Clears queue; resets numbering |
| `queueUpdated` | Server → All | `{ full, public, analytics }` | Broadcasts state changes to all clients |
| `queueError` | Server → Sender | `{ message, code? }` | Feedback for failed operations |

## Why I also have plain REST routes
On page load (or refresh), the screens don't yet have a live socket
update to show — so I added simple `GET` routes (`/api/queue`,
`/api/state`, `/api/analytics`) that return the current saved state
immediately, so the page never shows "empty" by mistake while waiting
for the first real-time update.
