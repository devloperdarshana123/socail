// Proves the real-Postgres test harness works end-to-end: a real
// PostgreSQL instance started, real Prisma migrations applied, real
// queries executed and rolled back. This is the foundation Milestone 5's
// controller refactor will build on — every future integration test in
// this folder follows this same pattern (import the real Prisma client,
// exercise it against the real migrated schema, clean up after itself).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("test database harness", () => {
  test("connects to the real embedded Postgres instance", async () => {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(result[0].ok).toBe(1);
  });

  test("the real migration history was applied — User table exists with expected shape", async () => {
    const user = await prisma.user.create({
      data: { fullName: "Test User", email: "harness-test@example.com" },
    });

    expect(user.id).toBeTruthy();
    expect(user.fullName).toBe("Test User");
    expect(user.accountStatus).toBe("pending"); // schema default, proves the real migrated schema
    expect(user.role).toBe("user"); // schema default

    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found.email).toBe("harness-test@example.com");

    await prisma.user.delete({ where: { id: user.id } });
  });

  test("unique constraints are enforced by the real database", async () => {
    const user = await prisma.user.create({
      data: { fullName: "Dup Test", email: "dup-test@example.com" },
    });

    await expect(
      prisma.user.create({ data: { fullName: "Dup Test 2", email: "dup-test@example.com" } })
    ).rejects.toThrow();

    await prisma.user.delete({ where: { id: user.id } });
  });
});
