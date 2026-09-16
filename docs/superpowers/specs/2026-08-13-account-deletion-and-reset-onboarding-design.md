# Account deletion and Reset Onboarding

**Date:** 2026-08-13
**Repos:** `gmayers/tooltraq` (backend, Parts A + B), `wrapbattz` app (mobile, Part C)
**Status:** design approved, not implemented
**Plans:** two, one per repo. Parts A + B are one backend plan; Part C is a
separate mobile plan and depends on nothing in A or B — it can ship first.

## Why

`DELETE /account/` does not exist. The mobile app already calls it from Settings →
Delete Account (`src/api/endpoints/account.ts:52`), so that row currently 404s.
In-app account deletion is required by App Store guideline 5.1.1(v) for any app
that offers account creation.

Separately, there is no way to replay the onboarding wizard from the app. The
only reset today is a backend management command
(`accounts/management/commands/reset_onboarding.py`).

## The governing decision

An **account** and a **record** are different things.

Deleting an account removes the person's ability to log in and their contact
details. It does not remove the organisation's asset-custody records. Those name
who held which tool and when, are kept on a legitimate-interest basis, and have
an insurance dimension. The user's name stays on them.

This is the same reasoning already applied to `ToolTransfer`, which retains
`from_user_email`/`to_user_email` snapshots so a row survives user deletion and
still says who was involved.

Not legal advice: the retention *period* is a separate decision the business
should confirm with whoever handles its data protection. This design makes the
period configurable and records it; it does not enforce it (see Part B).

## Part A — `DELETE /account/`

**Repo:** backend. **Endpoint:** `DELETE /api/v1/account/`, `auth=AuthBearer()`,
any authenticated member.

### Preconditions, checked before any write

Both return 409 and change nothing.

| Condition | Code | Message |
|---|---|---|
| Caller is `Organization.owner` of any org | `account_owns_organization` | Names the org; tells them to transfer ownership or delete the organisation first. |
| Caller has any open `DeviceAssignment` | `account_holds_tools` | Lists the tool names still held, so they know exactly what to return. |

Blocking on held tools is deliberate. The tools exist physically; someone has to
account for them. Auto-returning would write a return that never happened —
a false entry in the record being retained.

### The tombstone

One transaction:

- `email` → `deleted-user-<pk>@deleted.invalid` (`email` is `unique=True` and the
  `USERNAME_FIELD`, so it cannot be blanked)
- `phone_number` → `""`
- `workos_user_id` → `""`
- `is_active` → `False`
- `deleted_at` → now (new field)
- `first_name` / `last_name` → **kept**

Deleted outright, being login identity with no accountability role: the user's
`PushToken` rows.

Django `Session` rows are deliberately **not** touched. Session data stores the
user id encoded in the payload, so rows cannot be filtered by user without
decoding every one, and sessions are not how the mobile app authenticates —
it uses bearer tokens, which `AuthBearer` validates against an active
`OrganizationMember`. `is_active=False` therefore ends both portal and API access
without touching the session table.

`OrganizationMember` rows are set `is_active=False` rather than deleted, so
org history stays consistent and the member cannot be resolved by `AuthBearer`.

Nothing is hard-deleted, so `Organization.owner`'s `PROTECT` and the
`assignment_user_xor_site` CHECK constraint are both sidestepped. Those remain
open bugs; they simply stop blocking this feature.

### WorkOS

Delete the WorkOS user **after** the local transaction commits, wrapped so a
failure is logged and not raised. Rationale: a WorkOS outage must not leave a
half-deleted local account, and `is_active=False` already blocks authentication
on its own — `AuthBearer` resolves an active `OrganizationMember`, and Django's
auth rejects inactive users. The WorkOS deletion is defence in depth, not the
mechanism.

No existing code deletes a WorkOS user; this is the first such call.

### Response

`204 No Content`. The mobile app already handles the rest: it shows a two-step
destructive confirmation before calling, and logs out after.

## Part B — retention setting

`Organization.record_retention_years` — `PositiveSmallIntegerField(default=7)`,
alongside the transfer settings from the tool-transfer work. Exposed on
`OrganizationRead`/`OrganizationUpdate` and on the portal organisation edit form,
owner/admin only, exactly like the transfer settings.

**It is declarative only. Nothing enforces it.** A sweep that hard-deletes
tombstoned users past the period is explicit follow-up work, and it will have to
solve the `PROTECT` and CHECK-constraint problems this design avoids. Recording
the period without acting on it is honest about where the business is; a setting
that silently does nothing would not be, which is why this paragraph exists.

Default of 7 years reflects common UK business-record practice and is a starting
point, not advice.

## Part C — Reset Onboarding

**Repo:** mobile. **No backend change** — `PATCH /account/onboarding/` already
accepts all three flags (`accounts/schemas.py:132-135`).

One row in the Account section of `src/screens/Settings/sections.ts`, visible to
every role (`requiredRole: 'all'`), non-destructive styling:

```
{ key: 'resetOnboarding', label: 'Reset Onboarding',
  icon: 'refresh-outline', kind: 'action', onPressType: 'resetOnboarding' }
```

On press: a confirmation alert explaining it replays the setup wizard and changes
no organisation data, then

```ts
await updateOnboarding({
  has_completed_onboarding: false,
  has_seen_onboarding_outro: false,
  onboarding_step: <first step of the user's flow>,
})
```

then navigate to `OnboardingWizard` (registered in `src/navigation/index.tsx`).

The first step must come from the user's actual flow rather than a hardcoded
string — the wizard is role-branched (`accounts/onboarding_flow.py`), and
`GET /account/onboarding/` returns the ordered steps. Read the first step key
from that response rather than guessing.

Touches nothing shared: no organisation data, no tools, no members, no demo data.

## Error handling

| Case | Response | Mobile treatment |
|---|---|---|
| Caller owns an organisation | 409 `account_owns_organization` | Alert naming the org |
| Caller holds tools | 409 `account_holds_tools` | Alert listing the tools |
| WorkOS deletion fails | 204 anyway, logged | None — deletion succeeded locally |
| Reset onboarding fails | Surfaced by `normalizeFormError` | Alert |

## Testing

**Backend:**

1. Deleting a plain member tombstones the row: placeholder email, cleared phone
   and `workos_user_id`, `is_active=False`, `deleted_at` set, **name retained**.
2. Their `PushToken` rows and sessions are gone.
3. Their `OrganizationMember` rows are `is_active=False`, not deleted.
4. An org owner gets 409 `account_owns_organization` and the row is untouched.
5. A member holding a tool gets 409 `account_holds_tools`, the response names the
   tool, and the row is untouched.
6. A member whose only assignments are already returned CAN delete.
7. Assignment history still resolves the holder's name after deletion — the point
   of the whole design.
8. A tombstoned user cannot authenticate.
9. WorkOS deletion failure does not roll back the local tombstone.
10. `record_retention_years` round-trips through `PATCH /organizations/me/` and the
    portal form, owner/admin only.

**Mobile:**

1. The Reset Onboarding row renders for every role.
2. Pressing it calls `updateOnboarding` with all three flags and the first step
   from `GET /account/onboarding/`.
3. It navigates to the wizard on success and alerts on failure.

## Out of scope

- The retention purge job (Part B is declarative).
- Fixing `assignment_user_xor_site` or `Organization.owner`'s `PROTECT` — both
  sidestepped, both still open.
- Adding name snapshots to `DeviceAssignment`; unnecessary while the tombstone
  keeps the FK resolvable.
- Any change to the existing two-step delete confirmation in mobile Settings.
