import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { presignPut, objectKeyFor } from "@/lib/storage/r2";
import { z } from "zod";

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  requestId: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!process.env.R2_ACCOUNT_ID) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  const key = objectKeyFor(session.user.orgId, parsed.data.requestId ?? null, parsed.data.filename);
  const url = await presignPut(key, parsed.data.contentType);

  return NextResponse.json({ url, key });
}
