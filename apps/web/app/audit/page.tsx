import { getCurrentClubContext } from "@stable/current-club-context";

import { AuditPanel, type AuditEventView } from "../../components/audit-panel";
import { ClubAdminShell } from "../../components/club-admin-shell";
import {
  AUDIT_PAGE_SIZE,
  actionsForFilters,
  melbourneDateStart,
  nextCalendarDate,
  parseAuditFilters,
  type SafeAuditAction,
} from "../../lib/audit-view";
import { loadLiveClubContext } from "../../lib/load-live-club-context";
import { createClubContextReader } from "../../lib/reader";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { principalFromSupabase } from "../../lib/principal";

export const dynamic = "force-dynamic";

type AuditPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const READ_FAILED = "Audit history could not be loaded. Refresh and try again.";

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const filters = parseAuditFilters(await searchParams);
  const presentation = await loadLiveClubContext();
  if (presentation.status !== "member") {
    return <ClubAdminShell presentation={presentation} />;
  }

  if (!presentation.capabilities.includes("audit.read")) {
    return (
      <ClubAdminShell presentation={presentation}>
        <p role="alert">Operational audit is available to Club Admins.</p>
        <a href="/">Open Home</a>
      </ClubAdminShell>
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const principal = await principalFromSupabase(supabase);
    const reader = await createClubContextReader(supabase);
    const context = await getCurrentClubContext({ principal, reader });
    if (context.club === null || !context.capabilities.includes("audit.read")) {
      return (
        <ClubAdminShell presentation={presentation}>
          <p role="alert">Operational audit is available to Club Admins.</p>
          <a href="/">Open Home</a>
        </ClubAdminShell>
      );
    }

    const from =
      filters.from === null ? null : melbourneDateStart(filters.from);
    const endDate = filters.to === null ? null : nextCalendarDate(filters.to);
    const before = endDate === null ? null : melbourneDateStart(endDate);
    const actions = actionsForFilters(filters);
    const start = (filters.page - 1) * AUDIT_PAGE_SIZE;
    let query = supabase
      .from("audit_events")
      .select("id, action, actor_user_id, target_id, created_at")
      .eq("club_id", context.club.id)
      .in("action", [...actions]);
    if (from !== null) query = query.gte("created_at", from);
    if (before !== null) query = query.lt("created_at", before);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + AUDIT_PAGE_SIZE);
    if (error !== null || data === null) {
      return auditFailure(presentation);
    }

    const rows = data.map((row) => ({
      id: row.id,
      action: row.action as SafeAuditAction,
      actorUserId: row.actor_user_id,
      targetId: row.target_id,
      createdAt: row.created_at,
    })) satisfies AuditEventView[];
    const events = rows.slice(0, AUDIT_PAGE_SIZE);

    return (
      <ClubAdminShell presentation={presentation}>
        <AuditPanel
          events={events}
          category={filters.category}
          action={filters.action}
          from={filters.from}
          to={filters.to}
          page={filters.page}
          hasNext={rows.length > AUDIT_PAGE_SIZE}
        />
      </ClubAdminShell>
    );
  } catch {
    return auditFailure(presentation);
  }
}

function auditFailure(
  presentation: Extract<
    Awaited<ReturnType<typeof loadLiveClubContext>>,
    { status: "member" }
  >,
) {
  return (
    <ClubAdminShell presentation={presentation}>
      <p role="alert">{READ_FAILED}</p>
      <a href="/">Return to Home</a>
    </ClubAdminShell>
  );
}
