import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/types";

export type UserRole = Enums<"user_role">;

/** Roles that may open /studio at all. */
export const STAFF_ROLES: UserRole[] = ["stylist", "receptionist", "manager", "admin"];
/** Roles that may run the front desk. */
export const DESK_ROLES: UserRole[] = ["receptionist", "manager", "admin"];
/** Roles that may see money and change staff. */
export const MANAGER_ROLES: UserRole[] = ["manager", "admin"];

export type SessionUser = {
  id: string;
  email: string;
  profile: Tables<"profiles">;
  roles: UserRole[];
  staffId: string | null;
};

/**
 * The signed-in user with roles resolved, or null.
 *
 * Uses getUser(), not getSession(): getSession() trusts the cookie, getUser()
 * validates the token with Supabase. Never authorise on getSession().
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const [{ data: profile }, { data: roleRows }, { data: staffRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("staff").select("id").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile,
    roles: (roleRows ?? []).map((r) => r.role),
    staffId: staffRow?.id ?? null,
  };
}

export function hasRole(user: SessionUser | null, roles: UserRole[]): boolean {
  return !!user && user.roles.some((r) => roles.includes(r));
}

export const isStaff = (user: SessionUser | null) => hasRole(user, STAFF_ROLES);
export const isDesk = (user: SessionUser | null) => hasRole(user, DESK_ROLES);
export const isManager = (user: SessionUser | null) => hasRole(user, MANAGER_ROLES);
export const isAdmin = (user: SessionUser | null) => hasRole(user, ["admin"]);

// ---------------------------------------------------------------------------
// Guards. These are the server-side half of access control; RLS is the other
// half, and neither is trusted to be the only one.
// ---------------------------------------------------------------------------

/** Require any signed-in user, or bounce to sign-in with a return path. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/sign-in${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
}

/** Require one of `roles`. A signed-in customer hitting /studio gets a 404. */
export async function requireRole(
  roles: UserRole[],
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!hasRole(user, roles)) {
    // Deliberately not a 403: staff routes should not confirm they exist.
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export const requireStaff = (returnTo?: string) => requireRole(STAFF_ROLES, returnTo);
export const requireDesk = (returnTo?: string) => requireRole(DESK_ROLES, returnTo);
export const requireManager = (returnTo?: string) => requireRole(MANAGER_ROLES, returnTo);
export const requireAdmin = (returnTo?: string) => requireRole(["admin"], returnTo);
