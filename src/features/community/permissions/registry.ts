import catalog from "./catalog.json";

export interface PermissionDefinition {
  key: string;
  flag: string;
  label: string;
  desc: string;
  group: string;
  resources: string[];
  status: string;
  overwrite: boolean;
  dependencies: string[];
  dangerous: boolean;
  channelLabel?: string;
  channelDesc?: string;
  channelGroup?: string;
}

export const PERMISSIONS: readonly PermissionDefinition[] = catalog;
export const PERMISSION_GROUPS = [...new Set(PERMISSIONS.map(p => p.group))].map(category => ({
  category, permissions: PERMISSIONS.filter(p => p.group === category),
}));

export function matchesPermission(permission: PermissionDefinition, search: string) {
  const query = search.trim().toLowerCase();
  return `${permission.label} ${permission.desc} ${permission.group} ${permission.flag}`.toLowerCase().includes(query);
}

export function channelPermissions(kind: string) {
  return PERMISSIONS.filter(p => p.overwrite && p.resources.includes(kind)).map(p => ({
    ...p, label: p.channelLabel ?? p.label, desc: p.channelDesc ?? p.desc, group: p.channelGroup ?? p.group,
  }));
}

export function permissionAvailability(permission: PermissionDefinition) {
  return permission.status === "enforced" ? null : permission.status === "foundation"
    ? "Not available yet — authorization foundation only."
    : "Not available yet — the corresponding feature is not implemented.";
}
