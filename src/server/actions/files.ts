"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { deleteObject } from "@/lib/storage/r2";
import { FileKind } from "@prisma/client";

export async function recordUploadedFile(args: {
  requestId: string;
  filename: string;
  r2Key: string;
  mimeType: string;
  size: number;
  kind?: FileKind;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  assertCan(session.user.role, "file:upload");

  const request = await prisma.request.findFirst({
    where: { id: args.requestId, orgId: session.user.orgId },
    select: { id: true },
  });
  if (!request) throw new Error("Request not found");

  if (!args.r2Key.startsWith(`org/${session.user.orgId}/`)) {
    throw new Error("Invalid object key");
  }

  const file = await prisma.file.create({
    data: {
      orgId: session.user.orgId,
      requestId: args.requestId,
      uploaderId: session.user.id,
      filename: args.filename,
      r2Key: args.r2Key,
      mimeType: args.mimeType,
      size: args.size,
      kind: args.kind ?? "REFERENCE",
    },
  });

  await prisma.activityEvent.create({
    data: {
      orgId: session.user.orgId,
      requestId: args.requestId,
      actorId: session.user.id,
      type: "FILE_ADDED",
      payload: { filename: args.filename, kind: file.kind },
    },
  });

  revalidatePath(`/requests/${args.requestId}`);
  return { id: file.id };
}

export async function deleteFile(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  assertCan(session.user.role, "file:delete");

  const fileId = formData.get("fileId") as string;
  const file = await prisma.file.findFirst({
    where: { id: fileId, orgId: session.user.orgId },
    select: { id: true, r2Key: true, requestId: true, filename: true },
  });
  if (!file) throw new Error("Not found");

  await deleteObject(file.r2Key).catch(() => null);
  await prisma.file.delete({ where: { id: file.id } });

  if (file.requestId) {
    await prisma.activityEvent.create({
      data: {
        orgId: session.user.orgId,
        requestId: file.requestId,
        actorId: session.user.id,
        type: "FILE_REMOVED",
        payload: { filename: file.filename },
      },
    });
    revalidatePath(`/requests/${file.requestId}`);
  }
}
