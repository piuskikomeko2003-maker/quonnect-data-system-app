export type UserRole = 'super_admin' | 'admin' | 'user' | 'unassigned';

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string | null;
}

export const ROLES = {
  SUPER_ADMIN: 'super_admin' as const,
  ADMIN: 'admin' as const,
  USER: 'user' as const,
  UNASSIGNED: 'unassigned' as const,
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 3,
  admin: 2,
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
  user: 'User',
  unassigned: 'Pending Approval',
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value: value as UserRole,
  label,
}));

