import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";

let cachedClient: Client | null = null;

function getGraphClient(): Client {
  if (cachedClient) return cachedClient;

  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Microsoft Graph not configured");
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

  cachedClient = Client.init({
    authProvider: async (done) => {
      try {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        done(null, token?.token ?? "");
      } catch (err) {
        done(err as Error, null);
      }
    },
  });

  return cachedClient;
}

export interface SendMailArgs {
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export async function sendMail(args: SendMailArgs): Promise<void> {
  const sender = process.env.GRAPH_SENDER_UPN;
  if (!sender) throw new Error("GRAPH_SENDER_UPN not set");

  const client = getGraphClient();

  await client.api(`/users/${sender}/sendMail`).post({
    message: {
      subject: args.subject,
      body: { contentType: "HTML", content: args.htmlBody },
      toRecipients: args.to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: (args.cc ?? []).map((address) => ({ emailAddress: { address } })),
      replyTo: args.replyTo
        ? [{ emailAddress: { address: args.replyTo } }]
        : undefined,
    },
    saveToSentItems: true,
  });
}
