

// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import api from "../services/api";

// const BASE = "/user";

// export const uploadAvatar = createAsyncThunk(
//   "userProfile/uploadAvatar",
//   async (file, { rejectWithValue, dispatch, getState }) => {
//     try {
//       const formData = new FormData();
//       formData.append("avatar", file);
//       const { data } = await api.patch(`${BASE}/avatar`, formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       // authSlice ka action dynamically dispatch karo — no import needed
//       dispatch({ type: "auth/updateUserAvatar", payload: data.data.avatar });
//       return data.data.avatar;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Avatar upload failed.");
//     }
//   }
// );

// export const uploadCoverPhoto = createAsyncThunk(
//   "userProfile/uploadCoverPhoto",
//   async (file, { rejectWithValue, dispatch }) => {
//     try {
//       const formData = new FormData();
//       formData.append("coverPhoto", file);
//       const { data } = await api.patch(`${BASE}/cover-photo`, formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       // authSlice ka action dynamically dispatch karo — no import needed
//       dispatch({ type: "auth/updateUserCoverPhoto", payload: data.data.coverPhoto });
//       return data.data.coverPhoto;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Cover photo upload failed.");
//     }
//   }
// );

// export const removeAvatar = createAsyncThunk(
//   "userProfile/removeAvatar",
//   async (_, { rejectWithValue, dispatch }) => {
//     try {
//       await api.delete(`${BASE}/avatar`);
//       dispatch({ type: "auth/updateUserAvatar", payload: null });
//       return null;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed to remove avatar.");
//     }
//   }
// );

// export const removeCoverPhoto = createAsyncThunk(
//   "userProfile/removeCoverPhoto",
//   async (_, { rejectWithValue, dispatch }) => {
//     try {
//       await api.delete(`${BASE}/cover-photo`);
//       dispatch({ type: "auth/updateUserCoverPhoto", payload: null });
//       return null;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed to remove cover photo.");
//     }
//   }
// );

// const userProfileSlice = createSlice({
//   name: "userProfile",
//   initialState: {
//     avatar: null,      // ✅ add karo
//     coverPhoto: null,  // ✅ add karo
//     avatarLoading: false,
//     coverLoading: false,
//     error: null,
//   },
//   reducers: {
//     // ✅ yeh block missing tha!
//     clearError(state) {
//       state.error = null;
//     },
//     resetProfile(state) {
//       state.avatar = null;
//       state.coverPhoto = null;
//       state.avatarLoading = false;
//       state.coverLoading = false;
//       state.error = null;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(uploadAvatar.pending, (state) => { 
//         state.avatarLoading = true; 
//         state.error = null; 
//       })
//       .addCase(uploadAvatar.fulfilled, (state, action) => { 
//         state.avatarLoading = false;
//         state.avatar = action.payload; // ✅ state update karo
//       })
//       .addCase(uploadAvatar.rejected, (state, action) => { 
//         state.avatarLoading = false; 
//         state.error = action.payload; 
//       });

//     builder
//       .addCase(uploadCoverPhoto.pending, (state) => { 
//         state.coverLoading = true; 
//         state.error = null; 
//       })
//       .addCase(uploadCoverPhoto.fulfilled, (state, action) => { 
//         state.coverLoading = false;
//         state.coverPhoto = action.payload; // ✅ state update karo
//       })
//       .addCase(uploadCoverPhoto.rejected, (state, action) => { 
//         state.coverLoading = false; 
//         state.error = action.payload; 
//       });

//     builder.addCase(removeAvatar.fulfilled, (state) => { 
//       state.avatarLoading = false;
//       state.avatar = null; // ✅
//     });
//     builder.addCase(removeCoverPhoto.fulfilled, (state) => { 
//       state.coverLoading = false;
//       state.coverPhoto = null; // ✅
//     });
//   },
// });

// export const { clearError , resetProfile } = userProfileSlice.actions;
// export default userProfileSlice.reducer;



import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

const BASE = "/user";

export const uploadAvatar = createAsyncThunk(
  "userProfile/uploadAvatar",
  async (file, { rejectWithValue, dispatch }) => {
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.patch(`${BASE}/avatar`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      dispatch({ type: "auth/updateUserAvatar", payload: data.data.avatar });
      return data.data.avatar;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Avatar upload failed.");
    }
  }
);

export const uploadCoverPhoto = createAsyncThunk(
  "userProfile/uploadCoverPhoto",
  async (file, { rejectWithValue, dispatch }) => {
    try {
      const formData = new FormData();
      formData.append("coverPhoto", file);
      const { data } = await api.patch(`${BASE}/cover-photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      dispatch({ type: "auth/updateUserCoverPhoto", payload: data.data.coverPhoto });
      return data.data.coverPhoto;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Cover photo upload failed.");
    }
  }
);

export const removeAvatar = createAsyncThunk(
  "userProfile/removeAvatar",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`${BASE}/avatar`);
      dispatch({ type: "auth/updateUserAvatar", payload: null });
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to remove avatar.");
    }
  }
);

export const removeCoverPhoto = createAsyncThunk(
  "userProfile/removeCoverPhoto",
  async (_, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`${BASE}/cover-photo`);
      dispatch({ type: "auth/updateUserCoverPhoto", payload: null });
      return null;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to remove cover photo.");
    }
  }
);

const userProfileSlice = createSlice({
  name: "userProfile",
  initialState: {
    avatarLoading: false,
    coverLoading: false,
    error: null,
  },
  reducers: {
    clearError(state) { state.error = null; },
    resetProfile(state) {
      state.avatarLoading = false;
      state.coverLoading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadAvatar.pending,   (state) => { state.avatarLoading = true;  state.error = null; })
      .addCase(uploadAvatar.fulfilled, (state) => { state.avatarLoading = false; })
      .addCase(uploadAvatar.rejected,  (state, action) => { state.avatarLoading = false; state.error = action.payload; });

    builder
      .addCase(uploadCoverPhoto.pending,   (state) => { state.coverLoading = true;  state.error = null; })
      .addCase(uploadCoverPhoto.fulfilled, (state) => { state.coverLoading = false; })
      .addCase(uploadCoverPhoto.rejected,  (state, action) => { state.coverLoading = false; state.error = action.payload; });

    builder.addCase(removeAvatar.fulfilled,    (state) => { state.avatarLoading = false; });
    builder.addCase(removeCoverPhoto.fulfilled, (state) => { state.coverLoading = false; });
  },
});

export const { clearError, resetProfile } = userProfileSlice.actions;
export default userProfileSlice.reducer;