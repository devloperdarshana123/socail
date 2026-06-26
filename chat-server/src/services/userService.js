import prisma from "../config/prisma.js";

export const fetchSender = async (senderId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: senderId },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatar: true,
      },
    });
    return user;
  } catch {
    return { id: senderId, fullName: null, username: null, avatar: null };
  }
};

export const isBlocked = async (userIdA, userIdB) => {
  try {
    const block = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
      select: { id: true },
    });
    return !!block;
  } catch {
    return false;
  }
};