import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('12345678', 10);
  const userPassword  = await bcrypt.hash('12345678', 10);

  await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email:    'admin@icthotel.com',
      name:     'Admin User',
      password: adminPassword,
      role:     'ADMIN',
    },
  });

  await prisma.user.upsert({
    where:  { username: 'guest' },
    update: {},
    create: {
      username: 'guest',
      email:    'guest@icthotel.com',
      name:     'Guest User',
      password: userPassword,
      role:     'USER',
    },
  });

  const rooms = [
    { name: 'Standard Room 101', description: 'Standard room with garden view',             capacity: 2, pricePerNight: 1800, imageUrl: '/images/room101.jpg', isActive: true  },
    { name: 'Deluxe Room 201',   description: 'Deluxe room with city view and balcony',     capacity: 2, pricePerNight: 2800, imageUrl: '/images/room201.jpg', isActive: true  },
    { name: 'Family Room 301',   description: 'Large family room suitable for 4 guests',    capacity: 4, pricePerNight: 4200, imageUrl: '/images/room301.jpg', isActive: true  },
    { name: 'Suite Room 401',    description: 'Luxury suite with living area and sea view', capacity: 3, pricePerNight: 6500, imageUrl: '/images/room401.jpg', isActive: true  },
    { name: 'Economy Room 102',  description: 'Small economy room for budget travelers',    capacity: 1, pricePerNight: 1200, imageUrl: '/images/room102.jpg', isActive: false },
  ];

  for (const room of rooms) {
    await prisma.room.create({ data: room });
  }

  console.log('Seed complete ✅');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());