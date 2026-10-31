---
status: accepted
---

# Animations are driven by real events

The frontend redesign uses a hardware vernacular (switch ports, link LEDs, fiber, scan sweeps), where motion reads as information: a blinking LED or a sweep across the address map tells the operator that something happened on the network. We decided that every animation in the UI must be triggered by a real backend event (scan report, command sent or result, agent ping, agent connected or disconnected, device created or marked offline), or must last only while a real state is in progress (a scan command still `sent`). Decorative loops, periodic fake scans and random LED flicker are not allowed, because they would make the operator read activity that never happened. Everything else (scrollbars, buttons, inputs, tooltips, modals, tables) is fully custom-styled but static: hover and focus change color instantly, with no transitions or movement.

## Consequences

- The frontend needs a live event channel from the backend (`GET /api/v1/events`, server-sent events read with `fetch` and the JWT header); polling would delay events and blur which animation belongs to which event.
- Each animation must name its triggering event in code; an animation with no event behind it is a bug.
- `prefers-reduced-motion` disables all animations; the state they signal stays visible statically (LED color, status text).
