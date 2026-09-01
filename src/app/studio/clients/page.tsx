import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — clients",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireStaff("/studio/clients");
  const { q = "", page = "1" } = await searchParams;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const from = (pageNumber - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, no_show_count, created_at", {
      count: "exact",
    })
    .is("deleted_at", null)
    .order("last_name")
    .range(from, from + PAGE_SIZE - 1);

  if (q.trim()) {
    // Escape the PostgREST `or` separators so a comma or paren in the search
    // box cannot restructure the filter.
    const term = q.trim().replace(/[,()]/g, " ");
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data: clients, count } = await query;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Clients</h1>
          <p className="mt-1 text-[14px] text-muted">
            {total} {total === 1 ? "client" : "clients"}
          </p>
        </div>

        <form method="get" className="flex gap-2">
          <label htmlFor="client-search" className="sr-only">
            Search clients
          </label>
          <input
            id="client-search"
            name="q"
            defaultValue={q}
            placeholder="Name, email or phone"
            className="min-h-[44px] w-[260px] rounded-[4px] border border-line bg-white px-3.5 py-2.5 text-[14px]"
          />
          <button
            type="submit"
            className="min-h-[44px] cursor-pointer rounded-[4px] bg-ink px-5 text-[14px] text-sand hover:bg-ink-hover"
          >
            Search
          </button>
        </form>
      </div>

      {(clients ?? []).length === 0 ? (
        <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] text-muted">
          {q ? `No client matches “${q}”.` : "No clients yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-line">
          <table className="w-full min-w-[720px] text-[14px]">
            <caption className="sr-only">Clients</caption>
            <thead>
              <tr className="border-b border-line bg-sand text-left">
                <th className="px-4 py-3 font-medium text-muted">Name</th>
                <th className="px-4 py-3 font-medium text-muted">Email</th>
                <th className="px-4 py-3 font-medium text-muted">Phone</th>
                <th className="px-4 py-3 font-medium text-muted">Client since</th>
                <th className="px-4 py-3 font-medium text-muted">No-shows</th>
              </tr>
            </thead>
            <tbody>
              {(clients ?? []).map((client) => (
                <tr key={client.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/clients/${client.id}`}
                      className="underline underline-offset-2"
                    >
                      {`${client.first_name} ${client.last_name}`.trim() || "Unnamed"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{client.email}</td>
                  <td className="px-4 py-3 text-muted">{client.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatDateShort(client.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {client.no_show_count > 0 ? (
                      <span className="text-gold">{client.no_show_count}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center gap-3 text-[14px]">
          {pageNumber > 1 && (
            <Link
              href={`/studio/clients?q=${encodeURIComponent(q)}&page=${pageNumber - 1}`}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              ← Previous
            </Link>
          )}
          <span className="text-muted">
            Page {pageNumber} of {pages}
          </span>
          {pageNumber < pages && (
            <Link
              href={`/studio/clients?q=${encodeURIComponent(q)}&page=${pageNumber + 1}`}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
