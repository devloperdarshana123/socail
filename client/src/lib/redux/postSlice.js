
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../services/api";

export const createPost = createAsyncThunk(
  "posts/create",
  async (formData, { rejectWithValue }) => {
    try {
     const res = await api.post("/posts", formData, {
  headers: { "Content-Type": "application/json" },
      });
      return res.data.post;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Post create nahi ho saka");
    }
  }
);

// export const fetchMyPosts = createAsyncThunk(
//   "posts/fetchMyPosts",
//   async (userId, { rejectWithValue }) => {
//     try {
//       const res = await api.get(`/posts/user/${userId}?limit=500`);
//       return {
//         posts:      res.data.data || res.data.posts || [],
//         postsCount: res.data.postsCount ?? null,
//       };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Posts fetch nahi hue");
//     }
//   }
// );

// ── Toggle like ──
// Socket emit NAHI — main server like.controller → notifyChat("/notify/like") se notification jaati hai

// PURANA fetchMyPosts hatao, ye dono add karo

// ── Initial load ──
export const fetchMyPosts = createAsyncThunk(
  "posts/fetchMyPosts",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`/posts/user/${userId}?limit=18`);
      return {
        posts:      res.data.data      ?? [],
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
        posts:      res.data.data      ?? [],
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

// export const fetchComments = createAsyncThunk(

//   "posts/fetchComments",
//   async ({ postId, page = 1 }, { rejectWithValue }) => {
//     try {
//     const res = await api.get(`/comments/post/${postId}?limit=20`);
// return { postId, comments: res.data.data, nextCursor: res.data.nextCursor };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Comments fetch nahi hue");
//     }
//   }
// );

// ── Add comment ──
// Socket emit NAHI — main server comment.controller → notifyChat("/notify/comment") se notification jaati hai
// Reply ke liye socket "send_reply" emit hota hai notificationHandler.js mein kyunki
// HTTP route /notify/reply nahi hai — woh socket se handle hota hai


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

      // Sirf reply ke liye socket emit — comment notification HTTP route se aati hai
      // Reply ka koi HTTP route nahi isliye socket se bhejte hain
      if (parentCommentId && postAuthorId) {
        try {
          const { getSocket } = await import("../services/socketManager");
          const socket = getSocket();
          if (socket?.connected) {
            socket.emit("send_reply", {
              to: postAuthorId,
              postId,
              commentId: comment._id,
              preview: content.slice(0, 100),
            });
          }
        } catch (socketErr) {
          console.warn("Socket emit failed (non-critical):", socketErr.message);
        }
      }

      return { postId, comment };
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
      return { postId, liked: res.data.liked, saved: res.data.saved };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Interaction fetch failed");
    }
  }
);

// export const recordPostView = createAsyncThunk(
//   "posts/recordView",
//   async (postId, { rejectWithValue }) => {
//     try {
//       await api.post(`/posts/${postId}/view`);
//       return postId;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "View record failed");
//     }
//   }
// );


export const recordPostView = createAsyncThunk(
  "posts/recordView",
  async ({ postId, source = "modal", duration = 0 }, { rejectWithValue }) => {
    try {
      await api.post(`/posts/${postId}/view`, { source, duration });
      return postId;
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
      return res.data.posts;
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
      return { postId, post: res.data.post };
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
      return { postId, post: res.data.post };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Publish failed");
    }
  }
);

// ─────────────────────────────────────────────
const postSlice = createSlice({
  name: "posts",
  initialState: {
    feed: [],
    myPosts: [],
     myPostsHasMore:    false,   // ← ADD
  myPostsNextCursor: null,    // ← ADD
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
      state.feed.unshift(action.payload);
      state.myPosts.unshift(action.payload);
    },
    // initInteraction(state, action) {
    //   const { postId, liked, likesCount, saved, commentsCount } = action.payload;
    //   if (!state.interactions[postId]) {
    //     state.interactions[postId] = {
    //       liked: liked ?? false,
    //       likesCount: likesCount ?? 0,
    //       saved: saved ?? false,
    //       commentsCount: commentsCount ?? 0,
    //       comments: [],
    //       commentsLoading: false,
    //       commentAdding: false,
    //     };
    //   }
    // },

    initInteraction(state, action) {
  const { postId, liked, likesCount, saved, commentsCount } = action.payload;
  if (!state.interactions[postId]) {
    state.interactions[postId] = {
      liked:               liked         ?? false,
      likesCount:          likesCount    ?? 0,
      saved:               saved         ?? false,
      commentsCount:       commentsCount ?? 0,
      comments:            [],
      commentsLoading:     false,
      commentsLoadingMore: false,
      commentsHasMore:     false,
      commentsNextCursor:  null,
      commentAdding:       false,
    };
  }
},
  },

  extraReducers: (builder) => {
    builder
      .addCase(createPost.pending,    (state) => { state.creating = true; state.createError = null; })
      .addCase(createPost.fulfilled, (state, action) => {
  state.creating = false;
  if (!action.payload) return;
  if (action.payload.isDraft) {
    // Draft: only goes into draftPosts, never feed/grid
    state.draftPosts.unshift(action.payload);
 } else {
    // Published post: goes into feed and profile grid
    state.feed.unshift(action.payload);
    // ✅ FIX: count increment
    if (state.serverPostsCount !== null) {
      state.serverPostsCount += 1;
    }
  }
})
      .addCase(createPost.rejected,   (state, action) => { state.creating = false; state.createError = action.payload; });
// NAYA — replace karo
builder
  .addCase(fetchMyPosts.pending, (state) => {
    state.myPostsLoading = true;
  })
  // .addCase(fetchMyPosts.fulfilled, (state, action) => {
  //   state.myPostsLoading    = false;
  //   state.myPosts           = Array.isArray(action.payload.posts) ? action.payload.posts : [];
  //   state.myPostsHasMore    = action.payload.hasMore    ?? false;
  //   state.myPostsNextCursor = action.payload.nextCursor ?? null;
  //   if (action.payload.postsCount !== null) {
  //     state.serverPostsCount = action.payload.postsCount;
  //   }
  // })
  .addCase(fetchMyPosts.fulfilled, (state, action) => {
  state.myPostsLoading = false;
  const incoming = Array.isArray(action.payload.posts) ? action.payload.posts : [];
  const incomingIds = new Set(incoming.map((p) => p._id));

  // Jo posts locally hain but server pe nahi aaye (naye posts) unhe rakho
  const localOnly = state.myPosts.filter((p) => !incomingIds.has(p._id));

  state.myPosts = [...localOnly, ...incoming];
  state.myPostsHasMore    = action.payload.hasMore    ?? false;
  state.myPostsNextCursor = action.payload.nextCursor ?? null;
  if (action.payload.postsCount !== null) {
    state.serverPostsCount = action.payload.postsCount;
  }
})
  .addCase(fetchMyPosts.rejected, (state, action) => {
    state.myPostsLoading = false;
    state.myPostsError   = action.payload;
  });

builder
  .addCase(fetchMoreMyPosts.pending, (state) => {
    state.myPostsLoadingMore = true;
  })
  .addCase(fetchMoreMyPosts.fulfilled, (state, action) => {
    state.myPostsLoadingMore = false;
    state.myPosts = [
      ...state.myPosts,
      ...(Array.isArray(action.payload.posts) ? action.payload.posts : []),
    ];
    state.myPostsHasMore    = action.payload.hasMore    ?? false;
    state.myPostsNextCursor = action.payload.nextCursor ?? null;
  })
  .addCase(fetchMoreMyPosts.rejected, (state) => {
    state.myPostsLoadingMore = false;
  });

    // builder.addCase(togglePostLike.fulfilled, (state, action) => {
    //   const { postId, liked, likesCount } = action.payload;
    //   if (!state.interactions[postId]) state.interactions[postId] = {};
    //   state.interactions[postId].liked = liked;
    //   state.interactions[postId].likesCount = likesCount;
    // });


    builder
  .addCase(togglePostLike.pending, (state, action) => {
    const { postId } = action.meta.arg;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    const ix = state.interactions[postId];
    // ✅ Pehle UI update karo
    ix.liked = !ix.liked;
    ix.likesCount = (ix.likesCount || 0) + (ix.liked ? 1 : -1);
  })
  .addCase(togglePostLike.fulfilled, (state, action) => {
    const { postId, liked, likesCount } = action.payload;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    // ✅ Server se sahi value set karo
    state.interactions[postId].liked = liked;
    state.interactions[postId].likesCount = likesCount;
  })
  .addCase(togglePostLike.rejected, (state, action) => {
    const { postId } = action.meta.arg;
    if (!state.interactions[postId]) return;
    const ix = state.interactions[postId];
    // ✅ Fail hone pe revert karo
    ix.liked = !ix.liked;
    ix.likesCount = (ix.likesCount || 0) + (ix.liked ? 1 : -1);
  });

builder
  .addCase(fetchComments.pending, (state, action) => {
    const { postId, afterId } = action.meta.arg;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    if (afterId) {
      state.interactions[postId].commentsLoadingMore = true;
    } else {
      state.interactions[postId].commentsLoading = true;
    }
  })
  .addCase(fetchComments.fulfilled, (state, action) => {
    const { postId, comments, nextCursor, hasMore, append } = action.payload;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    const ix = state.interactions[postId];
    if (append) {
      ix.comments              = [...(ix.comments ?? []), ...comments];
      ix.commentsLoadingMore   = false;
    } else {
      ix.comments              = comments;
      ix.commentsLoading       = false;
    }
    ix.commentsHasMore         = hasMore;
    ix.commentsNextCursor      = nextCursor;
  })
  .addCase(fetchComments.rejected, (state, action) => {
    const { postId, afterId } = action.meta.arg;
    if (!state.interactions[postId]) return;
    if (afterId) {
      state.interactions[postId].commentsLoadingMore = false;
    } else {
      state.interactions[postId].commentsLoading     = false;
    }
  });

    builder.addCase(recordPostView.fulfilled, (state, action) => {
      const postId = action.payload;
      if (state.interactions[postId]) {
        state.interactions[postId].viewsCount = (state.interactions[postId].viewsCount || 0) + 1;
      }
    });

    builder
      .addCase(addComment.pending, (state, action) => {
        const postId = action.meta.arg.postId;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        state.interactions[postId].commentAdding = true;
      })
      .addCase(addComment.fulfilled, (state, action) => {
        const { postId, comment } = action.payload;
        if (!state.interactions[postId]) state.interactions[postId] = {};
        if (!Array.isArray(state.interactions[postId].comments)) {
  state.interactions[postId].comments = [];
}
state.interactions[postId].comments.unshift(comment);
        state.interactions[postId].commentsCount = (state.interactions[postId].commentsCount || 0) + 1;
        state.interactions[postId].commentAdding = false;
      })
      .addCase(addComment.rejected, (state, action) => {
        const postId = action.meta.arg.postId;
        if (state.interactions[postId]) state.interactions[postId].commentAdding = false;
      });
builder
  .addCase(toggleSavePost.pending, (state, action) => {
    const postId = action.meta.arg;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    // ✅ Pehle UI update karo
    state.interactions[postId].saved = !state.interactions[postId].saved;
  })
  .addCase(toggleSavePost.fulfilled, (state, action) => {
    const { postId, saved, savedCount } = action.payload;
    if (!state.interactions[postId]) state.interactions[postId] = {};
    state.interactions[postId].saved = saved;
    if (savedCount !== undefined) state.interactions[postId].savedCount = savedCount;
    if (!saved) state.savedPosts = state.savedPosts.filter((p) => {
      const id = p?.post?._id || p?._id;
      return id !== postId;
    });
  })
  .addCase(toggleSavePost.rejected, (state, action) => {
    const postId = action.meta.arg;
    if (!state.interactions[postId]) return;
    // ✅ Fail hone pe revert karo
    state.interactions[postId].saved = !state.interactions[postId].saved;
  });
//    builder.addCase(toggleSavePost.fulfilled, (state, action) => {
//   const { postId, saved, savedCount } = action.payload;
//   if (!state.interactions[postId]) state.interactions[postId] = {};
//   state.interactions[postId].saved = saved;
//   if (savedCount !== undefined) state.interactions[postId].savedCount = savedCount;
//   if (!saved) state.savedPosts = state.savedPosts.filter((p) => {
//     const id = p?.post?._id || p?._id;
//     return id !== postId;
//   });
// });

    builder.addCase(fetchPostInteraction.fulfilled, (state, action) => {
      const { postId, liked, saved } = action.payload;
      if (!state.interactions[postId]) state.interactions[postId] = {};
      state.interactions[postId].liked = liked ?? false;
      state.interactions[postId].saved = saved ?? false;
    });

 builder
  .addCase(fetchSavedPosts.pending,   (state) => { state.savedPostsLoading = true; })
  .addCase(fetchSavedPosts.fulfilled, (state, action) => {
    state.savedPostsLoading = false;
    const posts = action.payload.items.map((s) => s.post).filter(Boolean);
    if (action.payload.append) {
      state.savedPosts = [...state.savedPosts, ...posts];
    } else {
      state.savedPosts = posts;
    }
    state.savedPostsHasMore   = action.payload.hasMore;
    state.savedPostsNextCursor = action.payload.nextCursor;
  })
  .addCase(fetchSavedPosts.rejected, (state) => { state.savedPostsLoading = false; });

   builder.addCase(deletePost.fulfilled, (state, action) => {
  const postId = action.payload;
  const wasPublished = state.myPosts.some((p) => p._id === postId);
  state.myPosts    = state.myPosts.filter((p) => p._id !== postId);
  state.feed       = state.feed.filter((p) => p._id !== postId);
  state.draftPosts = state.draftPosts.filter((p) => p._id !== postId);
  delete state.interactions[postId];
  // ✅ FIX: delete pe count decrement
  if (wasPublished && state.serverPostsCount !== null) {
    state.serverPostsCount = Math.max(0, state.serverPostsCount - 1);
  }
});

    builder
      .addCase(fetchDraftPosts.pending,   (state) => { state.draftPostsLoading = true; })
      .addCase(fetchDraftPosts.fulfilled, (state, action) => {
        state.draftPostsLoading = false;
        state.draftPosts = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchDraftPosts.rejected,  (state) => { state.draftPostsLoading = false; });

   builder.addCase(publishDraftPost.fulfilled, (state, action) => {
  const { postId, post } = action.payload;
  state.draftPosts = state.draftPosts.filter((p) => p._id !== postId);
  if (post) {
    state.myPosts.unshift(post);
    state.feed.unshift(post);
    // ✅ FIX: publish hone pe count increment karo
    if (state.serverPostsCount !== null) {
      state.serverPostsCount += 1;
    }
  }
});
    builder.addCase(updateDraft.fulfilled, (state, action) => {
  const { postId, post } = action.payload;
  const idx = state.draftPosts.findIndex((p) => p._id === postId);
  if (idx !== -1) state.draftPosts[idx] = post;
});
  },
});

export const { prependPost, initInteraction } = postSlice.actions;
export default postSlice.reducer;