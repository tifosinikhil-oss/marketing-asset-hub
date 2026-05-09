import { inngest } from "../client";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email/graph";
import { renderRequestSubmittedEmail } from "@/lib/email/templates";
import { CONTENT_TYPE_LABELS } from "@/lib/validators/brief";

export const notifyRequestSubmitted = inngest.createFunction(
  { id: "notify-request-submitted", retries: 3, triggers: [{ event: "request/submitted" }] },
  async ({ event, step }) => {
    const { requestId } = event.data;

    const request = await step.run("load-request", () =>
      prisma.request.findUnique({
        where: { id: requestId },
        include: { requester: true, brand: true, org: true },
      }),
    );
    if (!request) return { skipped: "request not found" };

    const recipients = await step.run("resolve-recipients", () =>
      prisma.user.findMany({
        where: {
          orgId: request.orgId,
          role: { in: ["MANAGER", "PRODUCER"] },
        },
        select: { id: true, email: true },
      }),
    );

    if (recipients.length === 0) return { skipped: "no recipients" };

    await step.run("send-email", async () => {
      await sendMail({
        to: recipients.map((r) => r.email),
        subject: `New brief: ${request.title}`,
        htmlBody: renderRequestSubmittedEmail({
          appUrl: process.env.APP_URL ?? "http://localhost:3000",
          requestTitle: request.title,
          requesterName: request.requester.name ?? request.requester.email,
          contentType: CONTENT_TYPE_LABELS[request.contentType] ?? request.contentType,
          brand: request.brand?.name,
          requestId: request.id,
        }),
      });
    });

    await step.run("write-notifications", () =>
      prisma.notification.createMany({
        data: recipients.map((r) => ({
          orgId: request.orgId,
          userId: r.id,
          requestId: request.id,
          kind: "REQUEST_SUBMITTED",
          title: `New brief: ${request.title}`,
          channel: "IN_APP" as const,
          sentAt: new Date(),
        })),
        skipDuplicates: true,
      }),
    );

    return { sent: recipients.length };
  },
);
