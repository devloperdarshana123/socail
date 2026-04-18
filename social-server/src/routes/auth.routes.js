

import express from "express";
import {
  register,
  login,
  getMe,
  logout,
  getUserStats,
  getAllUsers,
  suspendUser,
  deleteUser,
  getSuggestions,
  searchUsers,
  googleAuth,
  getUserProfile, 
} from "../controllers/auth.controller.js";
import { protect, superAdminOnly } from "../middleware/auth.middleware.js";

const router = express.Router();

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login",    login);

// ── Protected Routes (logged in user) ────────────────────────────────────────
router.get("/me",              protect, getMe);
router.get("/stats",           protect, getUserStats);
router.post("/logout", protect, logout); 
router.post("/google",   googleAuth); 

// ── Users — Suggestions & Search ─────────────────────────────────────────────
router.get("/users/suggestions", protect, getSuggestions);
router.get("/users/search",      protect, searchUsers);
router.get("/users/:userId",     protect, getUserProfile);

// ── Super Admin Only Routes ───────────────────────────────────────────────────
router.get("/admin/users",              protect, superAdminOnly, getAllUsers);
router.put("/admin/users/:id/suspend",  protect, superAdminOnly, suspendUser);
router.delete("/admin/users/:id",       protect, superAdminOnly, deleteUser);

export default router;