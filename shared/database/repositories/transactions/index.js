import { PrismaTransaction } from "./PrismaTransaction.js";
import { MongoTransaction } from "./MongoTransaction.js";

export { PrismaTransaction, MongoTransaction };

// Common factory — same DATABASE_PROVIDER convention as ../factory.js.
export function createTransaction({ provider = process.env.DATABASE_PROVIDER || "prisma", prismaClient } = {}) {
  if (provider === "mongo") return new MongoTransaction();
  if (!prismaClient) {
    throw new Error("createTransaction({ provider: 'prisma' }) requires a prismaClient");
  }
  return new PrismaTransaction(prismaClient);
}
