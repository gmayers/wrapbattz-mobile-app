import type { components } from './generated/schema';

type S = components['schemas'];

export type TokenResponse = S['TokenResponse'];
export type UserMe = S['UserMe'];
export type OrganizationSummary = S['OrganizationSummary'];
// nfc_lock_enabled: safe for every member; the lock code itself is only on
// GET /organizations/me/nfc-lock/ (owner/admin). Not in the committed
// OpenAPI spec yet — drop the intersection after `npm run api:types`.
export type OrganizationRead = S['OrganizationRead'] & { nfc_lock_enabled?: boolean };
export type OrganizationCreate = S['OrganizationCreate'];
export type OrganizationUpdate = S['OrganizationUpdate'];
export type DemoDataStatus = S['DemoDataStatus'];

// NFC tag lock — GET/PUT/DELETE /organizations/me/nfc-lock/ (owner/admin).
// Hand-written from the agreed contract until the OpenAPI spec includes it.
export type NfcLockCodeType = 'pin' | 'hex';
export interface NfcLockConfig {
  enabled: boolean;
  code_type: NfcLockCodeType | null;
  code: string | null;
  /** 8 uppercase hex chars: the 4-byte NTAG PWD. */
  password_hex: string | null;
  /** 4 uppercase hex chars: the 2-byte NTAG PACK. */
  pack_hex: string | null;
  previous_password_hex: string | null;
  previous_pack_hex: string | null;
  updated_at: string | null;
}
export type NfcLockUpdate = { code_type: NfcLockCodeType; code: string } | { generate: true };

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

// Verified email-change flow: POST /account/email/change/ then
// POST /account/email/confirm/. Email is deliberately absent from
// UserUpdate above — this is the only way to mutate it.
export type EmailChangeRequestPayload = S['EmailChangeRequestPayload'];
export type EmailChangeRequested = S['EmailChangeRequested'];
export type EmailChangeConfirmPayload = S['EmailChangeConfirmPayload'];
export type EmailChangeConfirmed = S['EmailChangeConfirmed'];

export type OnboardingStepInfo = S['OnboardingStepInfo'];
export type OnboardingState = S['OnboardingState'];
export type PushTokenRead = S['PushTokenRead'];
export type PushTokenRequest = S['PushTokenRequest'];
export type PushTokenDelete = S['PushTokenDelete'];
export type NotificationRead = S['NotificationRead'];
export type NotificationMarkReadRequest = S['NotificationMarkReadRequest'];
export type NotificationLink = S['NotificationLink'];
export type PagedNotifications = S['PagedNotifications'];
export type UnreadCount = S['UnreadCount'];
export type MarkAllReadResult = S['MarkAllReadResult'];
export type ChannelState = S['ChannelState'];
export type TypePreference = S['TypePreference'];
export type UserPreferences = S['UserPreferences'];
export type TypePolicy = S['TypePolicy'];
export type OrgPolicy = S['OrgPolicy'];
export type OrgPolicyUpdate = S['OrgPolicyUpdate'];

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

export type OAuthAuthorizeRequest = S['OAuthAuthorizeRequest'];
export type OAuthAuthorizeResponse = S['OAuthAuthorizeResponse'];

export type ToolCategory = S['CategoryRead'];
export type LastAssignment = S['LastAssignment'];
export type OrgStats = S['OrgStats'];

export type AssignmentRead = S['AssignmentRead'];
export type AssignmentCreate = S['AssignmentCreate'];
export type AssignmentUpdate = S['AssignmentUpdate'];
export type AssignmentReturn = S['AssignmentReturn'];
export type PagedAssignments = S['PagedAssignments'];

// Person-to-person transfers: the holder (or an owner/admin) proposes, the
// recipient accepts or declines. See docs/superpowers/specs/
// 2026-08-12-tool-transfer-confirmation-design.md.
export type TransferRead = S['TransferRead'];
export type TransferCreate = S['TransferCreate'];
export type PagedTransfers = S['PagedTransfers'];
export type TransferClaimCreate = S['TransferClaimCreate'];

export type SiteRead = S['SiteRead'];
export type SiteCreate = S['SiteCreate'];
export type SiteUpdate = S['SiteUpdate'];
export type PagedSites = S['PagedSites'];
// Sites a tool can go to, its home site first and flagged is_home.
export type SiteForToolRead = S['SiteForToolRead'];
export type PagedSitesForTool = S['PagedSitesForTool'];

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
