import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS_LABELS, CONTENT_TYPE_LABELS } from "@/lib/validators/brief";
import { formatDate, relativeTime } from "@/lib/utils";

export default async function RequestsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const requests = await prisma.request.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { brand: true, requester: true, assignee: true },
  });

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">All active and recent briefs.</p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex items-center gap-2 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90"
        >
          + New brief
        </Link>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="text-sm text-[var(--color-muted-foreground)]">No requests yet.</div>
            <Link
              href="/requests/new"
              className="mt-4 inline-block text-sm text-[var(--color-primary)] hover:underline"
            >
              Submit the first one →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="py-3 px-4 font-medium">Title</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Brand</th>
                  <th className="py-3 px-4 font-medium">Requester</th>
                  <th className="py-3 px-4 font-medium">Deadline</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-muted)]/40">
                    <td className="py-3 px-4">
                      <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-muted-foreground)]">
                      {CONTENT_TYPE_LABELS[r.contentType] ?? r.contentType}
                    </td>
                    <td className="py-3 px-4">{r.brand?.name ?? "—"}</td>
                    <td className="py-3 px-4">{r.requester.name ?? r.requester.email}</td>
                    <td className="py-3 px-4">{formatDate(r.deadline)}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-[var(--color-muted-foreground)]">{relativeTime(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
