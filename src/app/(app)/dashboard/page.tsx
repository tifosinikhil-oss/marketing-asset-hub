import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/validators/brief";
import { relativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId = session.user.orgId;

  const [myRequests, recentActivity, kpis] = await Promise.all([
    prisma.request.findMany({
      where: {
        orgId,
        OR: [{ requesterId: session.user.id }, { assigneeId: session.user.id }],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { brand: true, requester: true, assignee: true },
    }),
    prisma.activityEvent.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: true, request: true },
    }),
    Promise.all([
      prisma.request.count({ where: { orgId, status: { notIn: ["PUBLISHED", "ARCHIVED", "REJECTED"] } } }),
      prisma.request.count({ where: { orgId, status: "REVIEW" } }),
      prisma.request.count({ where: { orgId, status: "PUBLISHED" } }),
      prisma.asset.count({ where: { orgId } }),
    ]),
  ]);

  const [active, inReview, published, assets] = kpis;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">Your queue and the team&apos;s recent activity.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Kpi label="Active requests" value={active} />
        <Kpi label="In review" value={inReview} />
        <Kpi label="Published" value={published} />
        <Kpi label="Assets in repo" value={assets} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Your queue</CardTitle>
            <CardDescription>Requests you submitted or are assigned to.</CardDescription>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <Empty
                title="Nothing in your queue"
                cta="Submit your first brief"
                href="/requests/new"
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {myRequests.map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/requests/${r.id}`} className="font-medium hover:underline truncate block">
                        {r.title}
                      </Link>
                      <div className="text-xs text-[var(--color-muted-foreground)] truncate">
                        {r.brand?.name ?? "No brand"} · {r.requester.name ?? r.requester.email} ·{" "}
                        {relativeTime(r.updatedAt)}
                      </div>
                    </div>
                    <Badge variant="secondary">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Across the organization.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <Empty title="No activity yet" />
            ) : (
              <ul className="space-y-3 text-sm">
                {recentActivity.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <div className="size-1.5 rounded-full bg-[var(--color-primary)] mt-2 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">{a.actor.name ?? a.actor.email}</span>{" "}
                      <span className="text-[var(--color-muted-foreground)]">{a.type.toLowerCase().replace(/_/g, " ")}</span>{" "}
                      <Link href={`/requests/${a.requestId}`} className="hover:underline">
                        {a.request.title}
                      </Link>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{relativeTime(a.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">{label}</div>
        <div className="text-3xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ title, cta, href }: { title: string; cta?: string; href?: string }) {
  return (
    <div className="text-center py-8 text-sm text-[var(--color-muted-foreground)]">
      <div>{title}</div>
      {cta && href && (
        <Link href={href} className="mt-3 inline-block text-[var(--color-primary)] hover:underline">
          {cta} →
        </Link>
      )}
    </div>
  );
}
