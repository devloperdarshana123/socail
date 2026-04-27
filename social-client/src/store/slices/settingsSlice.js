

// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import api from "../../services/api";

// // ── Update Profile ────────────────────────────────────────
// export const updateProfile = createAsyncThunk(
//   "settings/updateProfile",
//   async ({ name, email, designation, bio, city, country, state, businessCategory, interests }, { rejectWithValue }) => {
//     try {
//       const { data } = await api.put("/settings/profile", { name, email, designation, bio, city, country, state, businessCategory, interests });
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

// // ── ✅ Upload Cover Photo ──────────────────────────────────
// export const uploadCoverPhoto = createAsyncThunk(
//   "settings/uploadCoverPhoto",
//   async (file, { rejectWithValue }) => {
//     try {
//       const formData = new FormData();
//       formData.append("cover", file);
//       const { data } = await api.put("/settings/cover", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       return data.user.coverPhoto;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Cover upload failed!");
//     }
//   }
// );

// // ── Slice ─────────────────────────────────────────────────
// const settingsSlice = createSlice({
//   name: "settings",
//   initialState: {
//     savingProfile:    false,
//     savingPassword:   false,
//     avatarUploading:  false,
//     coverUploading:   false, // ✅ new
//     deactivating:     false,
//     error:            null,
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

//     // ✅ uploadCoverPhoto
//     builder
//       .addCase(uploadCoverPhoto.pending,   (state) => { state.coverUploading = true;  state.error = null; })
//       .addCase(uploadCoverPhoto.fulfilled, (state) => { state.coverUploading = false; })
//       .addCase(uploadCoverPhoto.rejected,  (state, action) => { state.coverUploading = false; state.error = action.payload; });
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

// ── Change Password (normal users) ───────────────────────
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

// ── Set Password (Google users — pehli baar) ─────────────
export const setPassword = createAsyncThunk(
  "settings/setPassword",
  async ({ newPassword, confirmPassword }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/settings/set-password", { newPassword, confirmPassword });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Set password failed!");
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

// ── Upload Cover Photo ────────────────────────────────────
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
    savingProfile:   false,
    savingPassword:  false,
    settingPassword: false,
    avatarUploading: false,
    coverUploading:  false,
    deactivating:    false,
    error:           null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(updateProfile.pending,   (s) => { s.savingProfile = true;  s.error = null; })
      .addCase(updateProfile.fulfilled, (s) => { s.savingProfile = false; })
      .addCase(updateProfile.rejected,  (s, a) => { s.savingProfile = false; s.error = a.payload; });

    builder
      .addCase(changePassword.pending,   (s) => { s.savingPassword = true;  s.error = null; })
      .addCase(changePassword.fulfilled, (s) => { s.savingPassword = false; })
      .addCase(changePassword.rejected,  (s, a) => { s.savingPassword = false; s.error = a.payload; });

    builder
      .addCase(setPassword.pending,   (s) => { s.settingPassword = true;  s.error = null; })
      .addCase(setPassword.fulfilled, (s) => { s.settingPassword = false; })
      .addCase(setPassword.rejected,  (s, a) => { s.settingPassword = false; s.error = a.payload; });

    builder
      .addCase(deactivateAccount.pending,   (s) => { s.deactivating = true;  s.error = null; })
      .addCase(deactivateAccount.fulfilled, (s) => { s.deactivating = false; })
      .addCase(deactivateAccount.rejected,  (s, a) => { s.deactivating = false; s.error = a.payload; });

    builder
      .addCase(uploadAvatar.pending,   (s) => { s.avatarUploading = true;  s.error = null; })
      .addCase(uploadAvatar.fulfilled, (s) => { s.avatarUploading = false; })
      .addCase(uploadAvatar.rejected,  (s, a) => { s.avatarUploading = false; s.error = a.payload; });

    builder
      .addCase(removeAvatar.pending,   (s) => { s.avatarUploading = true; })
      .addCase(removeAvatar.fulfilled, (s) => { s.avatarUploading = false; })
      .addCase(removeAvatar.rejected,  (s, a) => { s.avatarUploading = false; s.error = a.payload; });

    builder
      .addCase(uploadCoverPhoto.pending,   (s) => { s.coverUploading = true;  s.error = null; })
      .addCase(uploadCoverPhoto.fulfilled, (s) => { s.coverUploading = false; })
      .addCase(uploadCoverPhoto.rejected,  (s, a) => { s.coverUploading = false; s.error = a.payload; });
  },
});

export default settingsSlice.reducer;