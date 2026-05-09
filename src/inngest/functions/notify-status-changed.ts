import { inngest } from "../client";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email/graph";
import { renderRequestStatusEmail } from "@/lib/email/templates";
import { STATUS_LABELS } from "@/lib/validators/brief";

export const notifyStatusChanged = inngest.createFunction(
  { id: "notify-status-changed", retries: 3, triggers: [{ event: "request/status-changed" }] },
  async ({ event, step }) => {
    const { requestId, newStatus } = event.data;

    const request = await step.run("load-request", () =>
      prisma.request.findUnique({
        where: { id: requestId },
        include: { requester: true, assignee: true },
      }),
    );
    if (!request) return { skipped: "not found" };

    const recipients = [request.requester.email];
    if (request.assignee?.email && request.assignee.email !== request.requester.email) {
      recipients.push(request.assignee.email);
    }

    await step.run("send-email", () =>
      sendMail({
        to: recipients,
        subject: `[${STATUS_LABELS[newStatus] ?? newStatus}] ${request.title}`,
        htmlBody: renderRequestStatusEmail({
          appUrl: process.env.APP_URL ?? "http://localhost:3000",
          requestTitle: request.title,
          requesterName: request.requester.name ?? request.requester.email,
          contentType: request.contentType,
          requestId: request.id,
          status: STATUS_LABELS[newStatus] ?? newStatus,
        }),
      }),
    );

    await step.run("notify-in-app", () =>
      prisma.notification.create({
        data: {
          orgId: request.orgId,
          userId: request.requesterId,
          requestId: request.id,
          kind: "STATUS_CHANGED",
          title: `${request.title} → ${STATUS_LABELS[newStatus] ?? newStatus}`,
          channel: "IN_APP",
          sentAt: new Date(),
        },
      }),
    );

    return { sent: recipients.length };
  },
);
