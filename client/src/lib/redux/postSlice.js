
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

// ── Helper: normalize _id → id (MongoDB → Prisma migration) ──
const norm = (p) => {
  if (!p) return p;
  return { ...p, id: p.id ?? p._id };
};
const normArr = (arr) => (Array.isArray(arr) ? arr.map(norm) : []);

export const createPost = createAsyncThunk(
  "posts/create",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await api.post("/posts", formData, {
        headers: { "Content-Type": "application/json" },
      });
      return norm(res.data.post);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Post create nahi ho saka");
    }
  }
);

// ── Initial load ──
export const fetchMyPosts = createAsyncThunk(
  "posts/fetchMyPosts",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/posts/user/${userId}?limit=18`);
      return {
        posts:      normArr(res.data.data ?? []),
        postsCount: res.data.postsCount ?? null,
        hasMore:    res.data.hasMore    ?? false,
        nextCursor: res.data.nextCursor ?? null,
        append:     false,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Posts fetch nahi hue");
    }
  }
);

// ── Load more (infinite scroll) ──
export const fetchMoreMyPosts = createAsyncThunk(
  "posts/fetchMoreMyPosts",
  async ({ userId, cursor }, { rejectWithValue }) => {
    try {
      const res = await api.get(`/posts/user/${userId}?limit=18&beforeId=${cursor}`);
      return {
        posts:      normArr(res.data.data ?? []),
        hasMore:    res.data.hasMore    ?? false,
        nextCursor: res.data.nextCursor ?? null,
        append:     true,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "More posts fetch nahi hue");
    }
  }
);

export const togglePostLike = createAsyncThunk(
  "posts/toggleLike",
  async ({ postId, postAuthorId = null }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/likes/post/${postId}`);
      const { liked, likesCount } = res.data;
      return { postId, liked, likesCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Like failed");
    }
  }
);

export const fetchComments = createAsyncThunk(
  "posts/fetchComments",
  async ({ postId, afterId = null, afterDate = null }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (afterId)   params.set("afterId",   afterId);
      if (afterDate) params.set("afterDate", afterDate);
      const res = await api.get(`/comments/post/${postId}?${params}`);
      return {
        postId,
        comments:   Array.isArray(res.data.data) ? res.data.data : [],
        nextCursor: res.data.nextCursor ?? null,
        hasMore:    res.data.hasMore    ?? false,
        append:     !!afterId,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Comments fetch nahi hue");
    }
  }
);

export const addComment = createAsyncThunk(
  "posts/addComment",
  async ({ postId, content, parentCommentId = null, postAuthorId = null }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/comments/post/${postId}`, { content, parentCommentId });
      const comment = res.data.data;

      if (parentCommentId && postAuthorId) {
        try {
          const { getSocket } = await import("../services/socketManager");
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("send_reply", {
              to: postAuthorId,
              postId,
              commentId: comment.id ?? comment._id,
              preview: content.slice(0, 100),
            });
          }
        } catch (socketErr) {
          console.warn("Socket emit failed (non-critical):", socketErr.message);
        }
      }

      return { postId, comment, commentsCount: res.data.commentsCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Comment add nahi hua");
    }
  }
);

export const toggleSavePost = createAsyncThunk(
  "posts/toggleSave",
  async (postId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/saved/${postId}`);
      return { postId, saved: res.data.saved, savedCount: res.data.savedCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Save failed");
    }
  }
);

export const fetchSavedPosts = createAsyncThunk(
  "posts/fetchSavedPosts",
  async ({ beforeId } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams({ limit: 12 });
      if (beforeId) params.set("beforeId", beforeId);
      const res = await api.get(`/saved?${params}`);
      return {
        items:      Array.isArray(res.data.data) ? res.data.data : [],
        hasMore:    res.data.pagination?.hasMore    ?? false,
        nextCursor: res.data.pagination?.nextCursor ?? null,
        append:     !!beforeId,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Saved posts fetch nahi hue");
    }
  }
);

export const fetchPostInteraction = createAsyncThunk(
  "posts/fetchInteraction",
  async (postId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/posts/${postId}/interaction`);
      return { 
        postId, 
        liked: res.data.liked, 
        saved: res.data.saved,
        likesCount: res.data.likesCount,
        commentsCount: res.data.commentsCount,
        viewsCount: res.data.viewsCount,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Interaction fetch failed");
    }
  }
);

export const recordPostView = createAsyncThunk(
  "posts/recordView",
  async ({ postId, source = "modal", duration = 0 }, { rejectWithValue }) => {
    try {
      const res = await api.post(`/posts/${postId}/view`, { source, duration });
      return { postId, viewsCount: res.data.viewsCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "View record failed");
    }
  }
);

export const deletePost = createAsyncThunk(
  "posts/deletePost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.delete(`/posts/${postId}`);
      return postId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Delete failed");
    }
  }
);

export const fetchDraftPosts = createAsyncThunk(
  "posts/fetchDrafts",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/posts/drafts");
  
      return normArr(res.data.posts);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Drafts fetch nahi hue");
    }
  }
);

export const updateDraft = createAsyncThunk(
  "posts/updateDraft",
  async ({ postId, caption, media }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/posts/${postId}`, { caption, media });
      return { postId, post: norm(res.data.post) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Draft update failed");
    }
  }
);

export const publishDraftPost = createAsyncThunk(
  "posts/publishDraft",
  async (postId, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/posts/${postId}/publish`);
      return { postId, post: norm(res.data.post) };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Publish failed");
    }
  }
);

// ─────────────────────────────────────────────
// Helper: match by id OR _id
const matchId = (p, id) => (p.id ?? p._id) === id;

const postSlice = createSlice({
  name: "posts",
  initialState: {
    feed: [],
    myPosts: [],
    myPostsHasMore:    false,
    myPostsNextCursor: null,
    myPostsLoadingMore: false,
    savedPosts: [],
    myPostsLoading: false,
    savedPostsLoading: false,
    draftPosts: [],
    draftPostsLoading: false,
    myPostsError: null,
    creating: false,
    savedPostsHasMore:    false,
    savedPostsNextCursor: null,
    createError: null,
    serverPostsCount: null,
    interactions: {},
  },

  reducers: {
    prependPost(state, action) {
      const post = norm(action.payload);
      state.feed.unshift(post);
      state.myPosts.unshift(post);
    },

   initInteraction(state, action) {
  const { postId, liked, likesCount, saved, commentsCount } = action.payload;
  const existing = state.interactions[postId];
  state.interactions[postId] = {
    comments:            [],
    commentsLoading:     false,
    commentsLoadingMore: false,
    commentsHasMore:     false,
    commentsNextCursor:  null,
    commentAdding:       false,
    ...existing,
    liked:         liked         ?? existing?.liked         ?? false,
    likesCount:    likesCount    ?? existing?.likesCount    ?? 0,
    saved:         saved         ?? existing?.saved         ?? false,
    commentsCount: commentsCount ?? existing?.commentsCount ?? 0,
  };
},
  },

  extraReducers: (builder) => {
    // ── createPost ──
    builder
      .addCase(createPost.pending,  (state) => { state.creating = true; state.createError = null; })
      .addCase(createPost.fulfilled, (state, action) => {
        state.creating = false;
        if (!action.payload) return;
        if (action.payload.isDraft) {
          state.draftPosts.unshift(action.payload);
        } else {
          state.feed.unshift(action.payload);
          if (state.serverPostsCount !== null) state.serverPostsCount += 1;
        }
      })
      .addCase(createPost.rejected, (state, action) => { state.creating = false; state.createError = action.payload; });

    // ── fetchMyPosts ──
    builder
      .addCase(fetchMyPosts.pending, (state) => { state.myPostsLoading = true; })
      .addCase(fetchMyPosts.fulfilled, (state, action) => {
        state.myPostsLoading = false;
        const incoming = action.payload.posts;
        const incomingIds = new Set(incoming.map((p) => p.id));
        const localOnly = state.myPosts.filter((p) => !incomingIds.has(p.id ?? p._id));
        state.myPosts           = [...localOnly, ...incoming];
        state.myPostsHasMore    = action.payload.hasMore    ?? false;
        state.myPostsNextCursor = action.payload.nextCursor ?? null;
        if (action.payload.postsCount !== null) state.serverPostsCount = action.payload.postsCount;
      })
      .addCase(fetchMyPosts.rejected, (state, action) => {
        state.myPostsLoading = false;
        state.myPostsError   = action.payload;
      });

    // ── fetchMoreMyPosts ──
    builder
      .addCase(fetchMoreMyPosts.pending,  (state) => { state.myPostsLoadingMore = true; })
      .addCase(fetchMoreMyPosts.fulfilled, (state, action) => {
        state.myPostsLoadingMore = false;
        state.myPosts           = [...state.myPosts, ...action.payload.posts];
        state.myPostsHasMore    = action.payload.hasMore    ?? false;
        state.myPostsNextCursor = action.payload.nextCursor ?? null;
      })
      .addCase(fetchMoreMyPosts.rejected, (state) => { state.myPostsLoadingMore = false; });

    // ── togglePostLike ──
    builder
      .addCase(togglePostLike.pending, (state, action) => {
        const { postId } = action.meta.arg;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        const ix = state.interactions[postId];
        ix.liked = !ix.liked;
        ix.likesCount = (ix.likesCount || 0) + (ix.liked ? 1 : -1);
      })
      .addCase(togglePostLike.fulfilled, (state, action) => {
        const { postId, liked, likesCount } = action.payload;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        state.interactions[postId].liked      = liked;
        state.interactions[postId].likesCount = likesCount;
      })
      .addCase(togglePostLike.rejected, (state, action) => {
        const { postId } = action.meta.arg;
        if (!state.interactions[postId]) return;
        const ix = state.interactions[postId];
        ix.liked      = !ix.liked;
        ix.likesCount = (ix.likesCount || 0) + (ix.liked ? 1 : -1);
      });

    // ── fetchComments ──
    builder
      .addCase(fetchComments.pending, (state, action) => {
        const { postId, afterId } = action.meta.arg;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        if (afterId) state.interactions[postId].commentsLoadingMore = true;
        else         state.interactions[postId].commentsLoading     = true;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        const { postId, comments, nextCursor, hasMore, append } = action.payload;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        const ix = state.interactions[postId];
        if (append) {
          ix.comments            = [...(ix.comments ?? []), ...comments];
          ix.commentsLoadingMore = false;
        } else {
          ix.comments        = comments;
          ix.commentsLoading = false;
        }
        ix.commentsHasMore    = hasMore;
        ix.commentsNextCursor = nextCursor;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        const { postId, afterId } = action.meta.arg;
        if (!state.interactions[postId]) return;
        if (afterId) state.interactions[postId].commentsLoadingMore = false;
        else         state.interactions[postId].commentsLoading     = false;
      });

    // ── recordPostView ──
builder.addCase(recordPostView.fulfilled, (state, action) => {
  const { postId, viewsCount } = action.payload;
  if (!state.interactions[postId]) state.interactions[postId] = {};
  state.interactions[postId].viewsCount = viewsCount;
});

builder.addCase(recordPostView.rejected, (state, action) => {
  const { postId } = action.meta.arg;
  console.error("View record failed:", action.payload);
});

    // ── addComment ──
    builder
      .addCase(addComment.pending, (state, action) => {
        const postId = action.meta.arg.postId;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        state.interactions[postId].commentAdding = true;
      })
      .addCase(addComment.fulfilled, (state, action) => {
        const { postId, comment, commentsCount } = action.payload;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        if (!Array.isArray(state.interactions[postId].comments)) {
          state.interactions[postId].comments = [];
        }
        state.interactions[postId].comments.unshift(comment);
        state.interactions[postId].commentsCount = commentsCount;
        state.interactions[postId].commentAdding = false;
      })
      .addCase(addComment.rejected, (state, action) => {
        const postId = action.meta.arg.postId;
        if (state.interactions[postId]) {
          state.interactions[postId].commentAdding = false;
          state.interactions[postId].commentsCount = 
            Math.max(0, (state.interactions[postId].commentsCount || 0) - 1);
        }
      });
     
    // ── toggleSavePost ──
    builder
      .addCase(toggleSavePost.pending, (state, action) => {
        const postId = action.meta.arg;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        state.interactions[postId].saved = !state.interactions[postId].saved;
      })
      .addCase(toggleSavePost.fulfilled, (state, action) => {
        const { postId, saved, savedCount } = action.payload;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        state.interactions[postId].saved = saved;
        if (savedCount !== undefined) state.interactions[postId].savedCount = savedCount;
        if (!saved) {
          state.savedPosts = state.savedPosts.filter((p) => {
            const id = p?.post?.id ?? p?.post?._id ?? p?.id ?? p?._id;
            return id !== postId;
          });
        }
      })
      .addCase(toggleSavePost.rejected, (state, action) => {
        const postId = action.meta.arg;
        if (!state.interactions[postId]) return;
        state.interactions[postId].saved = !state.interactions[postId].saved;
      });

    // ── fetchPostInteraction ──
    builder.addCase(fetchPostInteraction.fulfilled, (state, action) => {
  const { postId, liked, saved, likesCount, commentsCount, viewsCount } = action.payload;
  if (!state.interactions[postId]) state.interactions[postId] = {};
  state.interactions[postId].liked = liked ?? false;
  state.interactions[postId].saved = saved ?? false;
  if (likesCount !== undefined) state.interactions[postId].likesCount = likesCount;
  if (commentsCount !== undefined) state.interactions[postId].commentsCount = commentsCount;
  if (viewsCount !== undefined) state.interactions[postId].viewsCount = viewsCount;
});

    // ── fetchSavedPosts ──
    builder
      .addCase(fetchSavedPosts.pending,   (state) => { state.savedPostsLoading = true; })
      .addCase(fetchSavedPosts.fulfilled, (state, action) => {
        state.savedPostsLoading = false;
        const posts = action.payload.items.map((s) => norm(s.post)).filter(Boolean);
        if (action.payload.append) state.savedPosts = [...state.savedPosts, ...posts];
        else                       state.savedPosts = posts;
        state.savedPostsHasMore    = action.payload.hasMore;
        state.savedPostsNextCursor = action.payload.nextCursor;
      })
      .addCase(fetchSavedPosts.rejected, (state) => { state.savedPostsLoading = false; });

    // ── deletePost ──
    builder.addCase(deletePost.fulfilled, (state, action) => {
      const postId = action.payload;
      const wasPublished = state.myPosts.some((p) => matchId(p, postId));
      state.myPosts    = state.myPosts.filter((p)    => !matchId(p, postId));
      state.feed       = state.feed.filter((p)       => !matchId(p, postId));
      state.draftPosts = state.draftPosts.filter((p) => !matchId(p, postId));
      delete state.interactions[postId];
      if (wasPublished && state.serverPostsCount !== null) {
        state.serverPostsCount = Math.max(0, state.serverPostsCount - 1);
      }
    });

    // ── fetchDraftPosts ──
    builder
      .addCase(fetchDraftPosts.pending,   (state) => { state.draftPostsLoading = true; })
      .addCase(fetchDraftPosts.fulfilled, (state, action) => {
        state.draftPostsLoading = false;
        state.draftPosts = action.payload;
      })
      .addCase(fetchDraftPosts.rejected,  (state) => { state.draftPostsLoading = false; });

    // ── publishDraftPost ──
    builder.addCase(publishDraftPost.fulfilled, (state, action) => {
      const { postId, post } = action.payload;
      state.draftPosts = state.draftPosts.filter((p) => !matchId(p, postId));
      if (post) {
        state.myPosts.unshift(post);
        state.feed.unshift(post);
        if (state.serverPostsCount !== null) state.serverPostsCount += 1;
      }
    });

    // ── updateDraft ──
    builder.addCase(updateDraft.fulfilled, (state, action) => {
      const { postId, post } = action.payload;
      const idx = state.draftPosts.findIndex((p) => matchId(p, postId));
      if (idx !== -1) state.draftPosts[idx] = post;
    });
  },
});

export const { prependPost, initInteraction } = postSlice.actions;
export default postSlice.reducer;