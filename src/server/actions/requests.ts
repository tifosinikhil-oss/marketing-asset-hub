"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { briefSchema, NEXT_STATUSES } from "@/lib/validators/brief";
import { inngest } from "@/inngest/client";
import { RequestStatus } from "@prisma/client";

export async function createRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  assertCan(session.user.role, "request:create");

  const raw = {
    title: formData.get("title"),
    contentType: formData.get("contentType"),
    brandId: formData.get("brandId") || null,
    priority: formData.get("priority") || "MEDIUM",
    deadline: formData.get("deadline") || null,
    channels: formData.getAll("channels"),
    brief: {
      targetAudience: formData.get("targetAudience"),
      keyMessages: (formData.get("keyMessages") as string | null)?.split("\n").filter(Boolean) ?? [],
      callToAction: formData.get("callToAction") ?? "",
      brandVoice: formData.get("brandVoice") ?? "",
      successMetrics: (formData.get("successMetrics") as string | null)?.split("\n").filter(Boolean) ?? [],
      notes: formData.get("notes") ?? "",
      references: [],
      openQuestions: [],
    },
  };

  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const created = await prisma.request.create({
    data: {
      orgId: session.user.orgId,
      brandId: data.brandId ?? null,
      title: data.title,
      contentType: data.contentType,
      priority: data.priority,
      deadline: data.deadline ?? null,
      channels: data.channels,
      brief: data.brief,
      requesterId: session.user.id,
      status: "SUBMITTED",
    },
  });

  await prisma.activityEvent.create({
    data: {
      orgId: session.user.orgId,
      requestId: created.id,
      actorId: session.user.id,
      type: "REQUEST_SUBMITTED",
      payload: { title: created.title },
    },
  });

  await inngest.send({
    name: "request/submitted",
    data: { requestId: created.id, orgId: session.user.orgId },
  });

  redirect(`/requests/${created.id}`);
}

export async function transitionStatus(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  assertCan(session.user.role, "request:transition");

  const requestId = formData.get("requestId") as string;
  const newStatus = formData.get("status") as RequestStatus;

  const current = await prisma.request.findUnique({
    where: { id: requestId, orgId: session.user.orgId },
    select: { status: true },
  });
  if (!current) throw new Error("Not found");

  const allowed = NEXT_STATUSES[current.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move from ${current.status} to ${newStatus}`);
  }

  await prisma.$transaction([
    prisma.request.update({
      where: { id: requestId },
      data: { status: newStatus },
    }),
    prisma.activityEvent.create({
      data: {
        orgId: session.user.orgId,
        requestId,
        actorId: session.user.id,
        type: "STATUS_CHANGED",
        payload: { from: current.status, to: newStatus },
      },
    }),
  ]);

  await inngest.send({
    name: "request/status-changed",
    data: {
      requestId,
      orgId: session.user.orgId,
      previousStatus: current.status,
      newStatus,
      actorId: session.user.id,
    },
  });

  revalidatePath(`/requests/${requestId}`);
}

export async function addComment(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const requestId = formData.get("requestId") as string;
  const body = (formData.get("body") as string).trim();
  if (!body) return;

  await prisma.comment.create({
    data: {
      orgId: session.user.orgId,
      requestId,
      authorId: session.user.id,
      body,
    },
  });

  await prisma.activityEvent.create({
    data: {
      orgId: session.user.orgId,
      requestId,
      actorId: session.user.id,
      type: "COMMENT",
      payload: { snippet: body.slice(0, 120) },
    },
  });

  revalidatePath(`/requests/${requestId}`);
}
