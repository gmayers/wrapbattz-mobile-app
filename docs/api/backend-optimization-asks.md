# Backend changes to support mobile API-efficiency work

Date: 2026-07-28. Written from the mobile side; "current behavior" below is per the
committed `docs/api/openapi.json` — **verify each against the deployed backend**
(gmayers/tooltraq), since the committed spec may lag.

Context: the app is adopting a client-side cache (TanStack Query persisted to
expo-sqlite). That fixes duplicate/refetch churn on the client, but several
payload and round-trip problems can only be fixed server-side.

## Already supported — mobile-side work only (no backend change)

For scoping: these do NOT need backend changes, the app just isn't using them yet.

- `GET /assignments/` already accepts `status`, `tool`, `user`, `site` filters.
  The app fetches unfiltered lists and filters client-side.
- `GET /tools/` already paginates (`page`, `page_size`, `PagedTools.total`).
- `GET /sites/` already accepts `site_type` and `status`.
- `OrganizationRead` already exposes `member_count`, `tool_count`, `site_count` —
  the app fetches the full member list just to count members.

## 1. Org stats/summary endpoint — HIGH

**New:** `GET /organizations/me/stats/` returning counts, e.g.:

```json
{
  "tools":       { "total": 0, "with_nfc_tag": 0, "available": 0 },
  "assignments": { "active": 0 },
  "incidents":   { "open": 0, "missing": 0, "maintenance_due": 0, "critical": 0 },
  "members":     { "total": 0, "admins": 0, "workers": 0 },
  "sites":       { "total": 0, "active": 0 }
}
```

**Why:** each dashboard mount currently fires up to 6 full-list GETs purely to
compute scalars — `GET /tools/?page_size=200` (200 full objects) just to count
`nfc_tag_id != null`, the entire incident list to count severities, the full
member list to count admins vs workers. One stats call replaces roughly 5 of the
6 dashboard requests and ~99% of the payload.

## 2. Incident list filters + pagination — HIGH

**Current:** `GET /incidents/` and `GET /incidents/mine/` accept **no query
params at all** (response envelope `PagedIncidents` already exists).

**Add:** `page`, `page_size`, and filters `tool_id`, `status`, `severity`,
optionally `ordering` (default `-created_at`).

**Why:** the device-detail screen downloads the entire org incident list and
filters to one tool client-side on every open; the Incidents tab downloads
everything to display 5 rows. `IncidentRead` already has `tool_id`, so a filter
is natural.

## 3. Pagination on remaining list endpoints — MEDIUM

**Current:** `/members/`, `/invitations/`, `/sites/`, `/assignments/`,
`/site-assignments/` accept no `page`/`page_size` (all already return `Paged*`
envelopes).

**Add:** the same `page`/`page_size` contract `/tools/` uses.

**Verify:** the app already sends `page`/`page_size` to `GET /invitations/`
(MembersScreen walks pages using `total_pages`), yet the spec declares no
params. Confirm whether the deployed backend honors or silently ignores them,
and re-export the spec if it's stale.

## 4. Invitation status filter — MEDIUM

**Add:** `GET /invitations/?status=pending`.

**Why:** the app downloads every invitation ever created (up to 20 pages × 200)
then discards all non-pending rows client-side.

## 5. Tool category list endpoint — MEDIUM

**New:** `GET /tools/categories/` → distinct `[{ "id": 1, "name": "Drill" }]`.

**Why:** known gap (no category-list endpoint exists). The app currently fetches
`GET /tools/?page_size=200` — 200 full ToolRead objects — on every Add-Device
mount just to Set-dedupe `category_id`/`category_name` pairs.

## 6. Last-holder info on ToolRead — MEDIUM

**Current:** `ToolRead` has no current/last-assignment field; the only source is
`GET /tools/{tool_id}/history/`.

**Add:** something like `last_assignment: { user_id, user_name, returned_at } | null`
on `ToolRead` (at minimum in list responses).

**Why:** the Tools tab does an N+1 fan-out — one history GET per site-held tool
(concurrency 4) — solely to render a "last held by" label. 20 tools = 20 extra
requests, multiplied up to 3× by the transient-retry interceptor on a bad
network.

## 7. Onboarding PATCH should return onboarding state — SMALL

**Current (verify):** `PATCH /account/onboarding/` does not return the
`OnboardingState` the wizard needs, so every step advance is PATCH →
`GET /account/onboarding/`, sequentially — 6 extra round trips across the
wizard, doubling perceived step latency.

**Change:** return the updated onboarding state in the PATCH response (or embed
it in `UserMe`).

## 8. Optional / low priority

- **Incident detail photo embed:** report-detail is a forced 2-step waterfall
  (`GET /incidents/{id}/` → `GET /tools/{tool_id}/photos/`). Embedding photo
  URLs in the incident detail response would halve its latency.
- **`ETag`/`Cache-Control` on list GETs:** nice-to-have once the client cache
  lands (enables cheap 304 revalidation).
- **Billing contract:** the `/billing` endpoints were removed server-side, but
  the mobile Subscribe screen still calls `GET /billing/subscription/` (and has
  a client bug that can loop it after a purchase — being fixed app-side).
  Confirm what, if anything, replaces that contract.
