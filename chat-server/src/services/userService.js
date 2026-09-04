import { userRepository, blockRepository } from "../config/repositories.js";

// M-7: repository-backed. The two functions below keep their exact
// signatures, return shapes and — importantly — their swallow-and-default
// error contracts, which the socket handlers depend on: a database blip must
// degrade a chat feature, never crash a live socket connection.

export const fetchSender = async (senderId) => {
  try {
    const user = await userRepository.findById(senderId, {
      select: {
        id: true,
        fullName: true,
        username: true,
        avatar: true,
      },
    });
    return user;
  } catch {
    // Unchanged fallback: a partial sender object rather than a throw, so
    // the notification still emits with a degraded name.
    return { id: senderId, fullName: null, username: null, avatar: null };
  }
};

export const isBlocked = async (userIdA, userIdB) => {
  try {
    // Neutral filter DSL (M-1): `or` / bare equality, translated per backend.
    //
    // The original selected `{ id: true }` purely to coerce a row into a
    // boolean; `exists()` is that question directly and avoids inventing a
    // findFirstWhere on this repository just to throw the row away.
    return await blockRepository.exists({
      or: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    });
  } catch {
    // Unchanged: fail OPEN. A block lookup that errors must not silently
    // block delivery — the original made the same call.
    return false;
  }
};
