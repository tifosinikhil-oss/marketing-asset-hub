import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TYPE_LABELS, NEXT_STATUSES, STATUS_LABELS } from "@/lib/validators/brief";
import { formatDate, relativeTime } from "@/lib/utils";
import { transitionStatus, addComment } from "@/server/actions/requests";
import { deleteFile } from "@/server/actions/files";
import { can } from "@/lib/rbac";
import { FileUploader } from "@/components/file-uploader";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const request = await prisma.request.findFirst({
    where: { id, orgId: session.user.orgId },
    include: {
      brand: true,
      requester: true,
      assignee: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      activityEvents: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 30 },
      tasks: { include: { assignee: true }, orderBy: { order: "asc" } },
      files: { include: { uploader: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!request) notFound();

  const topLevelTasks = request.tasks.filter((t) => !t.parentTaskId);
  const subtaskByParent = new Map<string, typeof request.tasks>();
  for (const t of request.tasks) {
    if (t.parentTaskId) {
      const list = subtaskByParent.get(t.parentTaskId) ?? [];
      list.push(t);
      subtaskByParent.set(t.parentTaskId, list);
    }
  }

  const brief = (request.brief ?? {}) as {
    targetAudience?: string;
    keyMessages?: string[];
    callToAction?: string;
    brandVoice?: string;
    successMetrics?: string[];
    notes?: string;
  };

  const allowedTransitions = NEXT_STATUSES[request.status] ?? [];
  const canTransition = can(session.user.role, "request:transition");

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="text-xs text-[var(--color-muted-foreground)] mb-1">
            {request.brand?.name ?? "No brand"} · {CONTENT_TYPE_LABELS[request.contentType] ?? request.contentType}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
          <div className="text-sm text-[var(--color-muted-foreground)] mt-1">
            Requested by {request.requester.name ?? request.requester.email} · {relativeTime(request.createdAt)}
            {request.deadline && <> · Due {formatDate(request.deadline)}</>}
          </div>
        </div>
        <Badge variant="secondary" className="text-sm">{STATUS_LABELS[request.status] ?? request.status}</Badge>
      </header>

      {canTransition && allowedTransitions.length > 0 && (
        <Card>
          <CardContent className="py-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-[var(--color-muted-foreground)] mr-2">Move to:</span>
            {allowedTransitions.map((status) => (
              <form key={status} action={transitionStatus}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="status" value={status} />
                <Button type="submit" variant="outline" size="sm">
                  {STATUS_LABELS[status] ?? status}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Brief</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Section label="Target audience" body={brief.targetAudience} />
              {brief.keyMessages?.length ? (
                <div>
                  <h4 className="font-medium mb-1">Key messages</h4>
                  <ul className="list-disc pl-5 space-y-1 text-[var(--color-foreground)]">
                    {brief.keyMessages.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              ) : null}
              <Section label="Call to action" body={brief.callToAction} />
              <Section label="Brand voice" body={brief.brandVoice} />
              {brief.successMetrics?.length ? (
                <div>
                  <h4 className="font-medium mb-1">Success metrics</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {brief.successMetrics.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              ) : null}
              <Section label="Notes" body={brief.notes} />
              {request.channels.length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Channels</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {request.channels.map((c) => (
                      <Badge key={c} variant="outline">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tasks</CardTitle>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {request.tasks.filter((t) => t.status === "DONE").length}/{request.tasks.length} done
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {topLevelTasks.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  AI is generating a work breakdown… refresh in a moment.
                </p>
              ) : (
                <ol className="space-y-3">
                  {topLevelTasks.map((t) => {
                    const subs = subtaskByParent.get(t.id) ?? [];
                    return (
                      <li key={t.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{t.title}</div>
                            {t.description && (
                              <div className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{t.description}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">{t.status}</Badge>
                        </div>
                        {subs.length > 0 && (
                          <ul className="mt-2 ml-4 space-y-1.5 border-l border-[var(--color-border)] pl-3">
                            {subs.map((s) => (
                              <li key={s.id} className="text-xs flex items-start justify-between gap-2">
                                <span>{s.title}</span>
                                <Badge variant="outline" className="shrink-0">{s.status}</Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Files</CardTitle>
                {can(session.user.role, "file:upload") && (
                  <FileUploader requestId={request.id} kind="REFERENCE" label="Add file" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {request.files.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No files yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {request.files.map((f) => (
                    <li key={f.id} className="py-2 flex items-center gap-3">
                      <FileText className="size-4 text-[var(--color-muted-foreground)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{f.filename}</div>
                        <div className="text-xs text-[var(--color-muted-foreground)]">
                          {f.kind.toLowerCase()} · {(f.size / 1024).toFixed(0)} KB · uploaded by{" "}
                          {f.uploader.name ?? f.uploader.email} · {relativeTime(f.createdAt)}
                        </div>
                      </div>
                      {can(session.user.role, "file:delete") && (
                        <form action={deleteFile}>
                          <input type="hidden" name="fileId" value={f.id} />
                          <button
                            type="submit"
                            className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {request.comments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No comments yet.</p>
              ) : (
                <ul className="space-y-3">
                  {request.comments.map((c) => (
                    <li key={c.id} className="text-sm">
                      <div className="font-medium">{c.author.name ?? c.author.email}</div>
                      <div className="text-xs text-[var(--color-muted-foreground)] mb-1">{relativeTime(c.createdAt)}</div>
                      <div className="whitespace-pre-wrap">{c.body}</div>
                    </li>
                  ))}
                </ul>
              )}
              <form action={addComment} className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <input type="hidden" name="requestId" value={request.id} />
                <Textarea name="body" placeholder="Add a comment…" rows={3} required />
                <div className="flex justify-end">
                  <Button type="submit" size="sm">Comment</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent>
              {request.activityEvents.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">No activity yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {request.activityEvents.map((a) => (
                    <li key={a.id}>
                      <div className="text-[var(--color-foreground)]">
                        <span className="font-medium">{a.actor.name ?? a.actor.email}</span>{" "}
                        <span className="text-[var(--color-muted-foreground)]">
                          {a.type.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-muted-foreground)]">{relativeTime(a.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Detail label="Status" value={STATUS_LABELS[request.status] ?? request.status} />
              <Detail label="Priority" value={request.priority} />
              <Detail label="Brand" value={request.brand?.name ?? "—"} />
              <Detail label="Type" value={CONTENT_TYPE_LABELS[request.contentType] ?? request.contentType} />
              <Detail label="Assignee" value={request.assignee?.name ?? request.assignee?.email ?? "—"} />
              <Detail label="Requester" value={request.requester.name ?? request.requester.email} />
              <Detail label="Created" value={formatDate(request.createdAt)} />
              <Detail label="Deadline" value={formatDate(request.deadline)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ label, body }: { label: string; body?: string }) {
  if (!body) return null;
  return (
    <div>
      <h4 className="font-medium mb-1">{label}</h4>
      <p className="whitespace-pre-wrap text-[var(--color-foreground)]">{body}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
