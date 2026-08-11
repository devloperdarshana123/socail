// chat-server transaction runner (Phase 7E / M-7).
//
// The mirror of server/src/config/transaction.js. Handlers import THIS, not
// a database client, so a multi-document write stays backend-agnostic:
// PrismaTransaction wraps $transaction, MongoTransaction wraps a mongoose
// session — both expose run(callback) and both normalise failures to
// TransactionError, so the handlers' catch blocks are unchanged.
import { PrismaTransaction } from "../../../shared/database/repositories/transactions/PrismaTransaction.js";
import { MongoTransaction } from "../../../shared/database/repositories/transactions/MongoTransaction.js";
// `prisma` is re-exported by the composition root and is null on the mongo
// path — see the note there on why the client is not imported directly.
import { DATABASE_PROVIDER, prisma } from "./repositories.js";

export const transactionRunner =
  DATABASE_PROVIDER === "mongo" ? new MongoTransaction() : new PrismaTransaction(prisma);
