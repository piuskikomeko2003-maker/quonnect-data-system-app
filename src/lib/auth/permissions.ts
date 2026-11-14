export type UserRole = 'super_admin' | 'admin' | 'regional_manager' | 'user' | 'unassigned';

/**
 * Sections a Regional Manager can be granted access to. Sections that are not
 * in this list (settings, form builder, markets, stickers) always stay
 * admin-only, regardless of a regional manager's permissions.
 */
export const REGION_SECTIONS = [
  { id: 'overview', name: 'Overview', description: 'Region-wide KPIs, growth and retention charts.' },
  { id: 'vendors', name: 'Vendors', description: 'Vendor directory, profiles and survey data.' },
  { id: 'walkins', name: 'Walk-ins', description: 'Walk-in visitor records and estimates.' },
  { id: 'paid-vendors', name: 'Paid Vendors', description: 'Paid registration, gate entry and table allocation.' },
  { id: 'finance', name: 'Finance', description: 'Income, expenses and edition ledgers.' },
  { id: 'quick-entry', name: 'Quick Entry', description: 'Enter data and generate edition registration links.' },
  { id: 'ratings', name: 'Ratings & Export', description: 'Vendor ratings and CSV exports.' },
  { id: 'import-export', name: 'Import/Export', description: 'CSV import batches and data exports.' },
  { id: 'jobs', name: 'Jobs Supported', description: 'Employment impact reporting.' },
] as const;

export type RegionSectionKey = (typeof REGION_SECTIONS)[number]['id'];
export type SectionAccessLevel = 'view' | 'manage';
export type SectionPermissions = Partial<Record<RegionSectionKey, SectionAccessLevel>>;

export const REGION_SECTION_IDS = REGION_SECTIONS.map((section) => section.id);

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  managed_region_id?: string | null;
  section_permissions?: SectionPermissions | null;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin' as const,
  ADMIN: 'admin' as const,
  REGIONAL_MANAGER: 'regional_manager' as const,
  USER: 'user' as const,
  UNASSIGNED: 'unassigned' as const,
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
  regional_manager: 1,
  user: 1,
  unassigned: 0,
};

export function isApproved(userRole: UserRole | undefined | null): boolean {
  if (!userRole) return false;
  return userRole !== ROLES.UNASSIGNED;
}

export function hasRole(userRole: UserRole | undefined | null, requiredRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isAdmin(userRole: UserRole | undefined | null): boolean {
  return hasRole(userRole, ROLES.ADMIN);
}

export function isSuperAdmin(userRole: UserRole | undefined | null): boolean {
  return userRole === ROLES.SUPER_ADMIN;
}

export function isRegionalManager(userRole: UserRole | undefined | null): boolean {
  return userRole === ROLES.REGIONAL_MANAGER;
}

/**
 * The access level a regional manager has for a section. Returns null when the
 * section was not granted. Only meaningful for the `regional_manager` role.
 */
export function getSectionAccess(
  permissions: SectionPermissions | null | undefined,
  section: RegionSectionKey
): SectionAccessLevel | null {
  const level = permissions?.[section];
  return level === 'view' || level === 'manage' ? level : null;
}

/**
 * Whether a user can open a section. Admins/super admins always can. Regular
 * users keep their existing broad access (the regional manager is the only
 * role gated by the per-section permissions map).
 */
export function canAccessSection(
  userRole: UserRole | undefined | null,
  permissions: SectionPermissions | null | undefined,
  section: RegionSectionKey
): boolean {
  if (!userRole) return false;
  if (isAdmin(userRole)) return true;
  if (isRegionalManager(userRole)) return getSectionAccess(permissions, section) !== null;
  return userRole === ROLES.USER;
}

/**
 * Whether a user may mutate data inside a section. Admins can everywhere;
 * regional managers only where the admin granted `manage`; standard users use
 * the legacy admin-only checks.
 */
export function canManageSection(
  userRole: UserRole | undefined | null,
  permissions: SectionPermissions | null | undefined,
  section: RegionSectionKey
): boolean {
  if (!userRole) return false;
  if (isAdmin(userRole)) return true;
  if (isRegionalManager(userRole)) return getSectionAccess(permissions, section) === 'manage';
  return false;
}

/** Nav ids a user is allowed to see, or `null` meaning "no restriction". */
export function getAllowedSectionIds(
  userRole: UserRole | undefined | null,
  permissions: SectionPermissions | null | undefined
): string[] | null {
  if (!userRole || !isRegionalManager(userRole)) return null;
  return REGION_SECTION_IDS.filter((id) => getSectionAccess(permissions, id) !== null);
}

export function canManageUsers(userRole: UserRole | undefined | null): boolean {
  return isAdmin(userRole);
}

export function canManageAdmins(userRole: UserRole | undefined | null): boolean {
  return isSuperAdmin(userRole);
}

export function canChangeRole(
  actorRole: UserRole | undefined | null,
  targetRole: UserRole,
  newRole: UserRole
): boolean {
  if (!actorRole) return false;

  if (targetRole === ROLES.SUPER_ADMIN && !isSuperAdmin(actorRole)) {
    return false;
  }

  if (newRole === ROLES.SUPER_ADMIN && !isSuperAdmin(actorRole)) {
    return false;
  }

  return hasRole(actorRole, ROLES.ADMIN);
}

export function canDeleteUser(
  actorRole: UserRole | undefined | null,
  targetRole: UserRole
): boolean {
  if (!actorRole) return false;

  if (targetRole === ROLES.SUPER_ADMIN && !isSuperAdmin(actorRole)) {
    return false;
  }

  return isAdmin(actorRole);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  regional_manager: 'Regional Manager',
  user: 'User',
  unassigned: 'Pending Approval',
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value: value as UserRole,
  label,
}));

