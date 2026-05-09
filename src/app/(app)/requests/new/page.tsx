import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { BriefForm } from "@/components/forms/brief-form";

export default async function NewRequestPage() {
  const session = await auth();
  if (!session?.user) return null;

  const brands = await prisma.brand.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New brief</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Describe what you want and let AI draft the brief — review it before submitting.
        </p>
      </div>
      <BriefForm brands={brands} />
    </div>
  );
}
