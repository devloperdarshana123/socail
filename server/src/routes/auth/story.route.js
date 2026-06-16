import express from "express";
import { isAuthenticated, isActive } from "../../middlewares/auth.js";
import { uploadSingle } from "../../middlewares/multer.middleware.js";
import {
  createStory, getStoriesFeed, viewStory,
  reactToStory, deleteStory, getStoryViewers,
  createHighlight, getMyHighlights,
  addToHighlight, deleteHighlight,
  toggleStoryLike,createTextStory ,removeSnapFromHighlight
} from "../../controllers/auth/story.controller.js";
import {
  storyViewLimiter,
  storyReactLimiter,
} from "../../middlewares/rateLimiter.js";
const storyRouter = express.Router();
storyRouter.use(isAuthenticated, isActive);

// Static routes pehle
storyRouter.get("/feed",                getStoriesFeed);
storyRouter.post("/",             createStory);

// Highlight routes — specific pehle
storyRouter.get("/highlights/my",                    getMyHighlights);
storyRouter.post("/highlights",                      createHighlight);
storyRouter.post("/highlights/:id/add",              addToHighlight);
storyRouter.delete("/highlights/:id/snap/:snapId",   removeSnapFromHighlight);
storyRouter.delete("/highlights/:id",                deleteHighlight);
storyRouter.post("/text",                            createTextStory);

// Dynamic :id routes baad mein
storyRouter.post("/:id/view",    storyViewLimiter,      viewStory);
storyRouter.post("/:id/react",   storyReactLimiter,       reactToStory);
storyRouter.post("/:id/like",           toggleStoryLike);
storyRouter.delete("/:id",              deleteStory);
storyRouter.get("/:id/viewers",         getStoryViewers);


export default storyRouter;