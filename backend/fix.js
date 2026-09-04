// fix.js
import prisma from "./src/config/prisma.js";

const posts = await prisma.post.findMany({ select: { id: true } });

for (const post of posts) {
  const activeCount = await prisma.comment.count({
    where: { postId: post.id, isDeleted: false, status: "active" }
  });
  await prisma.post.update({
    where: { id: post.id },
    data: { commentsCount: activeCount }
  });
}

console.log("Done!");
await prisma.$disconnect();