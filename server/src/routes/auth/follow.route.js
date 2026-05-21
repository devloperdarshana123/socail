import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} from "../../controllers/auth/follow.controller.js";

const followRouter = express.Router();

followRouter.use(isAuthenticated, isActive);

// ✅ Generic routes BAAD MEIN
followRouter.post("/:userId", followUser);
followRouter.delete("/:userId", unfollowUser);
followRouter.get("/:userId/followers", getFollowers);
followRouter.get("/:userId/following", getFollowing);

export default followRouter;