

import express from 'express';
import { protect, superAdminOnly } from '../middleware/auth.middleware.js';
import {
  getStats,
  getUserGrowth,
  getPostActivity,
  getAllPosts,
  deletePost,
  getAllUsers,
  warnUser,
  suspendUser ,
   getRecentActivity, getTopUsers ,
   unsuspendUser
} from '../controllers/admin.controller.js';

const router = express.Router();

router.get   ('/stats',              protect, superAdminOnly, getStats);
router.get   ('/user-growth',        protect, superAdminOnly, getUserGrowth);   // NEW
router.get   ('/post-activity',      protect, superAdminOnly, getPostActivity); // NEW
router.get   ('/posts',              protect, superAdminOnly, getAllPosts);
router.delete('/posts/:id',          protect, superAdminOnly, deletePost);
router.get   ('/users',              protect, superAdminOnly, getAllUsers);
router.post  ('/users/:id/warn',     protect, superAdminOnly, warnUser);
router.post  ('/users/:id/suspend',  protect, superAdminOnly, suspendUser);
router.get('/recent-activity', protect, superAdminOnly, getRecentActivity);
router.get('/top-users',       protect, superAdminOnly, getTopUsers);
router.post('/users/:id/unsuspend', protect, superAdminOnly, unsuspendUser);

export default router;