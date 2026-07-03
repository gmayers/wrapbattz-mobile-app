import type { components } from './generated/schema';

type S = components['schemas'];

export type TokenResponse = S['TokenResponse'];
export type UserMe = S['UserMe'];
export type OrganizationSummary = S['OrganizationSummary'];
export type OrganizationRead = S['OrganizationRead'];
export type OrganizationCreate = S['OrganizationCreate'];
export type OrganizationUpdate = S['OrganizationUpdate'];

export type LoginRequest = S['LoginRequest'];
export type RegisterRequest = S['RegisterRequest'];
export type VerifyPendingResponse = S['VerifyPendingResponse'];
export type VerifyEmailRequest = S['VerifyEmailRequest'];
export type RefreshRequest = S['RefreshRequest'];
export type ForgotPasswordRequest = S['ForgotPasswordRequest'];
export type ResetPasswordRequest = S['ResetPasswordRequest'];
export type ChangePasswordRequest = S['ChangePasswordRequest'];

export type UserUpdate = S['UserUpdate'];
export type OnboardingUpdate = S['OnboardingUpdate'];

// GET /account/onboarding/ — the wizard shape (flow + ordered steps). Mirrors
// the backend OnboardingState/OnboardingStepInfo schemas. Hand-written because
// this read endpoint is not yet in the committed OpenAPI spec; regenerate types
// (npm run api:types) once the spec includes it and switch to S['OnboardingState'].
export interface OnboardingStepInfo {
  key: string;
  label: string;
  number: number;
  done: boolean;
  active: boolean;
}
export interface OnboardingState {
  flow: string;
  current_step: string;
  completed: boolean;
  steps: OnboardingStepInfo[];
  role: string | null;
}
export type PushTokenRead = S['PushTokenRead'];
export type PushTokenRequest = S['PushTokenRequest'];
export type PushTokenDelete = S['PushTokenDelete'];
export type NotificationRead = S['NotificationRead'];
export type NotificationMarkReadRequest = S['NotificationMarkReadRequest'];

export type MemberRead = S['MemberRead'];
export type MemberUpdate = S['MemberUpdate'];
export type PagedMembers = S['PagedMembers'];

export type InvitationRead = S['InvitationRead'];
export type InvitationCreate = S['InvitationCreate'];
export type InvitationAccept = S['InvitationAccept'];
export type InvitationByTokenRead = S['InvitationByTokenRead'];
export type PagedInvitations = S['PagedInvitations'];

export type JoinRequestRead = S['JoinRequestRead'];
export type JoinRequestCreate = S['JoinRequestCreate'];
export type JoinRequestApprove = S['JoinRequestApprove'];
export type JoinRequestDeny = S['JoinRequestDeny'];
export type PagedJoinRequests = S['PagedJoinRequests'];

export type ToolRead = S['ToolRead'];
export type ToolCreate = S['ToolCreate'];
export type ToolUpdate = S['ToolUpdate'];
export type PagedTools = S['PagedTools'];
export type ToolPhotoRead = S['ToolPhotoRead'];

// Lifecycle fields the backend exposes on ToolRead per the QA round-4
// contract. Optional/absent until docs/api/openapi.json is regenerated
// after the backend ships — every consumer must tolerate undefined.
export interface ToolLifecycleFields {
  maintenance_interval_days?: number | null;
  next_maintenance_date?: string | null;
  warranty_expiry?: string | null;
  purchase_date?: string | null;
  purchase_cost?: string | number | null;
  condition_score?: string | number | null;
}

// Tool make/model/type were extracted into a dedicated table on the backend;
// tools now reference a row by `category_id`. Hand-written because the committed
// OpenAPI spec predates the `/tools/categories/` endpoint — replace with the
// generated type once docs/api/openapi.json is regenerated (`npm run api:types`).
export interface ToolCategory {
  id: number;
  name: string;
}

export type AssignmentRead = S['AssignmentRead'];
export type AssignmentCreate = S['AssignmentCreate'];
export type AssignmentUpdate = S['AssignmentUpdate'];
export type AssignmentReturn = S['AssignmentReturn'];
export type PagedAssignments = S['PagedAssignments'];

export type SiteRead = S['SiteRead'];
export type SiteCreate = S['SiteCreate'];
export type SiteUpdate = S['SiteUpdate'];
export type PagedSites = S['PagedSites'];

export type SiteAssignmentRead = S['SiteAssignmentRead'];
export type SiteAssignmentCreate = S['SiteAssignmentCreate'];
export type SiteAssignmentUpdate = S['SiteAssignmentUpdate'];
export type PagedSiteAssignments = S['PagedSiteAssignments'];

export type VanRead = S['VanRead'];
export type VanCreate = S['VanCreate'];
export type VanUpdate = S['VanUpdate'];
export type PagedVans = S['PagedVans'];

export type IncidentRead = S['IncidentRead'];
export type IncidentCreate = S['IncidentCreate'];
export type IncidentUpdate = S['IncidentUpdate'];
export type PagedIncidents = S['PagedIncidents'];

export type FeedbackRead = S['FeedbackRead'];
export type FeedbackSuggestion = S['FeedbackSuggestion'];

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}
