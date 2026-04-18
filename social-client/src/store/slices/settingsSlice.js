// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import api from "../../services/api";

// // ── Update Profile ────────────────────────────────────────
// export const updateProfile = createAsyncThunk(
//   "settings/updateProfile",
//   async ({ name, email, designation, bio, country, state, businessCategory }, { rejectWithValue }) => {
//     try {
//       const { data } = await api.put("/settings/profile", { name, email, designation, bio, country, state, businessCategory });
//       return data.user;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Update failed!");
//     }
//   }
// );

// // ── Change Password ───────────────────────────────────────
// export const changePassword = createAsyncThunk(
//   "settings/changePassword",
//   async ({ oldPassword, newPassword }, { rejectWithValue }) => {
//     try {
//       const { data } = await api.put("/settings/change-password", { oldPassword, newPassword });
//       return data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Change failed!");
//     }
//   }
// );

// // ── Deactivate Account ────────────────────────────────────
// export const deactivateAccount = createAsyncThunk(
//   "settings/deactivateAccount",
//   async (_, { rejectWithValue }) => {
//     try {
//       const { data } = await api.delete("/settings/deactivate");
//       return data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Deactivation failed!");
//     }
//   }
// );

// // ── Upload Avatar ─────────────────────────────────────────
// export const uploadAvatar = createAsyncThunk(
//   "settings/uploadAvatar",
//   async (file, { rejectWithValue }) => {
//     try {
//       const formData = new FormData();
//       formData.append("avatar", file);
//       const { data } = await api.post("/settings/avatar", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       return data.user.avatar;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Upload failed!");
//     }
//   }
// );

// // ── Remove Avatar ─────────────────────────────────────────
// export const removeAvatar = createAsyncThunk(
//   "settings/removeAvatar",
//   async (_, { rejectWithValue }) => {
//     try {
//       await api.delete("/settings/avatar");
//       return "";
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Remove failed!");
//     }
//   }
// );

// // ── Slice ─────────────────────────────────────────────────
// const settingsSlice = createSlice({
//   name: "settings",
//   initialState: {
//     savingProfile:   false,
//     savingPassword:  false,
//     avatarUploading: false,
//     deactivating:    false,
//     error:           null,
//   },
//   reducers: {},
//   extraReducers: (builder) => {
//     // updateProfile
//     builder
//       .addCase(updateProfile.pending,   (state) => { state.savingProfile = true;  state.error = null; })
//       .addCase(updateProfile.fulfilled, (state) => { state.savingProfile = false; })
//       .addCase(updateProfile.rejected,  (state, action) => { state.savingProfile = false; state.error = action.payload; });

//     // changePassword
//     builder
//       .addCase(changePassword.pending,   (state) => { state.savingPassword = true;  state.error = null; })
//       .addCase(changePassword.fulfilled, (state) => { state.savingPassword = false; })
//       .addCase(changePassword.rejected,  (state, action) => { state.savingPassword = false; state.error = action.payload; });

//     // deactivateAccount
//     builder
//       .addCase(deactivateAccount.pending,   (state) => { state.deactivating = true;  state.error = null; })
//       .addCase(deactivateAccount.fulfilled, (state) => { state.deactivating = false; })
//       .addCase(deactivateAccount.rejected,  (state, action) => { state.deactivating = false; state.error = action.payload; });

//     // uploadAvatar
//     builder
//       .addCase(uploadAvatar.pending,   (state) => { state.avatarUploading = true;  state.error = null; })
//       .addCase(uploadAvatar.fulfilled, (state) => { state.avatarUploading = false; })
//       .addCase(uploadAvatar.rejected,  (state, action) => { state.avatarUploading = false; state.error = action.payload; });

//     // removeAvatar
//     builder
//       .addCase(removeAvatar.pending,   (state) => { state.avatarUploading = true; })
//       .addCase(removeAvatar.fulfilled, (state) => { state.avatarUploading = false; })
//       .addCase(removeAvatar.rejected,  (state, action) => { state.avatarUploading = false; state.error = action.payload; });
//   },
// });

// export default settingsSlice.reducer;




import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Update Profile ────────────────────────────────────────
export const updateProfile = createAsyncThunk(
  "settings/updateProfile",
  async ({ name, email, designation, bio, city, country, state, businessCategory, interests }, { rejectWithValue }) => {
    try {
      const { data } = await api.put("/settings/profile", { name, email, designation, bio, city, country, state, businessCategory, interests });
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Update failed!");
    }
  }
);

// ── Change Password ───────────────────────────────────────
export const changePassword = createAsyncThunk(
  "settings/changePassword",
  async ({ oldPassword, newPassword }, { rejectWithValue }) => {
    try {
      const { data } = await api.put("/settings/change-password", { oldPassword, newPassword });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Change failed!");
    }
  }
);

// ── Deactivate Account ────────────────────────────────────
export const deactivateAccount = createAsyncThunk(
  "settings/deactivateAccount",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.delete("/settings/deactivate");
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Deactivation failed!");
    }
  }
);

// ── Upload Avatar ─────────────────────────────────────────
export const uploadAvatar = createAsyncThunk(
  "settings/uploadAvatar",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await api.post("/settings/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.user.avatar;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Upload failed!");
    }
  }
);

// ── Remove Avatar ─────────────────────────────────────────
export const removeAvatar = createAsyncThunk(
  "settings/removeAvatar",
  async (_, { rejectWithValue }) => {
    try {
      await api.delete("/settings/avatar");
      return "";
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Remove failed!");
    }
  }
);

// ── ✅ Upload Cover Photo ──────────────────────────────────
export const uploadCoverPhoto = createAsyncThunk(
  "settings/uploadCoverPhoto",
  async (file, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const { data } = await api.put("/settings/cover", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.user.coverPhoto;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Cover upload failed!");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────
const settingsSlice = createSlice({
  name: "settings",
  initialState: {
    savingProfile:    false,
    savingPassword:   false,
    avatarUploading:  false,
    coverUploading:   false, // ✅ new
    deactivating:     false,
    error:            null,
  },
  reducers: {},
  extraReducers: (builder) => {
    // updateProfile
    builder
      .addCase(updateProfile.pending,   (state) => { state.savingProfile = true;  state.error = null; })
      .addCase(updateProfile.fulfilled, (state) => { state.savingProfile = false; })
      .addCase(updateProfile.rejected,  (state, action) => { state.savingProfile = false; state.error = action.payload; });

    // changePassword
    builder
      .addCase(changePassword.pending,   (state) => { state.savingPassword = true;  state.error = null; })
      .addCase(changePassword.fulfilled, (state) => { state.savingPassword = false; })
      .addCase(changePassword.rejected,  (state, action) => { state.savingPassword = false; state.error = action.payload; });

    // deactivateAccount
    builder
      .addCase(deactivateAccount.pending,   (state) => { state.deactivating = true;  state.error = null; })
      .addCase(deactivateAccount.fulfilled, (state) => { state.deactivating = false; })
      .addCase(deactivateAccount.rejected,  (state, action) => { state.deactivating = false; state.error = action.payload; });

    // uploadAvatar
    builder
      .addCase(uploadAvatar.pending,   (state) => { state.avatarUploading = true;  state.error = null; })
      .addCase(uploadAvatar.fulfilled, (state) => { state.avatarUploading = false; })
      .addCase(uploadAvatar.rejected,  (state, action) => { state.avatarUploading = false; state.error = action.payload; });

    // removeAvatar
    builder
      .addCase(removeAvatar.pending,   (state) => { state.avatarUploading = true; })
      .addCase(removeAvatar.fulfilled, (state) => { state.avatarUploading = false; })
      .addCase(removeAvatar.rejected,  (state, action) => { state.avatarUploading = false; state.error = action.payload; });

    // ✅ uploadCoverPhoto
    builder
      .addCase(uploadCoverPhoto.pending,   (state) => { state.coverUploading = true;  state.error = null; })
      .addCase(uploadCoverPhoto.fulfilled, (state) => { state.coverUploading = false; })
      .addCase(uploadCoverPhoto.rejected,  (state, action) => { state.coverUploading = false; state.error = action.payload; });
  },
});

export default settingsSlice.reducer;