import { UserRole } from "@prisma/client";

export type Permission =
  | "request:create"
  | "request:read"
  | "request:update"
  | "request:transition"
  | "request:approve"
  | "request:assign"
  | "request:archive"
  | "task:create"
  | "task:update"
  | "task:logTime"
  | "draft:write"
  | "draft:review"
  | "file:upload"
  | "file:delete"
  | "asset:publish"
  | "asset:read"
  | "template:create"
  | "template:share"
  | "admin:manage_users"
  | "admin:manage_brands"
  | "admin:manage_workflow"
  | "admin:view_audit"
  | "admin:manage_integrations";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "request:create",
    "request:read",
    "request:update",
    "request:transition",
    "request:approve",
    "request:assign",
    "request:archive",
    "task:create",
    "task:update",
    "task:logTime",
    "draft:write",
    "draft:review",
    "file:upload",
    "file:delete",
    "asset:publish",
    "asset:read",
    "template:create",
    "template:share",
    "admin:manage_users",
    "admin:manage_brands",
    "admin:manage_workflow",
    "admin:view_audit",
    "admin:manage_integrations",
  ],
  MANAGER: [
    "request:create",
    "request:read",
    "request:update",
    "request:transition",
    "request:approve",
    "request:assign",
    "request:archive",
    "task:create",
    "task:update",
    "draft:write",
    "draft:review",
    "file:upload",
    "file:delete",
    "asset:publish",
    "asset:read",
    "template:create",
    "template:share",
    "admin:view_audit",
  ],
  PRODUCER: [
    "request:create",
    "request:read",
    "request:update",
    "request:transition",
    "task:create",
    "task:update",
    "task:logTime",
    "draft:write",
    "draft:review",
    "file:upload",
    "asset:publish",
    "asset:read",
    "template:create",
  ],
  REVIEWER: [
    "request:read",
    "task:update",
    "draft:review",
    "file:upload",
    "asset:read",
  ],
  REQUESTER: [
    "request:create",
    "request:read",
    "asset:read",
  ],
  FREELANCER: [
    "request:read",
    "task:update",
    "task:logTime",
    "draft:write",
    "file:upload",
    "asset:read",
  ],
  VIEWER: ["request:read", "asset:read"],
};

export function can(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function assertCan(role: UserRole, perm: Permission): void {
  if (!can(role, perm)) {
    throw new Error(`Forbidden: ${role} cannot ${perm}`);
  }
}
