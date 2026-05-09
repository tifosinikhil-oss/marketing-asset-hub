import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true, org: true, brandMembers: { include: { brand: true } } },
  });
  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">{user.email}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={user.name ?? "—"} />
          <Row label="Email" value={user.email} />
          <Row label="Role" value={user.role} />
          <Row label="Organization" value={user.org.name} />
          <Row label="Brands" value={user.brandMembers.map((b) => b.brand.name).join(", ") || "—"} />
          <Row label="Timezone" value={user.timezone ?? "—"} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
