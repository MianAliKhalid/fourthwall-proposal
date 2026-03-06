import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

interface SeedUser {
  username: string;
  password: string;
  role: Role;
  displayName: string;
}

const users: SeedUser[] = [
  { username: "admin", password: "Fw$9kR#mPx2!vQnL", role: "ADMIN", displayName: "Admin" },
  { username: "sarah.miller", password: "Ht7@bNcW$4jKfZpR", role: "USER", displayName: "Sarah Miller" },
  { username: "james.chen", password: "Qm3#xLvD!8sYnBtA", role: "USER", displayName: "James Chen" },
  { username: "emma.wilson", password: "Pf6$wRkJ@2hNmCxZ", role: "USER", displayName: "Emma Wilson" },
  { username: "david.park", password: "Ky9!tGnQ#5bVjXwL", role: "USER", displayName: "David Park" },
  { username: "lisa.thompson", password: "Wz4@mHcF$7rKpNsB", role: "USER", displayName: "Lisa Thompson" },
  { username: "mike.garcia", password: "Bx8#jTvL!3nWqYkD", role: "USER", displayName: "Mike Garcia" },
  { username: "anna.kowalski", password: "Rv2$gPnM@6cHfZtJ", role: "USER", displayName: "Anna Kowalski" },
  { username: "chris.taylor", password: "Nk5!yXwB#9dLmQpS", role: "USER", displayName: "Chris Taylor" },
  { username: "olivia.martinez", password: "Dj7@hFcK$1tRvNwG", role: "USER", displayName: "Olivia Martinez" },
  { username: "max.admin", password: "Zs3#bYxP!8wQkLfT", role: "ADMIN", displayName: "Max Admin" },
];

async function main() {
  console.log("Seeding database...");

  for (const user of users) {
    const salt = crypto.randomBytes(32).toString("hex");
    const passwordHash = bcrypt.hashSync(user.password, 12);

    const created = await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: {
        username: user.username,
        passwordHash,
        salt,
        role: user.role,
        displayName: user.displayName,
        isActive: true,
      },
    });

    console.log(`  Created user: ${created.username} (${created.role})`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
