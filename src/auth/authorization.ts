export type UserRole = 'admin' | 'porteiro';
export type Capability = 'view' | 'operate' | 'manage_catalog' | 'manage_people' | 'delete_records' | 'request_inspection' | 'complete_inspection';
export interface AppProfile {
  user_id: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
}

export function parseProfile(value: unknown): AppProfile | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.user_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.user_id) ||
    typeof item.display_name !== 'string' || !['admin', 'porteiro'].includes(String(item.role)) ||
    typeof item.is_active !== 'boolean') return null;
  return item as unknown as AppProfile;
}

export function can(profile: AppProfile | null | undefined, capability: Capability): boolean {
  if (!profile?.is_active) return false;
  if (profile.role === 'admin') return true;
  return profile.role === 'porteiro' && ['view', 'operate', 'complete_inspection'].includes(capability);
}
