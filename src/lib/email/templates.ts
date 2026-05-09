interface RequestEmailContext {
  appUrl: string;
  requestTitle: string;
  requesterName: string;
  contentType: string;
  brand?: string | null;
  requestId: string;
  status?: string;
  comment?: string;
}

const wrap = (innerHtml: string) => `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;padding:24px;color:#111">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:24px">
${innerHtml}
<p style="font-size:12px;color:#737373;margin-top:32px">Marketing Asset Hub · Internal use only</p>
</div></body></html>`;

export function renderRequestSubmittedEmail(ctx: RequestEmailContext) {
  return wrap(`
    <h2 style="margin:0 0 12px">New brief: ${escape(ctx.requestTitle)}</h2>
    <p>${escape(ctx.requesterName)} submitted a new ${escape(ctx.contentType.toLowerCase())} request${ctx.brand ? ` for <strong>${escape(ctx.brand)}</strong>` : ""}.</p>
    <p style="margin:16px 0">
      <a href="${ctx.appUrl}/requests/${ctx.requestId}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open request</a>
    </p>
  `);
}

export function renderRequestStatusEmail(ctx: RequestEmailContext) {
  return wrap(`
    <h2 style="margin:0 0 12px">${escape(ctx.requestTitle)}</h2>
    <p>The status was updated to <strong>${escape(ctx.status ?? "")}</strong>.</p>
    ${ctx.comment ? `<blockquote style="border-left:3px solid #e5e5e5;margin:0;padding:8px 12px;color:#404040">${escape(ctx.comment)}</blockquote>` : ""}
    <p style="margin:16px 0">
      <a href="${ctx.appUrl}/requests/${ctx.requestId}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View request</a>
    </p>
  `);
}

function escape(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
