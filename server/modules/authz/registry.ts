/**
 * Central permission registry — the single source of truth for every
 * administrative capability. Synced into the `permissions` table at startup;
 * routes reference these keys and the type system rejects unknown ones.
 */
export const PERMISSIONS = {
  // USERS
  "users.view": ["users", "View user accounts and details"],
  "users.search": ["users", "Search users by username, UID, email or Discord ID"],
  "users.view_email": ["users", "See users' email addresses"],
  "users.edit_username": ["users", "Change a user's username"],
  "users.change_email": ["users", "Change a user's email"],
  "users.recover_password": ["users", "Send a password recovery link"],
  "users.lock": ["users", "Lock accounts"],
  "users.unlock": ["users", "Unlock accounts"],
  "users.ban_temporary": ["users", "Temporarily ban users"],
  "users.ban_permanent": ["users", "Permanently ban users"],
  "users.unban": ["users", "Lift bans"],
  "users.delete": ["users", "Delete accounts"],
  "users.notes": ["users", "Read and write internal notes"],
  "users.flag": ["users", "Flag suspicious accounts"],
  // BADGES
  "badges.view": ["badges", "View badge registry"],
  "badges.create": ["badges", "Create badges"],
  "badges.edit": ["badges", "Edit badges"],
  "badges.enable": ["badges", "Enable badges"],
  "badges.disable": ["badges", "Disable badges"],
  "badges.delete": ["badges", "Delete badges"],
  "badges.assign": ["badges", "Assign assignable badges"],
  "badges.assign_restricted": ["badges", "Assign restricted badges (Staff, Verified, Founder…)"],
  "badges.revoke": ["badges", "Revoke badges"],
  "badges.manage_events": ["badges", "Manage events and distributions"],
  "badges.review_custom": ["badges", "Review user custom badges"],
  // PREMIUM
  "premium.view": ["premium", "View premium status"],
  "premium.grant": ["premium", "Grant premium"],
  "premium.revoke": ["premium", "Revoke premium"],
  "premium.manage": ["premium", "Configure premium products and activation"],
  // PAYMENTS
  "payments.view": ["payments", "View purchases and transactions"],
  "payments.refund": ["payments", "Process refunds"],
  "payments.manage": ["payments", "Manage payment provider configuration"],
  // MODERATION
  "moderation.view": ["moderation", "View reports and moderation queue"],
  "moderation.manage": ["moderation", "Resolve and reject reports"],
  "moderation.warn": ["moderation", "Issue warnings"],
  "moderation.ban": ["moderation", "Moderate profiles (hide content)"],
  "support.view": ["moderation", "View support tickets"],
  "support.manage": ["moderation", "Reply to and manage support tickets"],
  // STAFF
  "staff.view": ["staff", "View staff members"],
  "staff.manage": ["staff", "Add, suspend and remove staff"],
  // ADMINISTRATORS
  "admins.view": ["admins", "View administrators"],
  "admins.manage": ["admins", "Appoint and remove administrators"],
  "permissions.manage": ["admins", "Grant and revoke individual permissions"],
  // PLATFORM
  "settings.view": ["platform", "View platform settings"],
  "settings.edit": ["platform", "Edit platform settings"],
  "settings.edit_protected": ["platform", "Edit protected security settings"],
  "flags.manage": ["platform", "Manage feature flags"],
  "announcements.manage": ["platform", "Manage announcements"],
  "integrations.manage": ["platform", "Manage integrations"],
  "storage.view": ["platform", "View storage usage"],
  "storage.manage": ["platform", "Manage storage"],
  "analytics.view": ["platform", "View platform analytics"],
  "maintenance.manage": ["platform", "Toggle maintenance mode"],
  // SECURITY
  "audit.view": ["security", "View audit logs"],
  "audit.export": ["security", "Export audit logs"],
  "sessions.manage": ["security", "Revoke user and admin sessions"],
  "security.view": ["security", "View security events and login activity"],
} as const satisfies Record<string, readonly [string, string]>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Never grantable to anyone but the owner, even via overrides. */
export const OWNER_ONLY: Permission[] = [
  "admins.manage",
  "permissions.manage",
  "payments.manage",
  "settings.edit_protected",
  "premium.manage",
  "maintenance.manage",
];

export const ROLE_DEFAULTS: Record<"ADMIN" | "STAFF", Permission[]> = {
  ADMIN: [
    "users.view", "users.search", "users.view_email", "users.edit_username", "users.change_email",
    "users.recover_password", "users.lock", "users.unlock", "users.ban_temporary", "users.unban",
    "users.notes", "users.flag",
    "badges.view", "badges.assign", "badges.revoke", "badges.review_custom",
    "premium.view", "premium.grant", "premium.revoke",
    "payments.view",
    "moderation.view", "moderation.manage", "moderation.warn", "moderation.ban",
    "support.view", "support.manage",
    "staff.view", "admins.view",
    "settings.view", "announcements.manage", "storage.view", "analytics.view",
    "audit.view", "security.view", "sessions.manage",
  ],
  STAFF: [
    "users.view", "users.search", "users.notes", "users.flag",
    "badges.view",
    "moderation.view", "moderation.warn",
    "support.view", "support.manage",
  ],
};
