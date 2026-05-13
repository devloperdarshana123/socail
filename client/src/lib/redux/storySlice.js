import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

// ─────────────────────────────────────────────
//  Async Thunks
// ─────────────────────────────────────────────

export const fetchStoriesFeed = createAsyncThunk(
  "stories/fetchFeed",
  async (_, { rejectWithValue }) => {
    try {
     const { data } = await api.get("/stories/feed");
return (data.feed || []).map((group) => ({
  ...group,
  stories: group.stories.map((story) => {
    if (story.media?.resourceType === "video" && story.media?.thumbnailUrl) {
      const t = story.media.thumbnailUrl;
      return {
        ...story,
        media: {
          ...story.media,
          thumbnailUrl: t.includes("f_jpg") ? t
            : t.replace("/upload/so_0/", "/upload/so_0,f_jpg/")
               .replace(/\.(mp4|webm|mov|avi)$/, ".jpg"),
        },
      };
    }
    return story;
  }),
}));
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch stories");
    }
  }
);

export const fetchMyHighlights = createAsyncThunk(
  "stories/fetchMyHighlights",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/stories/highlights/my");
      return data.highlights || [];
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch highlights");
    }
  }
);

export const createStory = createAsyncThunk(
  "stories/createStory",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/stories", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.story;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to create story");
    }
  }
);

export const createTextStory = createAsyncThunk(
  "stories/createTextStory",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/stories/text", payload);
      return data.story;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to create text story");
    }
  }
);

export const viewStory = createAsyncThunk(
  "stories/viewStory",
  async (storyId, { rejectWithValue }) => {
    try {
      await api.post(`/stories/${storyId}/view`);
      return storyId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to record view");
    }
  }
);

export const reactToStory = createAsyncThunk(
  "stories/reactToStory",
  async ({ storyId, reaction }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/stories/${storyId}/react`, { reaction });
      return { storyId, reaction, reactionsCount: data.reactionsCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to react");
    }
  }
);

export const toggleStoryLike = createAsyncThunk(
  "stories/toggleLike",
  async (storyId, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/stories/${storyId}/like`);
      return { storyId, liked: data.liked, reactionsCount: data.reactionsCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to like");
    }
  }
);

export const deleteStory = createAsyncThunk(
  "stories/deleteStory",
  async (storyId, { rejectWithValue }) => {
    try {
      await api.delete(`/stories/${storyId}`);
      return storyId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete story");
    }
  }
);

export const fetchStoryViewers = createAsyncThunk(
  "stories/fetchViewers",
  async (storyId, { rejectWithValue }) => {
    try {
      const { data } = await api.get(`/stories/${storyId}/viewers`);
      return { storyId, viewers: data.viewers, viewsCount: data.viewsCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch viewers");
    }
  }
);

export const createHighlight = createAsyncThunk(
  "stories/createHighlight",
  async ({ title, storyIds }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/stories/highlights", { title, storyIds });
      return data.highlight;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to create highlight");
    }
  }
);

export const addToHighlight = createAsyncThunk(
  "stories/addToHighlight",
  async ({ highlightId, storyId }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/stories/highlights/${highlightId}/add`, { storyId });
      return { highlightId, highlight: data.highlight, removed: data.removed };
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to add to highlight"
      );
    }
  }
);

export const deleteHighlight = createAsyncThunk(
  "stories/deleteHighlight",
  async (highlightId, { rejectWithValue }) => {
    try {
      await api.delete(`/stories/highlights/${highlightId}`);
      return highlightId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to delete highlight");
    }
  }
);

// ─────────────────────────────────────────────
//  Slice
// ─────────────────────────────────────────────
const storySlice = createSlice({
  name: "stories",
  initialState: {
    feed:            [],   // [{author, stories, hasUnwatched}]
    highlights:      [],
    viewers:         {},   // { storyId: { viewers, viewsCount } }
    feedLoading:     false,
    highlightLoading:false,
    storyUploading:  false,
    viewersLoading:  false,
    error:           null,
  },

  reducers: {
    // Optimistic like toggle
    optimisticLike(state, { payload: { storyId, liked } }) {
      state.feed.forEach((group) => {
        const story = group.stories.find((s) => s._id === storyId);
        if (story) {
         story.isLiked = liked;
story.reactionsCount = liked
  ? (story.reactionsCount || 0) + 1
  : Math.max(0, (story.reactionsCount || 0) - 1);
        }
      });
    },

    // Story delete optimistic
    removeStoryFromFeed(state, { payload: storyId }) {
      state.feed = state.feed
        .map((g) => ({ ...g, stories: g.stories.filter((s) => s._id !== storyId) }))
        .filter((g) => g.stories.length > 0);
    },

    clearStoryError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // ── Fetch Feed ──
    builder
      .addCase(fetchStoriesFeed.pending, (state) => {
        state.feedLoading = true;
        state.error = null;
      })
      .addCase(fetchStoriesFeed.fulfilled, (state, { payload }) => {
        state.feedLoading = false;
        state.feed = payload;
      })
      .addCase(fetchStoriesFeed.rejected, (state, { payload }) => {
        state.feedLoading = false;
        state.error = payload;
      });

    // ── Fetch Highlights ──
    builder
      .addCase(fetchMyHighlights.pending, (state) => {
        state.highlightLoading = true;
      })
      .addCase(fetchMyHighlights.fulfilled, (state, { payload }) => {
        state.highlightLoading = false;
        state.highlights = payload;
      })
      .addCase(fetchMyHighlights.rejected, (state, { payload }) => {
        state.highlightLoading = false;
        state.error = payload;
      });

    // ── Create Story (media) ──
    builder
      .addCase(createStory.pending, (state) => {
        state.storyUploading = true;
      })
      .addCase(createStory.fulfilled, (state, { payload }) => {
        state.storyUploading = false;
        // Feed refresh fetchStoriesFeed se hoga — yahan sirf flag reset
      })
      .addCase(createStory.rejected, (state, { payload }) => {
        state.storyUploading = false;
        state.error = payload;
      });

    // ── Create Text Story ──
    builder
      .addCase(createTextStory.pending, (state) => {
        state.storyUploading = true;
      })
      .addCase(createTextStory.fulfilled, (state) => {
        state.storyUploading = false;
      })
      .addCase(createTextStory.rejected, (state, { payload }) => {
        state.storyUploading = false;
        state.error = payload;
      });

    // ── Delete Story ──
    builder.addCase(deleteStory.fulfilled, (state, { payload: storyId }) => {
      state.feed = state.feed
        .map((g) => ({ ...g, stories: g.stories.filter((s) => s._id !== storyId) }))
        .filter((g) => g.stories.length > 0);
    });

    // ── Toggle Like — server sync ──
    builder.addCase(toggleStoryLike.fulfilled, (state, { payload }) => {
      const { storyId, liked, reactionsCount } = payload;
      state.feed.forEach((group) => {
        const story = group.stories.find((s) => s._id === storyId);
       if (story) {
  story.isLiked = liked;
  story.reactionsCount = reactionsCount;
}
      });
    });

    // ── Fetch Viewers ──
    builder
      .addCase(fetchStoryViewers.pending, (state) => {
        state.viewersLoading = true;
      })
      .addCase(fetchStoryViewers.fulfilled, (state, { payload }) => {
        state.viewersLoading = false;
        state.viewers[payload.storyId] = {
          viewers:    payload.viewers,
          viewsCount: payload.viewsCount,
        };
      })
      .addCase(fetchStoryViewers.rejected, (state) => {
        state.viewersLoading = false;
      });

    // ── Create Highlight ──
    builder.addCase(createHighlight.fulfilled, (state, { payload }) => {
      state.highlights.unshift(payload);
    });

    // ── Add to Highlight ──
    builder.addCase(addToHighlight.fulfilled, (state, { payload }) => {
      const idx = state.highlights.findIndex((h) => h._id === payload.highlightId);
      if (idx > -1) state.highlights[idx] = payload.highlight;
    });

    // ── Delete Highlight ──
    builder.addCase(deleteHighlight.fulfilled, (state, { payload: highlightId }) => {
      state.highlights = state.highlights.filter((h) => h._id !== highlightId);
    });
  },
});

export const { optimisticLike, removeStoryFromFeed, clearStoryError } = storySlice.actions;
export default storySlice.reducer;