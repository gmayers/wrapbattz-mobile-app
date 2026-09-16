# Tool transfer with recipient confirmation

**Date:** 2026-08-12
**Repos:** `gmayers/tooltraq` (backend + web portal), `wrapbattz` app (mobile)
**Status:** design approved, not implemented
**Depends on:** `2026-08-12-assignment-handover-design.md`

## Goal

User A hands a tool to user B. B confirms before custody moves. Pending
confirmations are the first thing B sees on opening the app. Owners and admins
control whether confirmation is required at all, and when unanswered transfers
expire.

## Decisions

| Question | Decision |
|---|---|
| What needs confirming | Person → person only. Location transfers, drop-offs and pickups stay instant. |
| Setting off | Transfer happens immediately, no pending row. |
| Unanswered transfer | Expires at the org's workday end. Tool stays with A. A **and** all owners/admins are notified, so a tool in limbo surfaces rather than going quiet. |
| Declined | Tool stays with A. A is notified. |
| Surfacing to B | Blocking modal over the Dashboard on launch. Dismissible, reappears every launch until actioned. |
| Who can initiate | The current holder, or an owner/admin. |
| Settings surface | Web portal **and** mobile Settings, both gated to owner/admin. |

## Backend

### Organization fields

Three fields added directly to `organizations.Organization` (it is already a
flat model with no settings sub-model):

- `require_transfer_confirmation` — `BooleanField(default=True)`
- `timezone` — `CharField(max_length=64, default="Europe/London")`, validated
  against `zoneinfo.available_timezones()`
- `workday_end_time` — `TimeField(default=time(18, 0))`

### `ToolTransfer` model

New `OrgModel` in `tooltraq/devices/models.py`, modelled on `JoinRequest`:

```python
class ToolTransfer(OrgModel):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        ACCEPTED  = "accepted",  "Accepted"
        DECLINED  = "declined",  "Declined"
        EXPIRED   = "expired",   "Expired"
        CANCELLED = "cancelled", "Cancelled"

    device      = FK(Device, related_name="transfers")
    from_user   = FK(AUTH_USER_MODEL, related_name="transfers_sent")
    to_user     = FK(AUTH_USER_MODEL, related_name="transfers_received")
    status      = CharField(choices=Status.choices, default=PENDING)
    note        = TextField(blank=True)
    expires_at  = DateTimeField()
    decided_at  = DateTimeField(null=True, blank=True)
    decided_by  = FK(AUTH_USER_MODEL, null=True, related_name="transfers_decided")
```

Constraints and indexes:

- `UniqueConstraint(fields=["device"], condition=Q(status="pending"),
  name="unique_pending_transfer_per_device")` — one in-flight transfer per tool.
- Index on `(to_user, status)` for the pending-for-me query.
- Index on `(status, expires_at)` for the expiry sweep.

`DeviceAssignment` is untouched. It keeps meaning "who holds this, now", so
every existing availability query, the `assignment_user_xor_site` constraint and
`annotate_assignment_fields` stay correct while a transfer is in flight.

### Expiry calculation

```python
def workday_expiry(org, now=None):
    """Next occurrence of the org's workday end, in the org's timezone."""
```

Takes `now` in UTC, converts to `org.timezone`, and returns the next occurrence
of `org.workday_end_time` — same day if still ahead, otherwise the next day —
converted back to UTC. Uses `zoneinfo`, so DST is handled by the library. On a
DST spring-forward day where the wall-clock time does not exist, `zoneinfo`
resolves forward; that is acceptable for a cutoff time.

### Endpoints

All under the existing assignments router, `auth=AuthBearer()`.

| Method | Path | Who | Behaviour |
|---|---|---|---|
| POST | `/assignments/transfers/` | Current holder, or owner/admin | Body `{tool_id, to_user_id, note}`. If `require_transfer_confirmation` is off, performs the handover immediately and returns the new assignment. Otherwise creates a pending `ToolTransfer` and notifies B. |

`from_user` is always the tool's **current holder**, never the caller. When an
owner or admin moves someone else's tool, `from_user` stays the holder and
`created_by` (inherited from `OrgModel`) records the officer who acted, so the
log distinguishes "A handed it over" from "an admin moved it off A". Accept and
decline notifications go to `from_user`; when `created_by` differs, that officer
is notified too.
| GET | `/assignments/transfers/pending/` | Any member | Pending transfers where `to_user` is the caller and `expires_at` is in the future. Drives the launch modal. |
| GET | `/assignments/transfers/` | Owner/admin | Org-wide transfer log, filterable by status. |
| POST | `/assignments/transfers/{id}/accept/` | `to_user` only | Atomic handover. |
| POST | `/assignments/transfers/{id}/decline/` | `to_user` only | Marks declined, notifies A. |
| POST | `/assignments/transfers/{id}/cancel/` | `from_user`, or owner/admin | Marks cancelled. |

**Accept** runs in one transaction with `select_for_update` on the device's open
assignments:

1. Re-check the transfer is still `pending` and unexpired.
2. Re-check `from_user` still holds the tool. If custody moved since the
   transfer was raised, mark the transfer `cancelled` and return
   `409 custody_changed` — do not silently take the tool from whoever holds it
   now.
3. Close A's assignment, open B's (the handover helper from the dependency spec).
4. Set `status=accepted`, `decided_at`, `decided_by`.
5. Notify A.

### Notifications

Four values added to `notifications.NotificationType`:
`TRANSFER_REQUESTED`, `TRANSFER_ACCEPTED`, `TRANSFER_DECLINED`,
`TRANSFER_EXPIRED`. Each creates a `Notification` row with the generic FK
pointing at the `ToolTransfer`. Recipients:

- requested → B
- accepted, declined → A
- expired → A plus every owner/admin in the org

Push delivery reuses the existing `PushToken` path; no new transport.

### Expiry sweep

Celery beat task `devices.tasks.expire_pending_transfers`, every 15 minutes.
Selects `status=pending, expires_at__lte=now()`, marks them `expired`, and fans
out notifications. Idempotent — re-running changes nothing.

Fifteen minutes rather than daily because orgs pick their own cutoff, so a
nightly job would let a 12:00 cutoff sit unexpired until the small hours.

### Web portal

The org settings form gains the three fields, visible to owners and admins only.
A transfer log page lists `ToolTransfer` rows filtered by status.

## Mobile

### API layer

New `src/api/endpoints/transfers.ts` wrapping the six endpoints, plus generated
types from the regenerated OpenAPI schema (`npm run api:types`).

### Launch modal

A `PendingTransfersModal` rendered from the Dashboard. On focus, and after
login, it calls `GET /assignments/transfers/pending/`. If the list is non-empty
it presents each transfer as a card — tool name, who is sending it, when it
expires — with Accept and Decline. Dismissible via a close button; it does not
persist dismissal, so it returns on the next launch until every transfer is
actioned. On accept or decline it refreshes the Dashboard's assignment counts.

### Sending a transfer

`DeviceDetailsScreen` gains "Transfer to person" beside the existing "Transfer
to location". It opens a member picker sourced from
`src/api/endpoints/members.ts`, excluding the caller. Confirmation-off orgs get
a success alert and an immediate refresh; confirmation-on orgs get "Waiting for
{name} to accept."

### Settings

A Transfers section in the mobile Settings screen, rendered only for
`isAdminOrOwner`: a require-confirmation switch, a timezone picker, and a
workday-end time picker. Saves through the existing organization update
endpoint.

## Error handling

| Case | Response | Mobile treatment |
|---|---|---|
| Tool already has a pending transfer | 409 `transfer_pending` | Alert naming the pending recipient |
| Caller is neither holder nor officer | 403 | Alert |
| `to_user` not a member of the org | 422 `invalid_recipient` | Alert |
| Transferring to yourself | 422 `invalid_recipient` | Prevented in the picker too |
| Accept after expiry | 409 `transfer_expired` | Alert, refresh the list |
| Accept after custody moved | 409 `custody_changed` | Alert explaining who holds it now |
| Tool held by a site, not a user | 422 `invalid_transfer` | The person-transfer button is hidden when the tool is site-held |

All mobile error rendering goes through `normalizeFormError`
(`src/api/errors.ts`), so a coded body always reaches the user rather than being
swallowed.

## Testing

**Backend** (`tooltraq/api/tests/assignments/`):

1. Create transfer with confirmation on → pending row, B notified, custody
   unchanged.
2. Create transfer with confirmation off → immediate handover, no pending row.
3. Accept → custody moves, both assignment rows correct, A notified.
4. Decline → custody unchanged, A notified.
5. Cancel by sender, and by an admin; a third party gets 403.
6. Second transfer for the same tool → 409 `transfer_pending`.
7. Accept after `expires_at` → 409 `transfer_expired`.
8. Accept after custody moved elsewhere → 409 `custody_changed`, transfer
   cancelled.
9. `workday_expiry` — before cutoff same day, after cutoff next day, across a
   DST boundary, and for a non-UK timezone.
10. Expiry sweep marks pending rows expired and notifies A plus owners/admins;
    running it twice changes nothing.
11. Non-member recipient → 422.

**Mobile**:

1. `transfers.ts` wrappers hit the right paths and surface `ApiError`.
2. Modal renders one card per pending transfer and hides when the list is empty.
3. Accept and decline call through and refresh.
4. Settings section renders only for owner/admin.

## Out of scope

Requesting a tool from its holder (the reverse direction — a separate
`/tools/{id}/request/` contract already noted as pending), transfer approval
chains, and per-site transfer rules.
