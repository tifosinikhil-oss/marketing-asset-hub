import { inngest } from "../client";
import { prisma } from "@/lib/db";
import { generateWbs } from "@/lib/ai/anthropic";

export const generateWbsOnSubmit = inngest.createFunction(
  {
    id: "generate-wbs-on-submit",
    retries: 2,
    triggers: [{ event: "request/submitted" }],
  },
  async ({ event, step }) => {
    const { requestId } = event.data;

    if (!process.env.ANTHROPIC_API_KEY) {
      return { skipped: "ANTHROPIC_API_KEY not set" };
    }

    const request = await step.run("load", () =>
      prisma.request.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          orgId: true,
          title: true,
          contentType: true,
          brief: true,
          channels: true,
          requesterId: true,
        },
      }),
    );
    if (!request) return { skipped: "request not found" };

    const existing = await step.run("count-tasks", () =>
      prisma.task.count({ where: { requestId } }),
    );
    if (existing > 0) return { skipped: "tasks already exist" };

    const tasks = await step.run("ai-generate", async () => {
      try {
        return await generateWbs({
          title: request.title,
          contentType: request.contentType,
          channels: request.channels,
          brief: request.brief,
        });
      } catch (err) {
        console.error("WBS generation failed", err);
        return [];
      }
    });

    if (!tasks.length) return { skipped: "AI returned no tasks" };

    await step.run("write-tasks", async () => {
      let order = 0;
      for (const t of tasks) {
        const parent = await prisma.task.create({
          data: {
            orgId: request.orgId,
            requestId,
            title: t.title,
            description: t.description ?? null,
            order: order++,
            status: "TODO",
          },
        });
        let subOrder = 0;
        for (const s of t.subtasks ?? []) {
          await prisma.task.create({
            data: {
              orgId: request.orgId,
              requestId,
              parentTaskId: parent.id,
              title: s.title,
              description: s.description ?? null,
              order: subOrder++,
              status: "TODO",
            },
          });
        }
      }
    });

    await step.run("activity", () =>
      prisma.activityEvent.create({
        data: {
          orgId: request.orgId,
          requestId,
          actorId: request.requesterId,
          type: "WBS_GENERATED",
          payload: { count: tasks.length, source: "ai" },
        },
      }),
    );

    return { tasksCreated: tasks.length };
  },
);
