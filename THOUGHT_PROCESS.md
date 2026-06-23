# Thought Process — Queue Cure '26

## The Problem I'm Solving
Small clinics still manage their queue with paper slips or by shouting
names. Patients have no idea how long they'll wait, and the front desk
has to remember everything manually. I wanted to fix both sides of that
with two screens that talk to each other live.

## Why I Built It This Way
I decided everything should come from **one single source of truth** —
the server. Neither screen calculates anything on its own; they just
display whatever the server tells them. I did this on purpose, because
if both screens tried to calculate the queue independently, they could
easily drift out of sync with each other.

## How I Handled Concurrency (Two People Acting at Once)
The scariest bug in a queue app is two receptionists clicking "Call Next"
at the exact same second. If the server tried to handle both at once,
it could mix up the queue and call the wrong patient, or even crash.

I solved this by making the server handle one action **completely**
before it even looks at the next one — like a cashier who finishes
helping one customer fully before starting the next, even if two people
show up at the same time. Technically, I did this by using *synchronous*
file reads and writes (reading/saving the queue data without letting the
server "pause" partway through). Since Node.js only does one thing at a
time anyway, this means there's never a moment where two actions can
overlap and corrupt the data. It's a simple solution, but it's reliable —
I didn't need a complicated locking system to get safe, predictable
behavior.

## Edge Cases I Made Sure to Handle
1. **Empty queue** — if "Call Next" is clicked with nobody waiting, the
   app doesn't crash. It shows a clear message instead, and the button
   even disables itself automatically once the queue is empty.
2. **Zero-wait** — if a patient is the very next person, showing "0 min
   wait" felt confusing, so I show "You're next!" instead.
3. **Page refresh** — every action is saved to a file the instant it
   happens, before anything is shown on screen. So if someone refreshes
   the page, the app reads back the saved file instead of starting blank.
4. **Starting fresh each day** — I added a manual "Reset Queue" button
   (with a confirmation popup, so it can't be tapped by accident) so the
   receptionist can clear yesterday's queue and start back at token 1.
5. **No-shows** — a waiting patient can be cancelled without messing up
   the token numbers of everyone else still in line.

## New Feature: QR Code Self-Checkin
I added a QR Code self-checkin feature on the receptionist screen. Patients can scan the QR with their phone and join the queue directly by entering their name. This reduces the receptionist's workload and makes the system more convenient.

## How I Calculate Wait Time
I multiply how many patients are still waiting by the average
consultation time the receptionist sets — both of these come from live,
current data, not a number I typed in once. So the estimate updates
automatically as the queue changes.

## What I'd Add With More Time
- A real database instead of a JSON file, so it could handle even more
  traffic safely
- A login for the receptionist screen, so random people can't access it
- A priority system for urgent patients
