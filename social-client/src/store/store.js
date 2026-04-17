import { configureStore } from "@reduxjs/toolkit";
import authReducer     from "./slices/authSlice";
import settingsReducer from "./slices/settingsSlice";
import feedReducer     from "./slices/Feedslice";
import exploreReducer  from "./slices/Exploreslice";
import profileReducer  from "./slices/Profileslice";
import savedReducer    from "./slices/Savedslice";
import followReducer   from "./slices/Followslice";

import messagesReducer from "./slices/Messageslice";

const store = configureStore({
  reducer: {
    auth:     authReducer,
    settings: settingsReducer,
    feed:     feedReducer,
    explore:  exploreReducer,
    profile:  profileReducer,
    saved:    savedReducer,
    follow:   followReducer,
   
     messages: messagesReducer, 
  },
});

export default store;