import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string;
      role: UserRole;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}

const DEV_AUTH = process.env.DEV_AUTH === "true";

async function ensureOrgIdForNewUser(email: string): Promise<string> {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const slug = domain ? domain.replace(/[^a-z0-9]+/g, "-").slice(0, 40) : "default";

  const existing = await prisma.organization.findFirst({
    where: { OR: [{ slug }, ...(slug !== "default" ? [{ slug: "default" }] : [])] },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;

  const created = await prisma.organization.create({
    data: { name: domain || "Default Organization", slug: slug || "default" },
  });
  return created.id;
}

const baseAdapter = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    const orgId = await ensureOrgIdForNewUser(data.email);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image,
        orgId,
        role: "REQUESTER",
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      emailVerified: data.emailVerified ?? null,
    } satisfies AdapterUser;
  },
};

const providers: Provider[] = DEV_AUTH
  ? [
      Credentials({
        id: "dev",
        name: "Dev login",
        credentials: { email: { label: "Email" } },
        async authorize(credentials) {
          const email =
            (credentials?.email as string | undefined)?.trim().toLowerCase() ||
            (process.env.DEV_AUTH_EMAIL ?? "admin@demo.local").toLowerCase();
          const orgId = await ensureOrgIdForNewUser(email);
          const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, name: email.split("@")[0], orgId, role: "ADMIN" },
          });
          return { id: user.id, email: user.email, name: user.name ?? undefined };
        },
      }),
    ]
  : [
      MicrosoftEntraID({
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      }),
    ];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DEV_AUTH ? undefined : adapter,
  session: { strategy: DEV_AUTH ? "jwt" : "database" },
  providers,
  pages: { signIn: "/sign-in" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, user, token }) {
      const email = user?.email ?? (token?.email as string | undefined);
      if (!email) return session;
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, orgId: true, role: true, email: true, name: true, image: true },
      });
      if (dbUser) {
        Object.assign(session.user, {
          id: dbUser.id,
          orgId: dbUser.orgId,
          role: dbUser.role,
          email: dbUser.email,
          name: dbUser.name,
          image: dbUser.image,
        });
      }
      return session;
    },
  },
});
