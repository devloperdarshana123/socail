import { mongoose } from "../../mongodb/index.js";
import { TransactionError } from "../errors/index.js";

// Uses a real MongoDB session + multi-document transaction — this is
// exactly why Milestone 1 configured the local server as a (single-node)
// replica set: transactions require one. `run()`'s callback receives the
// session — pass it as `{ tx }` in the options object to repository methods
// that accept a transaction context.
//
// M-2: `tx` is the ONE transaction-context key across both backends.
// Previously the Prisma implementations read `{ tx }` while the Mongo
// implementations read `{ session }`, and every helper passes `{ tx }` —
// so on a Mongo switch the context would have been silently dropped and
// every write in all 19 transaction call-sites would have executed OUTSIDE
// its transaction, with no error. The value handed to the callback is still
// a genuine mongoose ClientSession; only the option key it travels under is
// unified. Each Mongo method forwards it to mongoose's own `session` option
// (`{ session: tx }`) or `.session(tx ?? null)`, so the driver API is
// untouched.
export class MongoTransaction {
  async run(callback) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await callback(session);
      });
      return result;
    } catch (err) {
      throw new TransactionError(err?.message ?? "MongoDB transaction failed", { cause: err });
    } finally {
      await session.endSession();
    }
  }
}
