import type { CloudPermission, OrganizationRole } from "./types.js";

export const permissionsByRole: Readonly<
  Record<OrganizationRole, readonly CloudPermission[]>
> = {
  owner: [
    "organization:manage",
    "member:manage",
    "billing:manage",
    "project:create",
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read",
    "connector:manage"
  ],
  admin: [
    "member:manage",
    "project:create",
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read",
    "connector:manage"
  ],
  developer: [
    "project:read",
    "project:update",
    "environment:create",
    "environment:read",
    "crawl:create",
    "diagnostic:read",
    "diagnostic:write",
    "report:read"
  ],
  analyst: [
    "project:read",
    "environment:read",
    "diagnostic:read",
    "report:read"
  ],
  client: ["project:read", "report:read"]
};

export function roleHasPermission(
  role: OrganizationRole,
  permission: CloudPermission
): boolean {
  return permissionsByRole[role].includes(permission);
}
