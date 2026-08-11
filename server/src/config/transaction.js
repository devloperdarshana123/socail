import { PrismaTransaction } from "../../../shared/database/repositories/transactions/PrismaTransaction.js";
import { MongoTransaction } from "../../../shared/database/repositories/transactions/MongoTransaction.js";
// `prisma` comes from the composition root, which loads the client lazily
// and leaves it null on the mongo path — importing it directly here would
// put a generated Prisma client back on a Mongo-only deployment's boot path.
import { DATABASE_PROVIDER, prisma } from "./repositories.js";

// App-wide transaction runner. Controllers and helpers import THIS — not a
// database client — so they can run transactions through the shared
// abstraction while remaining database-agnostic. This module is
// infrastructure/config wiring (like prisma.js / repositories.js), which is
// where a Prisma import legitimately belongs.
//
// `transactionRunner.run(async (tx) => { ... })` executes the callback
// inside a real interactive transaction and re-throws any failure as a
// TransactionError that preserves the cause's `.message`, `.code` and
// `.name` — so existing message- and code-based catch logic keeps working
// unchanged on either backend.
//
// ── PROVIDER-AWARE (verification-phase fix) ──────────────────────────────
// This was hardcoded to PrismaTransaction. Under DATABASE_PROVIDER=mongo the
// composition root correctly returned Mongo repositories while this kept
// returning a Prisma runner, so every one of the 19 transactional call-sites
// would have opened a PRISMA transaction and passed its `tx` into a MONGO
// repository. The repository would then have handed a Prisma transaction
// client to mongoose as a session — a failure that only appears once the
// provider is actually switched, which is exactly why nothing caught it
// until the stack was run under Mongo.
export const transactionRunner =
  DATABASE_PROVIDER === "mongo" ? new MongoTransaction() : new PrismaTransaction(prisma);
