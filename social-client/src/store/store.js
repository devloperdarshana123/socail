import { configureStore } from "@reduxjs/toolkit";
import authReducer     from "./slices/authSlice";
import settingsReducer from "./slices/settingsSlice";
import feedReducer     from "./slices/Feedslice";
import exploreReducer  from "./slices/Exploreslice";
import profileReducer  from "./slices/Profileslice";
import savedReducer    from "./slices/Savedslice";
import followReducer   from "./slices/Followslice";
import notificationReducer from "./slices/Notificationslice";
import messagesReducer from "./slices/Messageslice";
import StoryReducer  from "./slices/storySlice";

const store = configureStore({
  reducer: {
    auth:     authReducer,
    settings: settingsReducer,
    feed:     feedReducer,
    explore:  exploreReducer,
    profile:  profileReducer,
    saved:    savedReducer,
    follow:   followReducer,
    notifications: notificationReducer,
    messages: messagesReducer, 
    story:StoryReducer
  },
});

export default store;