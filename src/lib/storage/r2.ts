import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const r2 = accountId
  ? new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    })
  : null;

const BUCKET = process.env.R2_BUCKET ?? "marketing-asset-hub";

export async function presignPut(key: string, contentType: string, expiresIn = 60 * 10) {
  if (!r2) throw new Error("R2 not configured");
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function presignGet(key: string, expiresIn = 60 * 10) {
  if (!r2) throw new Error("R2 not configured");
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function deleteObject(key: string) {
  if (!r2) throw new Error("R2 not configured");
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function objectKeyFor(orgId: string, requestId: string | null, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stamp = Date.now();
  return requestId
    ? `org/${orgId}/req/${requestId}/${stamp}-${safe}`
    : `org/${orgId}/uploads/${stamp}-${safe}`;
}
