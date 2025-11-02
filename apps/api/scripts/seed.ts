import { prisma } from '../src/infrastructure/db/prisma-client.js';

export const seed = async () => {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Demo Tenant', slug: 'demo' }
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      displayName: 'Demo User',
      passwordHash: 'changeme',
      tenantId: tenant.id
    }
  });

  await prisma.listing.create({
    data: {
      tenantId: tenant.id,
      title: 'Demo Listing',
      description: 'A lovely sample listing for testing.',
      priceCents: 10000,
      currency: 'USD'
    }
  });

  console.log('Seed data created for tenant', tenant.slug, 'and user', user.email);
};

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
