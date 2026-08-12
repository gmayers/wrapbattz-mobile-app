# Assignment Handover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tool that already has an active assignment be reassigned, by closing the outgoing assignment and opening the incoming one atomically, instead of returning 409.

**Architecture:** Two helpers in the assignments router — one that locks a device's open assignments, one that closes them — used by both `create_assignment` and `_self_assign`. `DeviceAssignment` keeps meaning "who holds this, now"; handover writes a `returned_date` on the outgoing row so history stays gapless. Self-assign keeps a 409 when another *person* holds the tool, since taking a tool out of a named person's custody is what the transfer-confirmation feature is for.

**Tech Stack:** Django 5, django-ninja, Postgres, Django `TestCase` (not pytest).

## Global Constraints

- Repo: `gmayers/tooltraq`, local checkout `~/Documents/programming/live-projects/wrapbattz2/backoffice/new`.
- All commands run from the `tooltraq/` subdirectory: `cd ~/Documents/programming/live-projects/wrapbattz2/backoffice/new/tooltraq`.
- Test command: `../.venv/bin/python manage.py test api.tests.assignments`
- Baseline before any change: **34 tests, OK**.
- Never combine `select_related()` with `select_for_update()` on `DeviceAssignment`. Its nullable FKs produce LEFT OUTER JOINs and Postgres rejects `FOR UPDATE` on the nullable side. This is already documented at `api/routers/assignments/assignments.py:255-258`.
- `ApiError` signature is `ApiError(code, message, status=...)`, matching existing use at line 205.
- No OpenAPI schema change — only new error *codes*, which the schema does not enumerate. Do **not** regenerate `docs/api/openapi.json` or the mobile types.
- Do not touch the mobile app in this plan.

---

### Task 1: Handover helpers and `POST /assignments/`

**Files:**
- Modify: `tooltraq/api/routers/assignments/assignments.py` (add helpers near `_qs_select_related`, rewrite `create_assignment` at lines 182-217)
- Test: `tooltraq/api/tests/assignments/test_assignments.py` (replace `CreateAssignmentTests.test_409_when_tool_already_assigned` at lines 265-273)

**Interfaces:**
- Consumes: `DeviceAssignment`, `_qs_select_related`, `_serialize`, `transaction` — all already imported in this module.
- Produces:
  - `_lock_open_assignments(device) -> list[int]`
  - `_close_active_assignment(device, condition="") -> DeviceAssignment | None`

  Task 2 uses both.

- [ ] **Step 1: Replace the existing 409 test with a handover test**

In `tooltraq/api/tests/assignments/test_assignments.py`, delete `test_409_when_tool_already_assigned` from `CreateAssignmentTests` (lines 265-273) and put this in its place:

```python
    def test_handover_closes_previous_assignment(self):
        previous = _make_assignment(self.org, self.owner, self.worker, self.tool)
        other = CustomUser.objects.create(
            email="other@o.com", workos_user_id="wu_other_handover"
        )
        OrganizationMemberFactory(user=other, organization=self.org, role=R.SITE_WORKER)

        client = self.admin_client()
        resp = client.post("/assignments/", json={
            "tool_id": self.tool.pk,
            "assignee_user_id": other.pk,
        })

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["assignee_user_id"], other.pk)

        previous.refresh_from_db()
        self.assertEqual(previous.returned_date, timezone.now().date())

        open_rows = DeviceAssignment.objects.filter(
            device=self.tool, returned_date__isnull=True
        )
        self.assertEqual(open_rows.count(), 1)
        self.assertEqual(open_rows.first().assigned_to_user_id, other.pk)

    def test_site_held_tool_can_be_assigned_to_a_user(self):
        DeviceAssignment.objects.create(
            organization=self.org,
            created_by=self.owner,
            device=self.tool,
            assigned_to_site=self.site,
            assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

        client = self.admin_client()
        resp = client.post("/assignments/", json={
            "tool_id": self.tool.pk,
            "assignee_user_id": self.worker.pk,
        })

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["assignee_user_id"], self.worker.pk)
        self.assertEqual(
            DeviceAssignment.objects.filter(
                device=self.tool, returned_date__isnull=True
            ).count(),
            1,
        )

    def test_transfer_between_sites_closes_previous(self):
        depot = Site.objects.create(
            organization=self.org,
            created_by=self.owner,
            name="Depot",
            site_type=SiteType.WAREHOUSE,
            status=SiteStatus.ACTIVE,
        )
        DeviceAssignment.objects.create(
            organization=self.org,
            created_by=self.owner,
            device=self.tool,
            assigned_to_site=self.site,
            assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

        client = self.admin_client()
        resp = client.post("/assignments/", json={
            "tool_id": self.tool.pk,
            "assignee_site_id": depot.pk,
        })

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["assignee_site_id"], depot.pk)
        self.assertEqual(
            DeviceAssignment.objects.filter(
                device=self.tool, returned_date__isnull=True
            ).count(),
            1,
        )
        self.assertEqual(DeviceAssignment.objects.filter(device=self.tool).count(), 2)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_assignments.CreateAssignmentTests -v 2`

Expected: both new tests FAIL with `AssertionError: 409 != 200`.

- [ ] **Step 3: Add the two helpers**

In `tooltraq/api/routers/assignments/assignments.py`, immediately after `_qs_select_related()` (which ends at line 68), add:

```python
def _lock_open_assignments(device: Device) -> list[int]:
    """Lock the device's open assignment rows for the current transaction.

    No ``select_related`` here: the nullable FKs produce LEFT OUTER JOINs and
    Postgres rejects ``FOR UPDATE`` on the nullable side of an outer join.
    """
    return list(
        DeviceAssignment.objects
        .select_for_update()
        .filter(device=device, returned_date__isnull=True)
        .values_list("pk", flat=True)
    )


def _close_active_assignment(device: Device, condition: str = ""):
    """Close the device's open assignment, if any, and return it.

    Caller must already be inside a transaction holding the row lock from
    ``_lock_open_assignments``.
    """
    open_assignment = (
        DeviceAssignment.objects
        .filter(device=device, returned_date__isnull=True)
        .first()
    )
    if open_assignment is None:
        return None

    open_assignment.returned_date = timezone.now().date()
    if condition:
        open_assignment.return_condition = condition
    open_assignment.save(update_fields=["returned_date", "return_condition"])
    return open_assignment
```

- [ ] **Step 4: Rewrite `create_assignment` to hand over**

In the same file, replace the body of `create_assignment` from the 409 block (lines 203-217) with:

```python
    with transaction.atomic():
        _lock_open_assignments(device)
        _close_active_assignment(device)

        assignment = DeviceAssignment.objects.create(
            organization=org,
            created_by=actor,
            device=device,
            assigned_to_user_id=payload.assignee_user_id,
            assigned_to_site_id=payload.assignee_site_id,
            assigned_by=actor,
            assigned_date=timezone.now().date(),
        )

    assignment = _qs_select_related().get(pk=assignment.pk)
    return _serialize(assignment)
```

The `has_user == has_site` validation and the `Device.objects.get(...)` lookup above it stay exactly as they are. The `@require_role(R.OWNER, R.ADMIN, R.OFFICE_WORKER)` decorator also stays untouched — `test_worker_cannot_create_assignment` must keep passing, since handover must not widen who can move a tool.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `../.venv/bin/python manage.py test api.tests.assignments -v 2`

Expected: PASS. Test count goes 34 → 36 (one test replaced by three).

- [ ] **Step 6: Commit**

```bash
git add tooltraq/api/routers/assignments/assignments.py tooltraq/api/tests/assignments/test_assignments.py
git commit -m "feat(assignments): hand over instead of 409 on POST /assignments/

A tool sitting at a location holds an active site assignment, so the
'tool already has an active assignment' check rejected every transfer
and every reassignment. Close the outgoing assignment and open the
incoming one in one transaction; history stays gapless."
```

---

### Task 2: Self-assign takeover, idempotent re-scan, and the held-by-person guard

**Files:**
- Modify: `tooltraq/api/routers/assignments/assignments.py` (rewrite `_self_assign`, currently lines 314-331)
- Test: `tooltraq/api/tests/assignments/test_assignments.py` (replace `SelfAssignTests.test_409_when_tool_already_assigned` at lines 365-370 and `test_409_when_tool_already_assigned_via_nfc` at lines 410-417)

**Interfaces:**
- Consumes: `_lock_open_assignments(device)` and `_close_active_assignment(device)` from Task 1.
- Produces: no new callable. New error code `tool_held_by_user` (409), consumed by the mobile app in a later change.

- [ ] **Step 1: Replace both stale 409 tests**

Both existing tests assign the tool to `self.worker` and then call as `self.worker`, which is now the idempotent case — they must be rewritten, not just moved.

In `SelfAssignTests`, delete `test_409_when_tool_already_assigned` (lines 365-370) and add:

```python
    def test_self_assign_takes_over_from_a_site(self):
        DeviceAssignment.objects.create(
            organization=self.org,
            created_by=self.owner,
            device=self.tool,
            assigned_to_site=self.site,
            assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

        client = self.worker_client()
        resp = client.post(f"/tools/{self.tool.pk}/assign-to-me/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["assignee_user_id"], self.worker.pk)
        self.assertEqual(
            DeviceAssignment.objects.filter(
                device=self.tool, returned_date__isnull=True
            ).count(),
            1,
        )

    def test_self_assign_is_idempotent_when_caller_already_holds_it(self):
        existing = _make_assignment(self.org, self.owner, self.worker, self.tool)

        client = self.worker_client()
        resp = client.post(f"/tools/{self.tool.pk}/assign-to-me/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["id"], existing.pk)
        self.assertEqual(DeviceAssignment.objects.filter(device=self.tool).count(), 1)

    def test_409_when_tool_held_by_another_user(self):
        holder = CustomUser.objects.create(
            email="holder@h.com", workos_user_id="wu_holder_selfassign"
        )
        OrganizationMemberFactory(user=holder, organization=self.org, role=R.SITE_WORKER)
        _make_assignment(self.org, self.owner, holder, self.tool)

        client = self.worker_client()
        resp = client.post(f"/tools/{self.tool.pk}/assign-to-me/")

        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "tool_held_by_user")
        self.assertIn("holder@h.com", resp.json()["message"])
```

Then replace `test_409_when_tool_already_assigned_via_nfc` (lines 410-417) with:

```python
    def test_nfc_assign_409_when_tool_held_by_another_user(self):
        self.tool.nfc_tag_id = "CCDDEE"
        self.tool.save(update_fields=["nfc_tag_id"])
        holder = CustomUser.objects.create(
            email="holder2@h.com", workos_user_id="wu_holder_nfc"
        )
        OrganizationMemberFactory(user=holder, organization=self.org, role=R.SITE_WORKER)
        _make_assignment(self.org, self.owner, holder, self.tool)

        client = self.worker_client()
        resp = client.post("/tools/by-identifier/CCDDEE/assign/")

        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.json()["code"], "tool_held_by_user")

    def test_nfc_assign_takes_over_from_a_site(self):
        self.tool.nfc_tag_id = "AABBCC"
        self.tool.save(update_fields=["nfc_tag_id"])
        DeviceAssignment.objects.create(
            organization=self.org,
            created_by=self.owner,
            device=self.tool,
            assigned_to_site=self.site,
            assigned_by=self.owner,
            assigned_date=timezone.now().date(),
        )

        client = self.worker_client()
        resp = client.post("/tools/by-identifier/AABBCC/assign/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["assignee_user_id"], self.worker.pk)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `../.venv/bin/python manage.py test api.tests.assignments -v 2`

Expected: the two takeover tests FAIL with `409 != 200`; the idempotent test FAILS with `409 != 200`; the two `tool_held_by_user` tests FAIL with `'tool_unavailable' != 'tool_held_by_user'`.

- [ ] **Step 3: Rewrite `_self_assign`**

Replace the whole body of `_self_assign` (lines 314-331) with:

```python
def _self_assign(request, device: Device) -> AssignmentRead:
    org = request.auth.organization
    actor = request.auth.user

    with transaction.atomic():
        _lock_open_assignments(device)
        current = (
            DeviceAssignment.objects
            .filter(device=device, returned_date__isnull=True)
            .first()
        )

        if current is not None and current.assigned_to_user_id == actor.pk:
            # Idempotent: re-scanning a tag you already hold is not an error.
            return _serialize(_qs_select_related().get(pk=current.pk))

        if current is not None and current.assigned_to_user_id is not None:
            holder = current.assigned_to_user
            name = holder.get_full_name().strip() or holder.email
            raise ApiError(
                "tool_held_by_user",
                f"This tool is currently with {name}. Ask them to transfer "
                f"it to you, or request it.",
                status=409,
            )

        # Held by a site, or not held at all — take it.
        _close_active_assignment(device)
        assignment = DeviceAssignment.objects.create(
            organization=org,
            created_by=actor,
            device=device,
            assigned_to_user=actor,
            assigned_to_site=None,
            assigned_by=actor,
            assigned_date=timezone.now().date(),
        )

    return _serialize(_qs_select_related().get(pk=assignment.pk))
```

- [ ] **Step 4: Run the full assignments suite**

Run: `../.venv/bin/python manage.py test api.tests.assignments -v 2`

Expected: PASS, 39 tests.

- [ ] **Step 5: Commit**

```bash
git add tooltraq/api/routers/assignments/assignments.py tooltraq/api/tests/assignments/test_assignments.py
git commit -m "feat(assignments): self-assign takes over from a site

Picking up a tool that sits at a location is the common field action and
it 409'd every time. Take it over instead. Re-scanning a tag you already
hold is now idempotent rather than an error. A tool held by another
person still 409s, with a new tool_held_by_user code pointing at the
transfer flow rather than the old generic tool_unavailable."
```

---

### Task 3: Availability and history regression coverage

**Files:**
- Test: `tooltraq/api/tests/assignments/test_assignments.py` (add a new class at the end)

**Interfaces:**
- Consumes: the handover behaviour from Tasks 1 and 2. Adds no production code.

This task exists because `annotate_assignment_fields` and `is_available` derive from "does an open assignment exist". Handover writes two rows per move, so a bug that closed the wrong row would silently make tools look permanently unavailable — the exact symptom being fixed.

- [ ] **Step 1: Write the failing test**

Append to `tooltraq/api/tests/assignments/test_assignments.py`:

```python
class HandoverConsistencyTests(AssignmentSetupMixin, ApiTestCase):
    """Handover writes two rows per move; availability must still be right."""

    def test_tool_is_available_to_list_after_repeated_handovers(self):
        client = self.admin_client()

        for _ in range(3):
            resp = client.post("/assignments/", json={
                "tool_id": self.tool.pk,
                "assignee_site_id": self.site.pk,
            })
            self.assertEqual(resp.status_code, 200)
            resp = client.post("/assignments/", json={
                "tool_id": self.tool.pk,
                "assignee_user_id": self.worker.pk,
            })
            self.assertEqual(resp.status_code, 200)

        self.assertEqual(
            DeviceAssignment.objects.filter(
                device=self.tool, returned_date__isnull=True
            ).count(),
            1,
        )
        self.assertEqual(DeviceAssignment.objects.filter(device=self.tool).count(), 6)

    def test_history_lists_every_hop(self):
        client = self.admin_client()
        client.post("/assignments/", json={
            "tool_id": self.tool.pk, "assignee_site_id": self.site.pk,
        })
        client.post("/assignments/", json={
            "tool_id": self.tool.pk, "assignee_user_id": self.worker.pk,
        })

        resp = client.get(f"/tools/{self.tool.pk}/history/")

        self.assertEqual(resp.status_code, 200)
        items = resp.json()["items"]
        self.assertEqual(len(items), 2)
        # Exactly one hop is still open.
        self.assertEqual(len([i for i in items if i["returned_at"] is None]), 1)
```

- [ ] **Step 2: Run the tests**

Run: `../.venv/bin/python manage.py test api.tests.assignments.test_assignments.HandoverConsistencyTests -v 2`

Expected: PASS. These describe the behaviour Tasks 1 and 2 already built, so they should pass immediately. If either fails, the wrong row is being closed — stop and fix the helper before continuing.

- [ ] **Step 3: Run the whole API suite for regressions**

Run: `../.venv/bin/python manage.py test api`

Expected: PASS. Any failure outside `api.tests.assignments` means another caller depended on the 409 — investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add tooltraq/api/tests/assignments/test_assignments.py
git commit -m "test(assignments): lock down availability across repeated handovers"
```

---

## After this plan

Deploy the backend via Coolify, then confirm on a device that Transfer to location and Assign work from `DeviceDetailsScreen` and `LocationDetailsScreen`. No mobile release is needed for this change.

The transfer-confirmation feature (`docs/superpowers/specs/2026-08-12-tool-transfer-confirmation-design.md`) gets its own plan once this is deployed and verified.
