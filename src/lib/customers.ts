import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolving "who is this customer?" for guest checkout and the waiting list.
 *
 * Three cases, in order:
 *   1. Already signed in     -> use that account.
 *   2. Email matches nobody  -> create an account for them.
 *   3. Email matches someone -> refuse.
 *
 * Case 3 is the one that matters. Silently attaching a guest booking to an
 * existing account would let anyone read a stranger's appointment history by
 * booking with their email address, so it is an error the caller surfaces as
 * "please sign in" rather than something we work around.
 */

export type CustomerIdentity = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type ResolveResult =
  | { ok: true; profileId: string; createdAccount: boolean }
  | { ok: false; code: "account_exists" | "server_error"; message: string };

export async function resolveCustomer(
  identity: CustomerIdentity,
  signedInId: string | null,
): Promise<ResolveResult> {
  if (signedInId) {
    return { ok: true, profileId: signedInId, createdAccount: false };
  }

  const supabase = createAdminClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", identity.email)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingProfile) {
    return {
      ok: false,
      code: "account_exists",
      message:
        "An account already uses that email address. Please sign in to continue.",
    };
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: identity.email,
    email_confirm: false,
    user_metadata: {
      first_name: identity.firstName,
      last_name: identity.lastName,
      phone: identity.phone,
    },
  });

  if (error || !created.user) {
    console.error("[customers] account creation failed", error?.message);
    return {
      ok: false,
      code: "server_error",
      message: "We could not set up your account. Please try again.",
    };
  }

  return { ok: true, profileId: created.user.id, createdAccount: true };
}
