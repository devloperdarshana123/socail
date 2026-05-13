// // import express from "express";
// // import upload from "../config/multer.js";
// // import auth from "../middleware/auth.middleware.js";
// // import {
// //   uploadStory,
// //   getStories,
// //   markViewed,
// //   deleteStory,
// //   getViewers,
// // } from "../controllers/story.controller.js";

// // const router = express.Router();

// // router.post("/",              auth, upload.single("media"), uploadStory);
// // router.get("/",               auth, getStories);
// // router.put("/:id/view",       auth, markViewed);
// // router.get("/:id/viewers",    auth, getViewers);
// // router.delete("/:id",         auth, deleteStory);

// // export default router;

// import express from "express";
// import upload from "../config/multer.js";
// import { protect } from "../middleware/auth.middleware.js";
// import {
//   uploadStory,
//   getStories,
//   markViewed,
//   deleteStory,
//   getViewers,
// } from "../controllers/story.controller.js";

// const router = express.Router();

// router.post("/",           protect, upload.single("media"), uploadStory);
// router.get("/",            protect, getStories);
// router.put("/:id/view",    protect, markViewed);
// router.get("/:id/viewers", protect, getViewers);
// router.delete("/:id",      protect, deleteStory);

// export default router;


import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.middleware.js";

import {
  createStory,
  getFeedStories,
  markViewed,
  getViewers,
  reactToStory,
  deleteStory,
  hideStoryFrom,
} from "../controllers/story.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/",                   protect, upload.single("media"), createStory);
router.get ("/",                   protect, getFeedStories);
router.put ("/:storyId/view",      protect, markViewed);
router.get ("/:storyId/viewers",   protect, getViewers);
router.post("/:storyId/react",     protect, reactToStory);
router.post("/hide",               protect, hideStoryFrom);
router.delete("/:storyId",         protect, deleteStory);

export default router;