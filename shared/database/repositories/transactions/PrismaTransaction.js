import { TransactionError } from "../errors/index.js";

// Wraps Prisma's existing interactive transaction API. `run()`'s callback
// receives the transaction client (`tx`) — pass it to repository methods
// that accept an optional transaction context (see BaseRepository).
export class PrismaTransaction {
  constructor(prismaClient) {
    this.prismaClient = prismaClient;
  }

  async run(callback) {
    try {
      return await this.prismaClient.$transaction(async (tx) => callback(tx));
    } catch (err) {
      throw new TransactionError(err?.message ?? "Prisma transaction failed", { cause: err });
    }
  }
}
