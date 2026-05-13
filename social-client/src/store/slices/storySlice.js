// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import api from "../../services/api";

// // ── Thunks ────────────────────────────────────────────────────────────────────

// export const fetchStories = createAsyncThunk("story/fetchAll", async (_, { rejectWithValue }) => {
//   try {
//     const token = localStorage.getItem("erosocial_token");
//     const { data } = await axios.get(`${BASE_URL}/api/stories`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     return data.data;
//   } catch (err) {
//     return rejectWithValue(err.response?.data?.error || "Failed to fetch stories");
//   }
// });

// export const uploadStory = createAsyncThunk("story/upload", async (formData, { rejectWithValue }) => {
//   try {
//     const token = localStorage.getItem("erosocial_token");
//     const { data } = await axios.post(`${BASE_URL}/api/stories`, formData, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         "Content-Type": "multipart/form-data",
//       },
//     });
//     return data.story;
//   } catch (err) {
//     return rejectWithValue(err.response?.data?.error || "Upload failed");
//   }
// });

// export const markStoryViewed = createAsyncThunk("story/markViewed", async (storyId, { rejectWithValue }) => {
//   try {
//     const token = localStorage.getItem("erosocial_token");
//     await axios.put(`${BASE_URL}/api/stories/${storyId}/view`, {}, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     return storyId;
//   } catch (err) {
//     return rejectWithValue(err.response?.data?.error || "Failed");
//   }
// });

// export const deleteStory = createAsyncThunk("story/delete", async (storyId, { rejectWithValue }) => {
//   try {
//     const token = localStorage.getItem("erosocial_token");
//     await axios.delete(`${BASE_URL}/api/stories/${storyId}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });
//     return storyId;
//   } catch (err) {
//     return rejectWithValue(err.response?.data?.error || "Delete failed");
//   }
// });

// // ── Slice ─────────────────────────────────────────────────────────────────────

// const storySlice = createSlice({
//   name: "story",
//   initialState: {
//     groups: [],      // [{ user, stories[], hasUnread }]
//     loading: false,
//     uploading: false,
//     error: null,
//   },
//   reducers: {},
//   extraReducers: (builder) => {
//     builder
//       // fetch
//       .addCase(fetchStories.pending, (s) => { s.loading = true; s.error = null; })
//       .addCase(fetchStories.fulfilled, (s, a) => { s.loading = false; s.groups = a.payload; })
//       .addCase(fetchStories.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

//       // upload
//       .addCase(uploadStory.pending, (s) => { s.uploading = true; })
//       .addCase(uploadStory.fulfilled, (s, a) => {
//         s.uploading = false;
//         const newStory = a.payload;
//         const uid = newStory.user._id;
//         const idx = s.groups.findIndex((g) => g.user._id === uid);
//         if (idx !== -1) {
//           s.groups[idx].stories.unshift(newStory);
//         } else {
//           s.groups.unshift({ user: newStory.user, stories: [newStory], hasUnread: false });
//         }
//       })
//       .addCase(uploadStory.rejected, (s) => { s.uploading = false; })

//       // mark viewed
//       .addCase(markStoryViewed.fulfilled, (s, a) => {
//         const storyId = a.payload;
//         s.groups.forEach((g) => {
//           const story = g.stories.find((st) => st._id === storyId);
//           if (story) story._viewed = true;
//         });
//       })

//       // delete
//       .addCase(deleteStory.fulfilled, (s, a) => {
//         const storyId = a.payload;
//         s.groups = s.groups
//           .map((g) => ({ ...g, stories: g.stories.filter((st) => st._id !== storyId) }))
//           .filter((g) => g.stories.length > 0);
//       });
//   },
// });

// export default storySlice.reducer;



import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchStories = createAsyncThunk("story/fetchAll", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/stories");
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed to fetch stories");
  }
});

export const uploadStory = createAsyncThunk("story/upload", async (formData, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/stories", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.story;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Upload failed");
  }
});

export const markStoryViewed = createAsyncThunk("story/markViewed", async (storyId, { rejectWithValue }) => {
  try {
    await api.put(`/stories/${storyId}/view`);
    return storyId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Failed");
  }
});

export const deleteStory = createAsyncThunk("story/delete", async (storyId, { rejectWithValue }) => {
  try {
    await api.delete(`/stories/${storyId}`);
    return storyId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || "Delete failed");
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const storySlice = createSlice({
  name: "story",
  initialState: {
    groups: [],
    loading: false,
    uploading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStories.pending, (s) => { s.loading = true; s.error = null; })
      .addCase(fetchStories.fulfilled, (s, a) => { s.loading = false; s.groups = a.payload; })
      .addCase(fetchStories.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

      .addCase(uploadStory.pending, (s) => { s.uploading = true; })
      .addCase(uploadStory.fulfilled, (s, a) => {
        s.uploading = false;
        const newStory = a.payload;
        const uid = newStory.user._id;
        const idx = s.groups.findIndex((g) => g.user._id === uid);
        if (idx !== -1) {
          s.groups[idx].stories.unshift(newStory);
        } else {
          s.groups.unshift({ user: newStory.user, stories: [newStory], hasUnread: false });
        }
      })
      .addCase(uploadStory.rejected, (s) => { s.uploading = false; })

      .addCase(markStoryViewed.fulfilled, (s, a) => {
        const storyId = a.payload;
        s.groups.forEach((g) => {
          const story = g.stories.find((st) => st._id === storyId);
          if (story) story._viewed = true;
        });
      })

      .addCase(deleteStory.fulfilled, (s, a) => {
        const storyId = a.payload;
        s.groups = s.groups
          .map((g) => ({ ...g, stories: g.stories.filter((st) => st._id !== storyId) }))
          .filter((g) => g.stories.length > 0);
      });
  },
});

export default storySlice.reducer;