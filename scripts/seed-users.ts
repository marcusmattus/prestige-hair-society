/**
 * Create the staff logins on a real Supabase project.
 *
 * supabase/local/04_demo_data.sql inserts into auth.users directly, which is
 * fine against a local shim but wrong against Supabase: auth.users carries
 * identity and credential columns that only the Auth API populates correctly.
 * This does it properly.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/seed-users.ts
 *
 * Idempotent: an address that already has an account is left alone, and only
 * its roles are reconciled. Passwords are never printed to a shared terminal --
 * each account is created without one and invited to set their own.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this.",
  );
  process.exit(1);
}

type Role = Database["public"]["Enums"]["user_role"];

/**
 * Edit this list before running. These are the people who will be able to sign
 * in to /studio; everything else follows from their roles.
 */
const STAFF: {
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  /** Matches a staff.slug, to link the login to a bookable stylist. */
  staffSlug?: string;
}[] = [
  {
    email: "owner@prestigehairsociety.example",
    firstName: "Salon",
    lastName: "Owner",
    roles: ["admin", "manager"],
  },
  {
    email: "reception@prestigehairsociety.example",
    firstName: "Front",
    lastName: "Desk",
    roles: ["receptionist"],
  },
];

async function main() {
  const supabase = createClient<Database>(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const person of STAFF) {
    let userId: string | null = null;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", person.email)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
      console.log(`· ${person.email} already exists`);
    } else {
      // No password: they set one from the invite, so nothing secret is ever
      // written to a log or a terminal history.
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(person.email, {
        data: { first_name: person.firstName, last_name: person.lastName },
      });

      if (error || !data.user) {
        console.error(`✗ ${person.email}: ${error?.message ?? "no user returned"}`);
        continue;
      }

      userId = data.user.id;
      console.log(`✓ ${person.email} invited`);
    }

    if (!userId) continue;

    // handle_new_user() has already granted 'customer'; add the staff roles.
    for (const role of person.roles) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

      if (error) console.error(`  ✗ role ${role}: ${error.message}`);
      else console.log(`  · role ${role}`);
    }

    if (person.staffSlug) {
      const { error } = await supabase
        .from("staff")
        .update({ profile_id: userId })
        .eq("slug", person.staffSlug);

      if (error) console.error(`  ✗ link to ${person.staffSlug}: ${error.message}`);
      else console.log(`  · linked to stylist ${person.staffSlug}`);
    }
  }

  console.log(
    "\nDone. Each person sets their own password from the invitation email.\n" +
      "Verify with: select p.email, r.role from profiles p join user_roles r on r.user_id = p.id;",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
