import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "marketing-asset-hub",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  signingKeyFallback: process.env.INNGEST_SIGNING_KEY_FALLBACK,
});

export type RequestSubmittedEvent = {
  name: "request/submitted";
  data: { requestId: string; orgId: string };
};

export type RequestStatusChangedEvent = {
  name: "request/status-changed";
  data: { requestId: string; orgId: string; previousStatus: string; newStatus: string; actorId: string };
};
