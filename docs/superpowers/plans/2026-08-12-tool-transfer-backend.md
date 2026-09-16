# Tool Transfer Confirmation — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one person hand a tool to another, with the recipient confirming before custody moves, expiring at an org-configurable workday end.

**Architecture:** A new `ToolTransfer` model modelled on the existing `JoinRequest` holds the pending state, so `DeviceAssignment` keeps meaning "who holds this, now" and every existing availability query stays correct while a transfer is in flight. Accepting runs the same atomic handover the assignment router already uses. Three settings fields go directly on `Organization`. A Celery beat sweep expires unanswered transfers.

**Tech Stack:** Django 5, django-ninja, Postgres, Celery + django-celery-beat, django-auditlog, Django `TestCase` (not pytest), `zoneinfo`.

**Spec:** `docs/superpowers/specs/2026-08-12-tool-transfer-confirmation-design.md` (in the mobile repo, alongside this plan).

**Scope:** Backend + web portal only. The mobile app gets a separate plan once this is deployed. This plan is Plan A of two.

## Global Constraints

- Repo: `gmayers/tooltraq`. Branch from `master` (it already contains the merged handover fix, `cd4af92`).
- `manage.py` lives in the `tooltraq/` subdirectory; the venv is at the repo root. All commands run from `tooltraq/`.
- Test command: `../.venv/bin/python manage.py test api` (adjust the venv path if working in a worktree — a worktree has no `.venv` of its own and needs `tooltraq/.env.local` copied in, or Django refuses to start with `SECRET_KEY must be set to a unique value when DEBUG=False`).
- **Baseline before any change: `manage.py test api` → 294 tests, OK.**
- **Local tests run on SQLite, where Django silently omits `FOR UPDATE` (`has_select_for_update = False`).** Any task touching row locking must also be run against Postgres before it is considered verified. See Task 5.
- Never combine `select_related()` with `select_for_update()` on `DeviceAssignment` — nullable FKs produce LEFT OUTER JOINs and Postgres rejects `FOR UPDATE` on the nullable side.
- `ApiError` signature is `ApiError(code, message, status=...)`.
- `DeviceAssignment` is registered with django-auditlog (`devices/apps.py:26`), which logs via `post_save`. Never close assignments with a bulk `queryset.update()` — the audit entry would vanish. Use per-row `save()`.
- Existing handover helpers in `api/routers/assignments/assignments.py`, to be reused, not reimplemented: `_lock_device(device)`, `_lock_open_assignments(device) -> list[int]`, `_open_assignments(open_ids)`, `_close_open_assignments(rows, keep_pk=None)`.
- Regenerate the OpenAPI spec at the end (Task 7) — this plan **does** change the schema, unlike the handover fix.
- Do not touch the mobile app in this plan.

## File Structure

| File | Responsibility |
|---|---|
| `tooltraq/organizations/models.py` | +3 settings fields on `Organization` |
| `tooltraq/organizations/migrations/0011_*.py` | Settings fields migration |
| `tooltraq/organizations/schemas.py` | Expose settings on `OrganizationRead` / `OrganizationUpdate`, validate the timezone |
| `tooltraq/devices/transfer_expiry.py` | **New.** `workday_expiry(org, now=None)` — pure, no DB writes |
| `tooltraq/devices/models.py` | +`ToolTransfer` model |
| `tooltraq/devices/migrations/0019_*.py` | `ToolTransfer` migration |
| `tooltraq/notifications/models.py` | +4 `NotificationType` values |
| `tooltraq/devices/schemas.py` | `TransferCreate` / `TransferRead` / `PagedTransfers` |
| `tooltraq/api/routers/assignments/transfers.py` | **New.** All six transfer endpoints. Kept out of `assignments.py`, which is already ~420 lines |
| `tooltraq/devices/tasks.py` | +`expire_pending_transfers` sweep |
| `tooltraq/config/settings.py` | +beat schedule entry |
| `tooltraq/api/tests/assignments/test_transfers.py` | **New.** All endpoint tests |
| `tooltraq/api/tests/assignments/test_transfer_expiry.py` | **New.** `workday_expiry` unit tests |

---

### Task 1: Organization transfer settings

**Files:**
- Modify: `tooltraq/organizations/models.py` (add fields to `Organization`, class begins line 27)
- Create: `tooltraq/organizations/migrations/0011_organization_transfer_settings.py` (generated)
- Modify: `tooltraq/organizations/schemas.py` (`OrganizationRead` line 11, `OrganizationUpdate` line 42)
- Modify: `tooltraq/api/routers/organization/organizations.py` (`_build_org_read`, line 34)
- Test: `tooltraq/api/tests/test_organizations.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Organization.require_transfer_confirmation` (bool), `Organization.timezone` (str), `Organization.workday_end_time` (`datetime.time`). Tasks 2, 4 and 6 read these.

Note: `organizations/models.py` does **not** import `django.utils.timezone`, so a model field named `timezone` is safe here. Do not add such an import to this module.

`PATCH /organizations/me/` is already `@require_role(OWNER, ADMIN)` and applies every field present in the payload generically (`organizations.py:173-182`), so adding the fields to `OrganizationUpdate` gates them correctly with no endpoint change. Do not weaken that decorator.

- [ ] **Step 1: Write the failing tests**

Append to `tooltraq/api/tests/test_organizations.py` (match the file's existing setUp/client helpers — read the top of the file first):

```python
    def test_transfer_settings_have_sensible_defaults(self):
        client = self.owner_client()
        resp = client.get("/organizations/me/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["require_transfer_confirmation"])
        self.assertEqual(data["timezone"], "Europe/London")
        self.assertEqual(data["workday_end_time"], "18:00:00")

    def test_owner_can_update_transfer_settings(self):
        client = self.owner_client()
        resp = client.patch("/organizations/me/", json={
            "require_transfer_confirmation": False,
            "timezone": "Europe/Dublin",
            "workday_end_time": "17:30:00",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["require_transfer_confirmation"])
        self.assertEqual(data["timezone"], "Europe/Dublin")
        self.assertEqual(data["workday_end_time"], "17:30:00")

    def test_unknown_timezone_is_rejected(self):
        client = self.owner_client()
        resp = client.patch("/organizations/me/", json={"timezone": "Mars/Olympus_Mons"})
        self.assertEqual(resp.status_code, 422)

    def test_site_worker_cannot_update_transfer_settings(self):
        client = self.worker_client()
        resp = client.patch("/organizations/me/", json={
            "require_transfer_confirmation": False,
        })
        self.assertEqual(resp.status_code, 403)
```

If `test_organizations.py` has no `worker_client()` helper, build a site_worker client the same way the file builds its other clients, rather than inventing a new pattern.

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.test_organizations -v 2`
Expected: FAIL — `KeyError: 'require_transfer_confirmation'` on the read tests.

- [ ] **Step 3: Add the model fields**

In `tooltraq/organizations/models.py`, add `from datetime import time` to the imports, then add to `Organization` immediately after the `trial_end_date` field:

```python
    # Transfer workflow settings. Owners/admins control these; see the
    # tool-transfer-confirmation design.
    require_transfer_confirmation = models.BooleanField(default=True)
    timezone = models.CharField(max_length=64, default="Europe/London")
    workday_end_time = models.TimeField(default=time(18, 0))
```

- [ ] **Step 4: Generate and apply the migration**

```bash
../.venv/bin/python manage.py makemigrations organizations -n organization_transfer_settings
../.venv/bin/python manage.py migrate organizations
```

Confirm the generated file only adds these three fields. If it contains anything else, stop and report — that means unrelated model drift is present.

- [ ] **Step 5: Expose the fields on the API schemas**

In `tooltraq/organizations/schemas.py`, add to the imports:

```python
from datetime import time as time_type
from zoneinfo import available_timezones

from pydantic import field_validator
```

Add to `OrganizationRead` (after `site_count`):

```python
    require_transfer_confirmation: bool = True
    timezone: str = "Europe/London"
    workday_end_time: time_type = time_type(18, 0)
```

Add to `OrganizationUpdate` (after `website`):

```python
    require_transfer_confirmation: Optional[bool] = None
    timezone: Optional[str] = None
    workday_end_time: Optional[time_type] = None

    @field_validator("timezone")
    @classmethod
    def _known_timezone(cls, value):
        if value is not None and value not in available_timezones():
            raise ValueError(f"Unknown timezone: {value}")
        return value
```

- [ ] **Step 6: Populate the fields in the read builder**

In `tooltraq/api/routers/organization/organizations.py`, add to the `OrganizationRead(...)` call inside `_build_org_read` (after `site_count=0,`):

```python
        require_transfer_confirmation=org.require_transfer_confirmation,
        timezone=org.timezone,
        workday_end_time=org.workday_end_time,
```

- [ ] **Step 7: Run the tests**

Run: `../.venv/bin/python manage.py test api -v 2`
Expected: PASS, 298 tests (294 + 4 new).

- [ ] **Step 8: Commit**

```bash
git add tooltraq/organizations/ tooltraq/api/routers/organization/organizations.py tooltraq/api/tests/test_organizations.py
git commit -m "feat(organizations): transfer confirmation, timezone and workday-end settings

Owners and admins control whether person-to-person transfers need the
recipient's confirmation, and when an unanswered one expires. Timezone is
validated against zoneinfo so a typo cannot silently break expiry."
```

---

### Task 2: `workday_expiry` helper

**Files:**
- Create: `tooltraq/devices/transfer_expiry.py`
- Test: `tooltraq/api/tests/assignments/test_transfer_expiry.py`

**Interfaces:**
- Consumes: `Organization.timezone` and `Organization.workday_end_time` from Task 1.
- Produces: `workday_expiry(org, now=None) -> datetime` — timezone-aware, in UTC. Tasks 4 and 6 call it.

This is a pure function with no DB writes, so it is worth isolating and testing hard. DST is where this kind of code goes wrong.

- [ ] **Step 1: Write the failing tests**

Create `tooltraq/api/tests/assignments/test_transfer_expiry.py`:

```python
"""Unit tests for workday_expiry — the org-configurable transfer cutoff."""
from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.test import TestCase

from accounts.models import CustomUser
from devices.transfer_expiry import workday_expiry
from organizations.factories import OrganizationFactory

UTC = ZoneInfo("UTC")


class WorkdayExpiryTests(TestCase):
    def setUp(self):
        owner = CustomUser.objects.create(email="o@o.com", workos_user_id="wu_expiry")
        self.org = OrganizationFactory(workos_org_id="wo_expiry", owner=owner)
        self.org.timezone = "Europe/London"
        self.org.workday_end_time = time(18, 0)
        self.org.save(update_fields=["timezone", "workday_end_time"])

    def test_before_cutoff_expires_same_day(self):
        # 09:00 UTC on a winter day = 09:00 London, before the 18:00 cutoff.
        now = datetime(2026, 1, 14, 9, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 1, 14, 18, 0, tzinfo=UTC))

    def test_after_cutoff_rolls_to_next_day(self):
        # 19:00 UTC = 19:00 London in winter, past the cutoff.
        now = datetime(2026, 1, 14, 19, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 1, 15, 18, 0, tzinfo=UTC))

    def test_exactly_at_cutoff_rolls_to_next_day(self):
        now = datetime(2026, 1, 14, 18, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 1, 15, 18, 0, tzinfo=UTC))

    def test_british_summer_time_shifts_the_utc_instant(self):
        # July: London is UTC+1, so an 18:00 local cutoff is 17:00 UTC.
        now = datetime(2026, 7, 14, 9, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 7, 14, 17, 0, tzinfo=UTC))

    def test_non_uk_timezone(self):
        self.org.timezone = "America/New_York"
        self.org.workday_end_time = time(17, 0)
        self.org.save(update_fields=["timezone", "workday_end_time"])
        # 12:00 UTC = 08:00 New York (EDT), before a 17:00 local cutoff = 21:00 UTC.
        now = datetime(2026, 7, 14, 12, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 7, 14, 21, 0, tzinfo=UTC))

    def test_unknown_timezone_falls_back_to_london(self):
        self.org.timezone = "Mars/Olympus_Mons"
        self.org.save(update_fields=["timezone"])
        now = datetime(2026, 1, 14, 9, 0, tzinfo=UTC)
        result = workday_expiry(self.org, now=now)
        self.assertEqual(result, datetime(2026, 1, 14, 18, 0, tzinfo=UTC))

    def test_result_is_always_utc(self):
        now = datetime(2026, 7, 14, 9, 0, tzinfo=UTC)
        self.assertEqual(workday_expiry(self.org, now=now).utcoffset().total_seconds(), 0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfer_expiry -v 2`
Expected: FAIL — `ModuleNotFoundError: No module named 'devices.transfer_expiry'`.

- [ ] **Step 3: Write the implementation**

Create `tooltraq/devices/transfer_expiry.py`:

```python
"""Work out when a pending tool transfer stops being answerable.

Kept separate from the models and the router because it is pure arithmetic
over an organisation's timezone settings, and timezone arithmetic is worth
testing on its own.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone as dj_timezone

FALLBACK_TIMEZONE = "Europe/London"
UTC = ZoneInfo("UTC")


def _org_zone(org) -> ZoneInfo:
    """The org's timezone, falling back rather than raising.

    A bad value must not be able to stop the expiry sweep for every other
    organisation, so an unknown name degrades to the default instead of
    blowing up. The API validates on write; this guards existing rows.
    """
    try:
        return ZoneInfo(org.timezone or FALLBACK_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(FALLBACK_TIMEZONE)


def workday_expiry(org, now: datetime | None = None) -> datetime:
    """Next occurrence of the org's workday end, as a UTC datetime.

    Same day if the cutoff is still ahead, otherwise the next day. A cutoff
    exactly equal to ``now`` counts as passed — a transfer raised at the
    stroke of the cutoff gets a full day, not zero seconds.
    """
    now = now or dj_timezone.now()
    zone = _org_zone(org)
    local_now = now.astimezone(zone)

    candidate = datetime.combine(
        local_now.date(), org.workday_end_time, tzinfo=zone
    )
    if candidate <= local_now:
        candidate = datetime.combine(
            local_now.date() + timedelta(days=1), org.workday_end_time, tzinfo=zone
        )

    return candidate.astimezone(UTC)
```

- [ ] **Step 4: Run the tests**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfer_expiry -v 2`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add tooltraq/devices/transfer_expiry.py tooltraq/api/tests/assignments/test_transfer_expiry.py
git commit -m "feat(devices): workday_expiry helper for pending transfers

Returns the next occurrence of the org's workday end in UTC, rolling to
the next day once the cutoff has passed. An unknown timezone degrades to
Europe/London rather than raising, so one bad row cannot stall the sweep
for every other organisation."
```

---

### Task 3: `ToolTransfer` model and notification types

**Files:**
- Modify: `tooltraq/devices/models.py` (add `ToolTransfer` at the end)
- Create: `tooltraq/devices/migrations/0019_tooltransfer.py` (generated)
- Modify: `tooltraq/notifications/models.py` (`NotificationType`, line 9)
- Test: `tooltraq/api/tests/assignments/test_transfers.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `devices.models.ToolTransfer` with `Status` choices `PENDING`/`ACCEPTED`/`DECLINED`/`EXPIRED`/`CANCELLED`, and fields `device`, `from_user`, `to_user`, `status`, `note`, `expires_at`, `decided_at`, `decided_by`. Plus `NotificationType.TRANSFER_REQUESTED` / `TRANSFER_ACCEPTED` / `TRANSFER_DECLINED` / `TRANSFER_EXPIRED`. Tasks 4, 5 and 6 use all of these.

`ToolTransfer` extends `OrgModel` (`core/models.py:17`), which already provides `uuid`, `organization`, `created_by` and timestamps. `created_by` is how an admin-initiated transfer is distinguished from a holder-initiated one — see the spec.

- [ ] **Step 1: Write the failing tests**

Create `tooltraq/api/tests/assignments/test_transfers.py`:

```python
"""Tests for the tool-transfer workflow."""
from datetime import timedelta

from django.db.utils import IntegrityError
from django.utils import timezone

from accounts.models import CustomUser
from api.tests.base import ApiTestCase
from devices.factories import DeviceCategoryFactory, DeviceStatusFactory
from devices.models import Device, DeviceAssignment, ToolTransfer
from organizations.factories import OrganizationFactory, OrganizationMemberFactory
from organizations.models import OrganizationMember as OM
from sites.models import Site, SiteStatus, SiteType

R = OM.Role


class TransferSetupMixin:
    """Org with an owner, two workers, a site, and one tool held by worker_a."""

    def setUp(self):
        super().setUp()
        self.owner = CustomUser.objects.create(
            email="owner@t.com", workos_user_id="wu_owner_xfer"
        )
        self.org = OrganizationFactory(workos_org_id="wo_xfer", owner=self.owner)
        OrganizationMemberFactory(user=self.owner, organization=self.org, role=R.OWNER)

        self.worker_a = CustomUser.objects.create(
            email="a@t.com", workos_user_id="wu_a_xfer"
        )
        OrganizationMemberFactory(
            user=self.worker_a, organization=self.org, role=R.SITE_WORKER
        )
        self.worker_b = CustomUser.objects.create(
            email="b@t.com", workos_user_id="wu_b_xfer"
        )
        OrganizationMemberFactory(
            user=self.worker_b, organization=self.org, role=R.SITE_WORKER
        )

        self.status = DeviceStatusFactory(
            organization=self.org, slug="available", is_default=True
        )
        self.site = Site.objects.create(
            organization=self.org, created_by=self.owner, name="HQ",
            site_type=SiteType.WAREHOUSE, status=SiteStatus.ACTIVE,
        )
        self.tool = Device.objects.create(
            organization=self.org, created_by=self.owner, name="Drill",
            serial_number="S-XFER", current_status=self.status,
            category=DeviceCategoryFactory(organization=self.org),
        )
        self.assignment = DeviceAssignment.objects.create(
            organization=self.org, created_by=self.owner, device=self.tool,
            assigned_to_user=self.worker_a, assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

    def owner_client(self):
        return self.authed_client(self.owner, self.org, role="owner")

    def a_client(self):
        return self.authed_client(self.worker_a, self.org, role="site_worker")

    def b_client(self):
        return self.authed_client(self.worker_b, self.org, role="site_worker")

    def _pending(self, **overrides):
        defaults = dict(
            organization=self.org, created_by=self.worker_a, device=self.tool,
            from_user=self.worker_a, to_user=self.worker_b,
            expires_at=timezone.now() + timedelta(hours=4),
        )
        defaults.update(overrides)
        return ToolTransfer.objects.create(**defaults)


class ToolTransferModelTests(TransferSetupMixin, ApiTestCase):

    def test_defaults_to_pending(self):
        transfer = self._pending()
        self.assertEqual(transfer.status, ToolTransfer.Status.PENDING)
        self.assertIsNone(transfer.decided_at)
        self.assertIsNone(transfer.decided_by)

    def test_only_one_pending_transfer_per_device(self):
        self._pending()
        with self.assertRaises(IntegrityError):
            self._pending()

    def test_a_decided_transfer_does_not_block_a_new_one(self):
        first = self._pending()
        first.status = ToolTransfer.Status.DECLINED
        first.decided_at = timezone.now()
        first.save(update_fields=["status", "decided_at"])
        # Must not raise.
        second = self._pending()
        self.assertEqual(second.status, ToolTransfer.Status.PENDING)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfers -v 2`
Expected: FAIL — `ImportError: cannot import name 'ToolTransfer' from 'devices.models'`.

- [ ] **Step 3: Add the model**

Append to `tooltraq/devices/models.py`:

```python
class ToolTransfer(OrgModel):
    """A pending person-to-person handover awaiting the recipient's answer.

    Sibling to organizations.JoinRequest, and deliberately separate from
    DeviceAssignment: assignments answer "who holds this, now", and a
    transfer in flight must not disturb that answer or the availability
    annotations derived from it.

    ``from_user`` is always the tool's current holder, never necessarily the
    caller — when an owner or admin moves someone else's tool, ``created_by``
    (from OrgModel) records who acted.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        EXPIRED = "expired", "Expired"
        CANCELLED = "cancelled", "Cancelled"

    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="transfers"
    )
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="transfers_sent",
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="transfers_received",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    note = models.TextField(blank=True)
    expires_at = models.DateTimeField()
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="transfers_decided",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["to_user", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["device"],
                condition=models.Q(status="pending"),
                name="unique_pending_transfer_per_device",
            ),
        ]

    def __str__(self):
        return (
            f"ToolTransfer {self.device_id}: "
            f"{self.from_user_id} → {self.to_user_id} ({self.status})"
        )
```

- [ ] **Step 4: Add the notification types**

In `tooltraq/notifications/models.py`, add to `NotificationType` immediately before `SYSTEM`:

```python
    TRANSFER_REQUESTED = "transfer_requested", "Transfer Requested"
    TRANSFER_ACCEPTED = "transfer_accepted", "Transfer Accepted"
    TRANSFER_DECLINED = "transfer_declined", "Transfer Declined"
    TRANSFER_EXPIRED = "transfer_expired", "Transfer Expired"
```

- [ ] **Step 5: Generate and apply the migrations**

```bash
../.venv/bin/python manage.py makemigrations devices -n tooltransfer
../.venv/bin/python manage.py makemigrations notifications -n transfer_notification_types
../.venv/bin/python manage.py migrate
```

- [ ] **Step 6: Run the tests**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfers -v 2`
Expected: PASS, 3 tests.

Note: `test_only_one_pending_transfer_per_device` wraps an expected `IntegrityError`. Django's `TestCase` wraps each test in a transaction, so a raised `IntegrityError` poisons it — if the following test errors with `TransactionManagementError`, wrap the raising call in `transaction.atomic()`:

```python
        with self.assertRaises(IntegrityError), transaction.atomic():
            self._pending()
```

- [ ] **Step 7: Commit**

```bash
git add tooltraq/devices/models.py tooltraq/devices/migrations/ tooltraq/notifications/ tooltraq/api/tests/assignments/test_transfers.py
git commit -m "feat(devices): ToolTransfer model and transfer notification types

Pending person-to-person handovers live in their own table so
DeviceAssignment keeps meaning 'who holds this, now' and the availability
annotations stay correct while a transfer is in flight. A partial unique
index allows only one pending transfer per tool."
```

---

### Task 4: Create and list transfers

**Files:**
- Modify: `tooltraq/devices/schemas.py` (add transfer schemas)
- Create: `tooltraq/api/routers/assignments/transfers.py`
- Modify: `tooltraq/api/main.py` (mount the router — read the file to match how the existing assignment routers are mounted)
- Test: `tooltraq/api/tests/assignments/test_transfers.py`

**Interfaces:**
- Consumes: `ToolTransfer` and the four `NotificationType` values (Task 3); `workday_expiry(org, now=None)` (Task 2); `Organization.require_transfer_confirmation` (Task 1); the handover helpers `_lock_device`, `_lock_open_assignments`, `_open_assignments`, `_close_open_assignments` from `api/routers/assignments/assignments.py`.
- Produces: `POST /assignments/transfers/`, `GET /assignments/transfers/pending/`, `GET /assignments/transfers/` and the module-level `_serialize_transfer(t) -> TransferRead`. Task 5 adds accept/decline/cancel to the same file and reuses `_serialize_transfer`.

The new endpoints live in their own module because `assignments.py` is already ~420 lines. Import the handover helpers from it rather than duplicating them.

- [ ] **Step 1: Add the schemas**

In `tooltraq/devices/schemas.py`, following the file's existing style:

```python
class TransferCreate(Schema):
    tool_id: int
    to_user_id: int
    note: str = ""


class TransferRead(Schema):
    id: int
    uuid: str
    tool_id: int
    tool_name: str
    from_user_id: int
    from_user_email: str = ""
    to_user_id: int
    to_user_email: str = ""
    status: str
    note: str = ""
    expires_at: datetime
    decided_at: Optional[datetime] = None
    created_by_id: Optional[int] = None


class PagedTransfers(Schema):
    items: list[TransferRead]
    count: int
    page: int
    page_size: int
```

Match `PagedAssignments`' exact field set — read it in the same file and mirror it, since `paginate_page` populates these keys.

- [ ] **Step 2: Write the failing tests**

Append to `tooltraq/api/tests/assignments/test_transfers.py`:

```python
class CreateTransferTests(TransferSetupMixin, ApiTestCase):

    def test_holder_can_raise_a_transfer(self):
        client = self.a_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk,
            "to_user_id": self.worker_b.pk,
            "note": "on my way",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["from_user_id"], self.worker_a.pk)
        self.assertEqual(data["to_user_id"], self.worker_b.pk)
        # Custody has NOT moved yet.
        self.assignment.refresh_from_db()
        self.assertIsNone(self.assignment.returned_date)

    def test_recipient_is_notified(self):
        from notifications.models import Notification, NotificationType

        client = self.a_client()
        client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        note = Notification.objects.get(recipient=self.worker_b)
        self.assertEqual(note.notification_type, NotificationType.TRANSFER_REQUESTED)

    def test_admin_can_move_someone_elses_tool_and_from_user_is_the_holder(self):
        client = self.owner_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # from_user is the HOLDER, not the caller; created_by records the actor.
        self.assertEqual(data["from_user_id"], self.worker_a.pk)
        self.assertEqual(data["created_by_id"], self.owner.pk)

    def test_non_holder_non_officer_is_forbidden(self):
        client = self.b_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        self.assertEqual(resp.status_code, 403)

    def test_confirmation_off_transfers_immediately(self):
        self.org.require_transfer_confirmation = False
        self.org.save(update_fields=["require_transfer_confirmation"])

        client = self.a_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "accepted")
        # Custody moved, and no pending row was left behind.
        self.assignment.refresh_from_db()
        self.assertIsNotNone(self.assignment.returned_date)
        open_rows = DeviceAssignment.objects.filter(
            device=self.tool, returned_date__isnull=True
        )
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.first().assigned_to_user_id, self.worker_b.pk)
        self.assertFalse(
            ToolTransfer.objects.filter(status=ToolTransfer.Status.PENDING).exists()
        )

    def test_second_pending_transfer_is_rejected(self):
        self._pending()
        client = self.a_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "transfer_pending")

    def test_transferring_to_yourself_is_rejected(self):
        client = self.a_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_a.pk,
        })
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["code"], "invalid_recipient")

    def test_recipient_must_be_an_org_member(self):
        outsider = CustomUser.objects.create(
            email="out@x.com", workos_user_id="wu_outsider_xfer"
        )
        client = self.a_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": outsider.pk,
        })
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["code"], "invalid_recipient")

    def test_site_held_tool_cannot_be_person_transferred(self):
        self.assignment.returned_date = timezone.now().date()
        self.assignment.save(update_fields=["returned_date"])
        DeviceAssignment.objects.create(
            organization=self.org, created_by=self.owner, device=self.tool,
            assigned_to_site=self.site, assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )
        client = self.owner_client()
        resp = client.post("/assignments/transfers/", json={
            "tool_id": self.tool.pk, "to_user_id": self.worker_b.pk,
        })
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["code"], "invalid_transfer")


class ListTransferTests(TransferSetupMixin, ApiTestCase):

    def test_pending_lists_only_my_incoming_unexpired_transfers(self):
        self._pending()
        resp = self.b_client().get("/assignments/transfers/pending/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)
        # The sender sees nothing in their own pending list.
        self.assertEqual(len(self.a_client().get("/assignments/transfers/pending/").json()), 0)

    def test_pending_excludes_already_expired_rows_not_yet_swept(self):
        self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        resp = self.b_client().get("/assignments/transfers/pending/")
        self.assertEqual(len(resp.json()), 0)

    def test_org_log_is_officer_only(self):
        self._pending()
        self.assertEqual(self.owner_client().get("/assignments/transfers/").status_code, 200)
        self.assertEqual(self.b_client().get("/assignments/transfers/").status_code, 403)
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfers -v 2`
Expected: FAIL — 404s on every new route, because the router does not exist yet.

- [ ] **Step 4: Write the router**

Create `tooltraq/api/routers/assignments/transfers.py`:

```python
"""Tool transfer workflow — /api/v1/assignments/transfers/*."""
import logging

from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils import timezone
from ninja import Router

from api.auth.bearer import AuthBearer
from api.errors import ApiError
from api.pagination import paginate_page
from api.permissions import require_role
from api.routers.assignments.assignments import (
    _close_open_assignments,
    _lock_device,
    _lock_open_assignments,
    _open_assignments,
)
from devices.models import Device, DeviceAssignment, ToolTransfer
from devices.schemas import PagedTransfers, TransferCreate, TransferRead
from devices.transfer_expiry import workday_expiry
from notifications.models import NotificationType
from notifications.services import notify
from organizations.models import OrganizationMember

logger = logging.getLogger(__name__)

R = OrganizationMember.Role

router = Router(tags=["transfers"])


def _serialize_transfer(t: ToolTransfer) -> TransferRead:
    return TransferRead(
        id=t.pk,
        uuid=str(t.uuid),
        tool_id=t.device_id,
        tool_name=t.device.name,
        from_user_id=t.from_user_id,
        from_user_email=t.from_user.email if t.from_user_id else "",
        to_user_id=t.to_user_id,
        to_user_email=t.to_user.email if t.to_user_id else "",
        status=t.status,
        note=t.note,
        expires_at=t.expires_at,
        decided_at=t.decided_at,
        created_by_id=t.created_by_id,
    )


def _qs():
    return ToolTransfer.objects.select_related(
        "device", "from_user", "to_user", "created_by"
    )


def _current_user_holder(device) -> DeviceAssignment | None:
    """The open assignment for this device, only if a person holds it."""
    open_row = DeviceAssignment.objects.filter(
        device=device, returned_date__isnull=True
    ).first()
    if open_row is None or open_row.assigned_to_user_id is None:
        return None
    return open_row


def _perform_handover(device, org, actor, to_user):
    """Close whoever holds the tool and give it to ``to_user``."""
    _lock_device(device)
    open_ids = _lock_open_assignments(device)
    _close_open_assignments(_open_assignments(open_ids))
    return DeviceAssignment.objects.create(
        organization=org,
        created_by=actor,
        device=device,
        assigned_to_user=to_user,
        assigned_to_site=None,
        assigned_by=actor,
        assigned_date=timezone.now().date(),
    )


@router.post("/", response=TransferRead, auth=AuthBearer())
def create_transfer(request, payload: TransferCreate):
    org = request.auth.organization
    actor = request.auth.user
    actor_role = str(getattr(request.auth, "role", ""))

    try:
        device = Device.objects.get(
            pk=payload.tool_id, organization=org, is_active=True
        )
    except Device.DoesNotExist:
        raise Http404("Tool not found")

    to_member = OrganizationMember.objects.filter(
        user_id=payload.to_user_id, organization=org, is_active=True
    ).select_related("user").first()
    if to_member is None:
        raise ApiError(
            "invalid_recipient",
            "That person is not an active member of this organisation.",
            status=422,
        )

    with transaction.atomic():
        _lock_device(device)

        holder_row = _current_user_holder(device)
        if holder_row is None:
            raise ApiError(
                "invalid_transfer",
                "Only a tool held by a person can be transferred to a person.",
                status=422,
            )
        from_user = holder_row.assigned_to_user

        if from_user.pk == payload.to_user_id:
            raise ApiError(
                "invalid_recipient",
                "That person already holds this tool.",
                status=422,
            )

        is_officer = actor_role in (R.OWNER, R.ADMIN)
        if from_user.pk != actor.pk and not is_officer:
            raise ApiError(
                "forbidden",
                "Only the current holder or an owner/admin can transfer this tool.",
                status=403,
            )

        if not org.require_transfer_confirmation:
            _perform_handover(device, org, actor, to_member.user)
            transfer = ToolTransfer.objects.create(
                organization=org, created_by=actor, device=device,
                from_user=from_user, to_user=to_member.user,
                note=payload.note, status=ToolTransfer.Status.ACCEPTED,
                expires_at=workday_expiry(org), decided_at=timezone.now(),
                decided_by=actor,
            )
            return _serialize_transfer(_qs().get(pk=transfer.pk))

        try:
            transfer = ToolTransfer.objects.create(
                organization=org, created_by=actor, device=device,
                from_user=from_user, to_user=to_member.user,
                note=payload.note, expires_at=workday_expiry(org),
            )
        except IntegrityError:
            raise ApiError(
                "transfer_pending",
                "This tool already has a transfer waiting to be answered.",
                status=409,
            )

    notify(
        organization=org,
        recipient=to_member.user,
        notification_type=NotificationType.TRANSFER_REQUESTED,
        title="Tool transfer waiting",
        message=(
            f"{from_user.get_full_name().strip() or from_user.email} wants to "
            f"transfer {device.name} to you."
        ),
        source_object=transfer,
    )

    return _serialize_transfer(_qs().get(pk=transfer.pk))


@router.get("/pending/", response=list[TransferRead], auth=AuthBearer())
def list_pending_for_me(request):
    org = request.auth.organization
    qs = _qs().filter(
        organization=org,
        to_user=request.auth.user,
        status=ToolTransfer.Status.PENDING,
        expires_at__gt=timezone.now(),
    )
    return [_serialize_transfer(t) for t in qs]


@router.get("/", response=PagedTransfers, auth=AuthBearer())
@require_role(R.OWNER, R.ADMIN)
def list_transfers(request, status: str = None):
    org = request.auth.organization
    qs = _qs().filter(organization=org)
    if status:
        qs = qs.filter(status=status)
    paged = paginate_page(qs, request)
    paged["items"] = [_serialize_transfer(t) for t in paged["items"]]
    return paged
```

The `IntegrityError` catch is the race-safe way to enforce one pending transfer per tool: the partial unique index decides, not a check-then-insert.

- [ ] **Step 5: Mount the router**

Read `tooltraq/api/main.py` and mount `transfers.router` at `/assignments/transfers`, following exactly how the existing assignment routers are registered. Mount order matters — `/assignments/transfers/` must not be shadowed by `/assignments/{id}/`. If `assignments.router` uses a path converter that would swallow `transfers`, mount the transfers router **first** and say so in your report.

- [ ] **Step 6: Run the tests**

Run: `../.venv/bin/python manage.py test api.tests.assignments -v 2`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tooltraq/devices/schemas.py tooltraq/api/routers/assignments/transfers.py tooltraq/api/main.py tooltraq/api/tests/assignments/test_transfers.py
git commit -m "feat(transfers): raise and list tool transfers

A holder — or an owner/admin acting on their behalf — can offer a tool to
another member. from_user is always the current holder so the log
distinguishes a handover from an admin move. With confirmation disabled the
handover happens immediately and the row is recorded as already accepted.
One pending transfer per tool is enforced by the partial unique index
rather than a racy check-then-insert."
```

---

### Task 5: Accept, decline and cancel

**Files:**
- Modify: `tooltraq/api/routers/assignments/transfers.py`
- Test: `tooltraq/api/tests/assignments/test_transfers.py`

**Interfaces:**
- Consumes: everything from Task 4, especially `_serialize_transfer`, `_qs`, `_perform_handover` and `_current_user_holder`.
- Produces: `POST /assignments/transfers/{id}/accept/`, `.../decline/`, `.../cancel/`.

Accept is the one place custody actually moves on the confirmed path, so it must re-check that the world has not changed underneath it.

- [ ] **Step 1: Write the failing tests**

Append to `tooltraq/api/tests/assignments/test_transfers.py`:

```python
class DecideTransferTests(TransferSetupMixin, ApiTestCase):

    def test_recipient_accepts_and_custody_moves(self):
        from notifications.models import Notification, NotificationType

        transfer = self._pending()
        resp = self.b_client().post(f"/assignments/transfers/{transfer.pk}/accept/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "accepted")

        self.assignment.refresh_from_db()
        self.assertIsNotNone(self.assignment.returned_date)
        open_rows = DeviceAssignment.objects.filter(
            device=self.tool, returned_date__isnull=True
        )
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.first().assigned_to_user_id, self.worker_b.pk)

        transfer.refresh_from_db()
        self.assertEqual(transfer.decided_by_id, self.worker_b.pk)
        self.assertIsNotNone(transfer.decided_at)

        note = Notification.objects.get(
            recipient=self.worker_a,
            notification_type=NotificationType.TRANSFER_ACCEPTED,
        )
        self.assertIn(self.tool.name, note.message)

    def test_only_the_recipient_can_accept(self):
        transfer = self._pending()
        self.assertEqual(
            self.a_client().post(f"/assignments/transfers/{transfer.pk}/accept/").status_code,
            403,
        )
        self.assertEqual(
            self.owner_client().post(f"/assignments/transfers/{transfer.pk}/accept/").status_code,
            403,
        )

    def test_decline_leaves_custody_alone_and_notifies_sender(self):
        from notifications.models import Notification, NotificationType

        transfer = self._pending()
        resp = self.b_client().post(f"/assignments/transfers/{transfer.pk}/decline/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "declined")
        self.assignment.refresh_from_db()
        self.assertIsNone(self.assignment.returned_date)
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.worker_a,
                notification_type=NotificationType.TRANSFER_DECLINED,
            ).exists()
        )

    def test_accept_after_expiry_is_rejected(self):
        transfer = self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        resp = self.b_client().post(f"/assignments/transfers/{transfer.pk}/accept/")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "transfer_expired")
        self.assignment.refresh_from_db()
        self.assertIsNone(self.assignment.returned_date)

    def test_accept_after_custody_moved_is_rejected_and_cancels(self):
        transfer = self._pending()
        # The tool moves to the owner behind the transfer's back.
        self.assignment.returned_date = timezone.now().date()
        self.assignment.save(update_fields=["returned_date"])
        DeviceAssignment.objects.create(
            organization=self.org, created_by=self.owner, device=self.tool,
            assigned_to_user=self.owner, assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

        resp = self.b_client().post(f"/assignments/transfers/{transfer.pk}/accept/")

        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "custody_changed")
        transfer.refresh_from_db()
        self.assertEqual(transfer.status, ToolTransfer.Status.CANCELLED)
        # The owner still holds it — we did not yank it from them.
        open_rows = DeviceAssignment.objects.filter(
            device=self.tool, returned_date__isnull=True
        )
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.first().assigned_to_user_id, self.owner.pk)

    def test_accepting_twice_is_rejected(self):
        transfer = self._pending()
        self.b_client().post(f"/assignments/transfers/{transfer.pk}/accept/")
        resp = self.b_client().post(f"/assignments/transfers/{transfer.pk}/accept/")
        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "transfer_not_pending")

    def test_sender_can_cancel(self):
        transfer = self._pending()
        resp = self.a_client().post(f"/assignments/transfers/{transfer.pk}/cancel/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "cancelled")

    def test_admin_can_cancel_and_recipient_cannot(self):
        transfer = self._pending()
        self.assertEqual(
            self.b_client().post(f"/assignments/transfers/{transfer.pk}/cancel/").status_code,
            403,
        )
        self.assertEqual(
            self.owner_client().post(f"/assignments/transfers/{transfer.pk}/cancel/").status_code,
            200,
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfers.DecideTransferTests -v 2`
Expected: FAIL — 404 on every accept/decline/cancel route.

- [ ] **Step 3: Implement the three endpoints**

Append to `tooltraq/api/routers/assignments/transfers.py`:

```python
def _load_pending(transfer_id, org):
    """Fetch a transfer that is still answerable, or raise."""
    try:
        transfer = ToolTransfer.objects.select_for_update().get(
            pk=transfer_id, organization=org
        )
    except ToolTransfer.DoesNotExist:
        raise Http404("Transfer not found")

    if transfer.status != ToolTransfer.Status.PENDING:
        raise ApiError(
            "transfer_not_pending",
            f"This transfer has already been {transfer.status}.",
            status=409,
        )
    return transfer


def _decide(transfer, status, actor):
    transfer.status = status
    transfer.decided_at = timezone.now()
    transfer.decided_by = actor
    transfer.save(update_fields=["status", "decided_at", "decided_by"])


@router.post("/{transfer_id}/accept/", response=TransferRead, auth=AuthBearer())
def accept_transfer(request, transfer_id: int):
    org = request.auth.organization
    actor = request.auth.user

    # An ApiError raised inside the atomic block would roll back the status
    # write that precedes it, so the two failure paths record their decision,
    # let the transaction COMMIT, and raise afterwards.
    failure = None

    with transaction.atomic():
        transfer = _load_pending(transfer_id, org)

        if transfer.to_user_id != actor.pk:
            # Nothing written yet, so raising here is safe.
            raise ApiError(
                "forbidden", "Only the recipient can accept this transfer.", status=403
            )

        if transfer.expires_at <= timezone.now():
            _decide(transfer, ToolTransfer.Status.EXPIRED, actor)
            failure = (
                "transfer_expired",
                "This transfer has expired. Ask for it to be sent again.",
            )
        else:
            device = transfer.device
            _lock_device(device)

            holder_row = _current_user_holder(device)
            if (
                holder_row is None
                or holder_row.assigned_to_user_id != transfer.from_user_id
            ):
                _decide(transfer, ToolTransfer.Status.CANCELLED, actor)
                failure = (
                    "custody_changed",
                    "This tool has moved since the transfer was raised, so it can "
                    "no longer be accepted.",
                )
            else:
                _perform_handover(device, org, actor, actor)
                _decide(transfer, ToolTransfer.Status.ACCEPTED, actor)

    if failure:
        raise ApiError(failure[0], failure[1], status=409)

    notify(
        organization=org,
        recipient=transfer.from_user,
        notification_type=NotificationType.TRANSFER_ACCEPTED,
        title="Transfer accepted",
        message=(
            f"{actor.get_full_name().strip() or actor.email} accepted "
            f"{transfer.device.name}."
        ),
        source_object=transfer,
    )
    if transfer.created_by_id and transfer.created_by_id != transfer.from_user_id:
        notify(
            organization=org,
            recipient=transfer.created_by,
            notification_type=NotificationType.TRANSFER_ACCEPTED,
            title="Transfer accepted",
            message=(
                f"{actor.get_full_name().strip() or actor.email} accepted "
                f"{transfer.device.name}."
            ),
            source_object=transfer,
        )

    return _serialize_transfer(_qs().get(pk=transfer.pk))


@router.post("/{transfer_id}/decline/", response=TransferRead, auth=AuthBearer())
def decline_transfer(request, transfer_id: int):
    org = request.auth.organization
    actor = request.auth.user

    with transaction.atomic():
        transfer = _load_pending(transfer_id, org)
        if transfer.to_user_id != actor.pk:
            raise ApiError(
                "forbidden", "Only the recipient can decline this transfer.", status=403
            )
        _decide(transfer, ToolTransfer.Status.DECLINED, actor)

    notify(
        organization=org,
        recipient=transfer.from_user,
        notification_type=NotificationType.TRANSFER_DECLINED,
        title="Transfer declined",
        message=(
            f"{actor.get_full_name().strip() or actor.email} declined "
            f"{transfer.device.name}. You still have it."
        ),
        source_object=transfer,
    )

    return _serialize_transfer(_qs().get(pk=transfer.pk))


@router.post("/{transfer_id}/cancel/", response=TransferRead, auth=AuthBearer())
def cancel_transfer(request, transfer_id: int):
    org = request.auth.organization
    actor = request.auth.user
    actor_role = str(getattr(request.auth, "role", ""))

    with transaction.atomic():
        transfer = _load_pending(transfer_id, org)
        is_officer = actor_role in (R.OWNER, R.ADMIN)
        if transfer.from_user_id != actor.pk and not is_officer:
            raise ApiError(
                "forbidden",
                "Only the sender or an owner/admin can cancel this transfer.",
                status=403,
            )
        _decide(transfer, ToolTransfer.Status.CANCELLED, actor)

    return _serialize_transfer(_qs().get(pk=transfer.pk))
```

Note `_perform_handover(device, org, actor, actor)` — on accept, the recipient is both the actor and the new holder.

- [ ] **Step 4: Run the tests**

Run: `../.venv/bin/python manage.py test api.tests.assignments -v 2`
Expected: PASS.

- [ ] **Step 5: Verify the locking against Postgres**

The suite above runs on SQLite, where `select_for_update()` is silently a no-op — so none of the locking in this task has actually executed. Run it against Postgres:

```bash
docker run -d --name tooltraq_xfer_pg -e POSTGRES_USER=tooltraq \
  -e POSTGRES_PASSWORD=tooltraq -e POSTGRES_DB=tooltraq \
  -p 55432:5432 postgres:17-alpine
DATABASE_URL='postgres://tooltraq:tooltraq@127.0.0.1:55432/tooltraq' \
  ../.venv/bin/python manage.py test api.tests.assignments
docker rm -f tooltraq_xfer_pg
```

Expected: PASS. Report the exact command and output. If Postgres cannot be started in your environment, say so explicitly rather than skipping silently — do not claim verification you did not perform.

- [ ] **Step 6: Commit**

```bash
git add tooltraq/api/routers/assignments/transfers.py tooltraq/api/tests/assignments/test_transfers.py
git commit -m "feat(transfers): accept, decline and cancel

Accept re-checks that the sender still holds the tool before moving
custody: if it moved in the meantime the transfer is cancelled with
custody_changed rather than yanking the tool from whoever holds it now.
An expired transfer is marked expired on the accept attempt instead of
waiting for the sweep."
```

---

### Task 6: Expiry sweep

**Files:**
- Modify: `tooltraq/devices/tasks.py`
- Modify: `tooltraq/config/settings.py` (`CELERY_BEAT_SCHEDULE`, around line 702)
- Test: `tooltraq/api/tests/assignments/test_transfers.py`

**Interfaces:**
- Consumes: `ToolTransfer` (Task 3), `NotificationType.TRANSFER_EXPIRED` (Task 3).
- Produces: `devices.tasks.expire_pending_transfers` — idempotent Celery task.

Every 15 minutes, not nightly: orgs choose their own cutoff, so a daily job would leave a midday cutoff unexpired until the small hours.

- [ ] **Step 1: Write the failing tests**

Append to `tooltraq/api/tests/assignments/test_transfers.py`:

```python
class ExpirySweepTests(TransferSetupMixin, ApiTestCase):

    def test_sweep_expires_only_overdue_pending_rows(self):
        from devices.tasks import expire_pending_transfers

        overdue = self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        expire_pending_transfers()

        overdue.refresh_from_db()
        self.assertEqual(overdue.status, ToolTransfer.Status.EXPIRED)
        self.assertIsNotNone(overdue.decided_at)

    def test_sweep_leaves_future_transfers_alone(self):
        from devices.tasks import expire_pending_transfers

        live = self._pending(expires_at=timezone.now() + timedelta(hours=2))
        expire_pending_transfers()

        live.refresh_from_db()
        self.assertEqual(live.status, ToolTransfer.Status.PENDING)

    def test_sweep_notifies_sender_and_every_officer(self):
        from devices.tasks import expire_pending_transfers
        from notifications.models import Notification, NotificationType

        self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        expire_pending_transfers()

        recipients = set(
            Notification.objects.filter(
                notification_type=NotificationType.TRANSFER_EXPIRED
            ).values_list("recipient_id", flat=True)
        )
        # Sender, plus the owner — so a tool in limbo cannot go quiet.
        self.assertIn(self.worker_a.pk, recipients)
        self.assertIn(self.owner.pk, recipients)
        self.assertNotIn(self.worker_b.pk, recipients)

    def test_sweep_is_idempotent(self):
        from devices.tasks import expire_pending_transfers
        from notifications.models import Notification, NotificationType

        self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        expire_pending_transfers()
        before = Notification.objects.filter(
            notification_type=NotificationType.TRANSFER_EXPIRED
        ).count()
        expire_pending_transfers()
        after = Notification.objects.filter(
            notification_type=NotificationType.TRANSFER_EXPIRED
        ).count()
        self.assertEqual(before, after)

    def test_expired_transfer_leaves_custody_with_the_sender(self):
        from devices.tasks import expire_pending_transfers

        self._pending(expires_at=timezone.now() - timedelta(minutes=1))
        expire_pending_transfers()

        self.assignment.refresh_from_db()
        self.assertIsNone(self.assignment.returned_date)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_transfers.ExpirySweepTests -v 2`
Expected: FAIL — `ImportError: cannot import name 'expire_pending_transfers'`.

- [ ] **Step 3: Write the task**

Append to `tooltraq/devices/tasks.py`:

```python
@shared_task(name="devices.tasks.expire_pending_transfers")
def expire_pending_transfers():
    """Expire pending tool transfers whose cutoff has passed.

    Custody never moved, so nothing to undo — the tool is still with the
    sender. Owners and admins are notified alongside the sender so a tool
    stuck in limbo surfaces to someone who can act on it.

    Idempotent: rows are filtered on status=pending, so a second run in the
    same window changes nothing and sends nothing.
    """
    from notifications.models import NotificationType
    from notifications.services import notify
    from organizations.models import OrganizationMember

    from devices.models import ToolTransfer

    now = timezone.now()
    due = ToolTransfer.objects.select_related(
        "device", "from_user", "organization"
    ).filter(status=ToolTransfer.Status.PENDING, expires_at__lte=now)

    expired_count = 0
    for transfer in due:
        with transaction.atomic():
            transfer.status = ToolTransfer.Status.EXPIRED
            transfer.decided_at = now
            transfer.save(update_fields=["status", "decided_at"])

        officers = OrganizationMember.objects.filter(
            organization=transfer.organization,
            role__in=[OrganizationMember.Role.OWNER, OrganizationMember.Role.ADMIN],
            is_active=True,
        ).select_related("user")

        recipients = {transfer.from_user_id: transfer.from_user}
        for member in officers:
            recipients.setdefault(member.user_id, member.user)

        message = (
            f"The transfer of {transfer.device.name} to "
            f"{transfer.to_user.get_full_name().strip() or transfer.to_user.email} "
            f"expired unanswered. It is still with "
            f"{transfer.from_user.get_full_name().strip() or transfer.from_user.email}."
        )
        for recipient in recipients.values():
            notify(
                organization=transfer.organization,
                recipient=recipient,
                notification_type=NotificationType.TRANSFER_EXPIRED,
                title="Tool transfer expired",
                message=message,
                source_object=transfer,
            )
        expired_count += 1

    if expired_count:
        logger.info("expire_pending_transfers: expired %s transfer(s)", expired_count)
    return expired_count
```

The imports sit inside the function to match how this module's existing tasks avoid import cycles — check `check_rental_overdue` and follow whichever convention it uses.

- [ ] **Step 4: Add the beat schedule entry**

In `tooltraq/config/settings.py`, add to `CELERY_BEAT_SCHEDULE`:

```python
    "expire-pending-transfers": {
        "task": "devices.tasks.expire_pending_transfers",
        # Every 15 minutes: orgs pick their own workday-end cutoff, so a
        # nightly sweep would leave a midday cutoff unexpired for hours.
        "schedule": crontab(minute="*/15"),
    },
```

- [ ] **Step 5: Run the full suite**

Run: `../.venv/bin/python manage.py test api -v 2`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tooltraq/devices/tasks.py tooltraq/config/settings.py tooltraq/api/tests/assignments/test_transfers.py
git commit -m "feat(transfers): expire unanswered transfers at the workday cutoff

Runs every 15 minutes because each org sets its own cutoff. The tool stays
with the sender; owners and admins are notified alongside them so a tool in
limbo surfaces rather than going quiet."
```

---

### Task 7: Web portal settings and OpenAPI regeneration

**Files:**
- Modify: `tooltraq/organizations/forms.py` (`OrganizationForm`, line 7)
- Modify: `tooltraq/templates/organizations/edit.html` (and `edit_form.html`, the htmx partial — check which one renders the field list)
- Test: `tooltraq/organizations/tests/test_transfer_settings.py` (new file)
- Modify: `docs/api/openapi.json` (regenerated)

**Interfaces:**
- Consumes: `Organization.require_transfer_confirmation` / `timezone` / `workday_end_time` (Task 1).
- Produces: no API surface.

What you are extending, already verified:
- `OrganizationForm` is a plain `forms.Form` (not a `ModelForm`) with explicitly declared fields.
- `OrganizationEditView` (`views.py:88`) is gated by `OrgObjectPermissionRequiredMixin` with `permission_required = "organizations.change_organization"`. **Do not change that gate.**
- Its `get` builds initial values as `{f: getattr(org, f, "") for f in OrganizationForm.base_fields}`, so a new form field is populated from the model automatically.
- Its `post` calls `services.update_organization(org, **form.cleaned_data)`, which `setattr`s every key and saves with `update_fields=list(fields.keys())`. So a new form field whose name matches a model field persists with no view change.

**Scope note:** the spec also describes a transfer log page in the portal. It is deliberately **not** in this plan — the API already exposes `GET /assignments/transfers/` (Task 4) for officers, and a portal list view is a self-contained addition better sized as its own change. Do not build it here.

- [ ] **Step 1: Write the failing tests**

Create `tooltraq/organizations/tests/test_transfer_settings.py`. Read one existing view test in `tooltraq/organizations/tests/` first (e.g. `test_member_role_view.py`) and reuse its client/login/active-org setup verbatim rather than inventing one — the fixture below shows the assertions, not the org bootstrap:

```python
"""Transfer settings on the organization edit page."""
from datetime import time

from django.test import TestCase

# Reuse the org/user/login bootstrap from the sibling view tests in this
# directory — do not invent a new one.


class TransferSettingsFormTests(TestCase):

    def test_edit_page_shows_the_transfer_settings(self):
        self.login_as_owner()
        resp = self.client.get(f"/organizations/{self.org.pk}/edit/")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "require_transfer_confirmation")
        self.assertContains(resp, "timezone")
        self.assertContains(resp, "workday_end_time")

    def test_owner_can_save_the_transfer_settings(self):
        self.login_as_owner()
        resp = self.client.post(f"/organizations/{self.org.pk}/edit/", {
            "name": self.org.name,
            "require_transfer_confirmation": "",   # unchecked checkbox
            "timezone": "Europe/Dublin",
            "workday_end_time": "17:30",
        })
        self.assertIn(resp.status_code, (200, 302))

        self.org.refresh_from_db()
        self.assertFalse(self.org.require_transfer_confirmation)
        self.assertEqual(self.org.timezone, "Europe/Dublin")
        self.assertEqual(self.org.workday_end_time, time(17, 30))

    def test_unknown_timezone_is_rejected(self):
        self.login_as_owner()
        resp = self.client.post(f"/organizations/{self.org.pk}/edit/", {
            "name": self.org.name,
            "timezone": "Mars/Olympus_Mons",
            "workday_end_time": "17:30",
        })
        self.org.refresh_from_db()
        self.assertNotEqual(self.org.timezone, "Mars/Olympus_Mons")

    def test_site_worker_cannot_reach_the_edit_page(self):
        self.login_as_site_worker()
        resp = self.client.get(f"/organizations/{self.org.pk}/edit/")
        self.assertIn(resp.status_code, (302, 403))
```

If the existing tests assert a specific status for a denied worker, match theirs exactly instead of the `(302, 403)` tuple.

- [ ] **Step 2: Run tests to verify they fail**

Run: `../.venv/bin/python manage.py test organizations.tests.test_transfer_settings -v 2`
Expected: FAIL — the edit page does not contain the three field names.

- [ ] **Step 3: Add the form fields**

In `tooltraq/organizations/forms.py`, add to the imports:

```python
from zoneinfo import available_timezones
```

Add to `OrganizationForm`, after the business-details fields:

```python
    # Transfer workflow — see the tool-transfer-confirmation design.
    require_transfer_confirmation = forms.BooleanField(
        required=False, initial=True,
        label="Require the recipient to confirm transfers",
    )
    timezone = forms.CharField(
        max_length=64, required=False, initial="Europe/London",
        widget=forms.TextInput(attrs=_input("Europe/London")),
        label="Timezone",
    )
    workday_end_time = forms.TimeField(
        required=False, initial="18:00",
        widget=forms.TimeInput(attrs=_input("18:00"), format="%H:%M"),
        label="Workday ends at",
        help_text="Unanswered transfers expire at this time.",
    )

    def clean_timezone(self):
        value = self.cleaned_data.get("timezone")
        if not value:
            return "Europe/London"
        if value not in available_timezones():
            raise forms.ValidationError("Unknown timezone.")
        return value

    def clean_workday_end_time(self):
        from datetime import time as _time
        return self.cleaned_data.get("workday_end_time") or _time(18, 0)
```

`require_transfer_confirmation` must be `required=False` — a Django `BooleanField` that is required rejects an unchecked box, which would make the setting impossible to turn off.

- [ ] **Step 4: Render the fields in the template**

Add the three fields to `tooltraq/templates/organizations/edit.html`, matching how the surrounding fields are rendered. If the page renders fields by explicit name rather than looping the form, add them explicitly; if it loops, they appear automatically and you only need to confirm it. Check `edit_form.html` too — if that partial is what htmx re-renders, the fields must be in whichever template actually emits the inputs.

- [ ] **Step 5: Run the tests**

Run: `../.venv/bin/python manage.py test organizations -v 2`
Expected: PASS.

Then run the whole project, since `OrganizationForm` is shared with the create flow:

Run: `../.venv/bin/python manage.py test`
Expected: PASS. If `OrganizationCreateView` tests now fail, the new fields are being required on create — recheck `required=False` on all three.

- [ ] **Step 6: Regenerate the OpenAPI spec**

This plan changes the API schema, so the committed spec must be refreshed:

```bash
../.venv/bin/python manage.py export_openapi_schema --api api.main.api --output ../docs/api/openapi.json
```

If that management command does not exist under that name, find how `docs/api/openapi.json` is generated (check the Makefile and `package.json`) and use that. Confirm the diff contains the transfer endpoints and the three new organization fields, and nothing unrelated.

- [ ] **Step 7: Commit**

```bash
git add tooltraq/organizations/ tooltraq/templates/organizations/ docs/api/openapi.json
git commit -m "feat(portal): transfer settings on the organization edit page

Owners and admins set the confirmation requirement, timezone and workday
end alongside the other org settings. Timezone is validated against
zoneinfo so a typo cannot silently break expiry. OpenAPI spec regenerated
for the new endpoints and fields."
```

---

## After this plan

Deploy via Coolify, then confirm with two accounts that a transfer appears for the recipient and that custody only moves on accept.

Then Plan B — mobile: `src/api/endpoints/transfers.ts`, the launch modal, the person picker on `DeviceDetailsScreen`, and the Settings section. Regenerate mobile types from the updated `docs/api/openapi.json` with `npm run api:types`.

Known follow-ups inherited from the handover work, still open and worth folding into a later change: the two non-API writers (`sites/views/site_views.py`, `devices/services.py`) that create assignments without closing the incumbent; no partial unique index on `DeviceAssignment`; and CI running SQLite only, so no `select_for_update` regression would be caught.
