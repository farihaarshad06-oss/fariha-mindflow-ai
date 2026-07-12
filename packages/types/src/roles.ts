export const ROLES = [
  'STUDENT',
  'PROFESSIONAL',
  'UNIVERSITY_ADMIN',
  'SUPPORT',
  'CONTENT_MODERATOR',
  'PLATFORM_ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Student',
  PROFESSIONAL: 'Professional',
  UNIVERSITY_ADMIN: 'University Admin',
  SUPPORT: 'Support',
  CONTENT_MODERATOR: 'Content Moderator',
  PLATFORM_ADMIN: 'Platform Admin',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
