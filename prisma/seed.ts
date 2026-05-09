import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Marketing Org",
      slug: "demo",
    },
  });

  const brand = await prisma.brand.upsert({
    where: { orgId_slug: { orgId: org.id, slug: "core" } },
    update: {},
    create: {
      orgId: org.id,
      name: "Core Brand",
      slug: "core",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.local" },
    update: {},
    create: {
      orgId: org.id,
      email: "admin@demo.local",
      name: "Admin User",
      role: "ADMIN",
    },
  });

  await prisma.brandMember.upsert({
    where: { userId_brandId: { userId: admin.id, brandId: brand.id } },
    update: {},
    create: { userId: admin.id, brandId: brand.id, role: "owner" },
  });

  const requester = await prisma.user.upsert({
    where: { email: "requester@demo.local" },
    update: {},
    create: {
      orgId: org.id,
      email: "requester@demo.local",
      name: "Sample Requester",
      role: "REQUESTER",
    },
  });

  const sample = await prisma.request.findFirst({
    where: { orgId: org.id, title: "Q2 product launch announcement" },
  });
  if (!sample) {
    await prisma.request.create({
      data: {
        orgId: org.id,
        brandId: brand.id,
        title: "Q2 product launch announcement",
        contentType: "BLOG",
        priority: "HIGH",
        requesterId: requester.id,
        status: "SUBMITTED",
        channels: ["Blog", "LinkedIn", "Email"],
        brief: {
          targetAudience: "Mid-market CFOs evaluating finance automation tools.",
          keyMessages: [
            "AI saves 10+ hours/week on month-end close",
            "Integrates with existing ERP systems",
            "GDPR-compliant from day one",
          ],
          callToAction: "Book a 20-minute demo",
          brandVoice: "Confident, plainspoken, evidence-led",
          successMetrics: ["50 demo bookings", "5,000 unique visitors in 30 days"],
          notes: "Hero image needed; coordinate with design.",
        },
      },
    });
  }

  console.log("Seed complete:", { org: org.slug, brand: brand.slug });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
