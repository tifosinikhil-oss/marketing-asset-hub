import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database" },
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
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
