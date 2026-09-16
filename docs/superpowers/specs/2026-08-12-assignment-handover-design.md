# Assignment handover — fixing the 409 that blocks every transfer

**Date:** 2026-08-12
**Repo:** `gmayers/tooltraq` (backend only — no mobile change)
**Status:** design approved, not implemented

## Problem

Every assign path rejects a tool that already has an active assignment:

- `tooltraq/api/routers/assignments/assignments.py:204` — `POST /assignments/`
  raises `409 tool_unavailable`.
- `tooltraq/api/routers/assignments/assignments.py:318` — `_self_assign`, which
  backs both `POST /tools/{id}/assign-to-me/` and the NFC
  `POST /tools/by-identifier/{identifier}/assign/`, raises the same.

A tool sitting at a location **holds an active site assignment**. Tools created
through the mobile Add Device flow always get one (user or site) immediately.
So in practice almost every tool is permanently "held", and no tool can ever be
transferred or picked up again. There is no transfer or handover endpoint
anywhere in the API.

Field symptom: Transfer to location and Assign both appear to do nothing or
error, on both `DeviceDetailsScreen` and `LocationDetailsScreen`.

## Approach

Replace the hard rejection with an atomic handover: close the outgoing
assignment and open the incoming one inside a single transaction. Custody moves
in one step and the history table keeps a complete, gapless record.

### New helper

```python
def _close_open_assignments(rows, keep_pk=None):
    """Close every open row the transaction holds a lock on.

    Caller must already hold the transaction, the Device lock and the
    assignment-row locks; ``rows`` comes from the locked pk list.
    """
```

It sets `returned_date = timezone.now().date()` on each row. It closes *all*
the open rows rather than the first one because two non-API writers — the web
portal's bulk "assign devices to site" (`sites/views/site_views.py`) and
`devices/services.py` — open assignments without closing the incumbent, so a
device can already carry 2+ open rows in production. Closing one and creating
another would carry that surplus forward forever and break the one-open-row
invariant `annotate_assignment_fields` / `is_available` derive from.

### `POST /assignments/` (create_assignment)

Currently `@require_role(OWNER, ADMIN, OFFICE_WORKER)`. Keep that. Inside
`transaction.atomic()`:

1. `select_for_update()` the **Device** row — the serialisation point that
   always exists (see the concurrency row in Error handling).
2. `select_for_update()` the device's open assignments, keeping their pks.
3. Close every locked open row, not just the newest one.
4. Create the new assignment as it does today.

This covers drop-off at a location, moving a tool between locations, and an
officer assigning a held tool to a named user.

### `_self_assign`

Wrap in `transaction.atomic()` with the same lock, then branch on who holds it:

- **Held by a site, or unheld** — close and take it. This is the normal field
  pickup and the main thing that is broken today.
- **Held by another user** — keep the 409, but with a clearer code and message:
  `tool_held_by_user`, "This tool is currently with {name}. Ask an admin to
  reassign it to you." Taking a tool silently out of a named person's custody
  removes the accountability the assignment record exists to provide. The
  message points at an admin because that is the only path that exists today:
  there is no transfer-confirmation feature yet, and no `/tools/{id}/request/`
  endpoint in the backend (the mobile app calls one, and gets a 404).
- **Held by the caller already** — return the existing assignment unchanged
  (idempotent re-scan) rather than 409ing.

## Data flow

```
POST /assignments/ {tool_id, assignee_site_id}
  → lock open assignments for tool
  → close open assignment (returned_date = today)
  → create new assignment (assigned_date = today)
  → 200 AssignmentRead
```

## Error handling

| Case | Response |
|---|---|
| Tool not in org / inactive | 404 |
| Neither or both of user/site given | 422 `invalid_assignee` (unchanged) |
| Self-assign of a tool held by another user | 409 `tool_held_by_user` |
| Self-assign of a tool the caller already holds | 200, existing assignment |
| Concurrent handover on the same tool | Serialised by `select_for_update()` on the **Device** row, which always exists. Locking only the open assignment rows is not enough: on an unheld tool that query matches nothing, so both callers proceed and both create — two open rows, with no DB-level backstop (`DeviceAssignment` has no partial unique index). Locking the Device first also removes the read-committed TOCTOU where a caller that blocks on the assignment lock then reads, closes and replaces the winner's brand-new row without holding a lock on it. With the Device lock the loser waits for the winner to commit, then closes the row the winner opened — correct last-writer-wins custody. Both callers still hold `select_for_update()` on the assignment rows, which is what keeps a concurrent `POST /assignments/{id}/return/` out of the middle of a handover. |

## Testing

New cases in `tooltraq/api/tests/assignments/test_assignments.py`:

1. Assign a site-held tool to a user — succeeds, old assignment closed with
   today's `returned_date`, exactly one open assignment remains.
2. Transfer a tool between two sites — succeeds, history shows both rows.
3. Self-assign a site-held tool — succeeds.
4. Self-assign a tool held by another user — 409 `tool_held_by_user`.
5. Self-assign a tool the caller already holds — 200, no new row created.
6. After handover, `is_available` and the availability annotation still reflect
   exactly one open assignment.
7. `site_worker` role still cannot call `POST /assignments/` (unchanged 403).

## Out of scope

Recipient confirmation, org settings, notifications. Those are the
transfer-confirmation design, which builds on this.
