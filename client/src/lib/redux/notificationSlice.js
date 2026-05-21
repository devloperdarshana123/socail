
// // // ─────────────────────────────────────────────────────────────────────────

// // import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// // import axios from "axios";

// // const BASE = "/api/v2/notifications";

// // // ── Async Thunks ──────────────────────────────────────────────────────────

// // // Page load pe call karo — notifications + unread count ek saath
// // export const fetchNotifications = createAsyncThunk(
// //   "notifications/fetch",
// //   async ({ page = 1 } = {}, { rejectWithValue }) => {
// //     try {
// //       const { data } = await axios.get(BASE, { params: { page, limit: 20 } });
// //       return { ...data.data, page };
// //    } catch (err) {
// //       return { notifications: [], unreadCount: 0, hasMore: false, page: 1 };
// //     }
// //   }
// // );

// // // Bell icon open karne pe — saari unread mark as read
// // export const markAllReadThunk = createAsyncThunk(
// //   "notifications/markAllRead",
// //   async (_, { rejectWithValue }) => {
// //     try {
// //       await axios.put(`${BASE}/read`);
// //       return true;
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed");
// //     }
// //   }
// // );

// // // Single notification mark as read
// // export const markOneReadThunk = createAsyncThunk(
// //   "notifications/markOneRead",
// //   async (notificationId, { rejectWithValue }) => {
// //     try {
// //       const { data } = await axios.put(`${BASE}/${notificationId}/read`);
// //       return data.data;
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed");
// //     }
// //   }
// // );

// // // Single delete
// // export const deleteNotificationThunk = createAsyncThunk(
// //   "notifications/delete",
// //   async (notificationId, { rejectWithValue }) => {
// //     try {
// //       const { data } = await axios.delete(`${BASE}/${notificationId}`);
// //       return { notificationId, unreadCount: data.data.unreadCount };
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed");
// //     }
// //   }
// // );

// // // Clear all
// // export const clearAllThunk = createAsyncThunk(
// //   "notifications/clearAll",
// //   async (_, { rejectWithValue }) => {
// //     try {
// //       await axios.delete(BASE);
// //       return true;
// //     } catch (err) {
// //       return rejectWithValue(err.response?.data?.message || "Failed");
// //     }
// //   }
// // );

// // // ── Slice ─────────────────────────────────────────────────────────────────

// // const notificationSlice = createSlice({
// //   name: "notifications",
// //   initialState: {
// //     notifications: [],
// //     unreadCount:   0,
// //     loading:       false,
// //     loadingMore:   false,
// //     hasMore:       true,
// //     page:          1,
// //     error:         null,
// //   },

// //   reducers: {
// //     // Socket se real-time notification aane pe call karo
// //     // Duplicate check built-in hai — same _id do baar nahi aayegi
// //    addRealtimeNotification: (state, action) => {
// //       const incoming = action.payload;
// //       if (!Array.isArray(state.notifications)) state.notifications = [];
// //       const exists = state.notifications.some((n) => n._id === incoming._id);
// //       if (!exists) {
// //         state.notifications.unshift(incoming); // top pe add karo
// //       }
// //     },

// //     // Socket se unread count update aane pe
// //     setUnreadCount: (state, action) => {
// //       state.unreadCount = action.payload;
// //     },

// //     // Single notification ka read state locally update karo
// //     // (optimistic update — API call ke wait ke bina UI update)

// //    markAllRead: (state) => {
// //       if (Array.isArray(state.notifications)) {
// //         state.notifications.forEach((n) => { n.isRead = true; });
// //       }
// //       state.unreadCount = 0;
// //     },
// //     markOneReadLocal: (state, action) => {
// //       const n = state.notifications.find((n) => n._id === action.payload);
// //       if (n && !n.isRead) {
// //         n.isRead = true;
// //         n.readAt = new Date().toISOString();
// //         state.unreadCount = Math.max(0, state.unreadCount - 1);
// //       }
// //     },
// //   },

// //   extraReducers: (builder) => {
// //     // ── fetchNotifications ──────────────────────────────────────────────
// //     builder
// //       .addCase(fetchNotifications.pending, (state, action) => {
// //         if (action.meta.arg?.page > 1) {
// //           state.loadingMore = true;
// //         } else {
// //           state.loading = true;
// //         }
// //         state.error = null;
// //       })
// //       .addCase(fetchNotifications.fulfilled, (state, action) => {
// //         const { notifications, unreadCount, page, hasMore } = action.payload;
// //         state.loading    = false;
// //         state.loadingMore = false;
// //         state.unreadCount = unreadCount;
// //         state.hasMore     = hasMore;
// //         state.page        = page;

// //       if (page === 1) {
// //           state.notifications = notifications ?? [];
// //         } else {
// //           // Infinite scroll — append, duplicates avoid karo
// //           const existingIds = new Set(state.notifications.map((n) => n._id));
// //           const newOnes = notifications.filter((n) => !existingIds.has(n._id));
// //           state.notifications.push(...newOnes);
// //         }
// //       })
// //      .addCase(fetchNotifications.rejected, (state, action) => {
// //         state.loading        = false;
// //         state.loadingMore    = false;
// //         state.error          = action.payload;
// //         if (!state.notifications) state.notifications = [];
// //       });

// //     // ── markAllRead ────────────────────────────────────────────────────
// //     builder.addCase(markAllReadThunk.fulfilled, (state) => {
// //       state.notifications.forEach((n) => {
// //         n.isRead = true;
// //         n.readAt = new Date().toISOString();
// //       });
// //       state.unreadCount = 0;
// //     });

// //     // ── markOneRead ────────────────────────────────────────────────────
// //     builder.addCase(markOneReadThunk.fulfilled, (state, action) => {
// //       const { notification, unreadCount } = action.payload;
// //       const idx = state.notifications.findIndex((n) => n._id === notification._id);
// //       if (idx !== -1) state.notifications[idx] = notification;
// //       state.unreadCount = unreadCount;
// //     });

// //     // ── deleteNotification ─────────────────────────────────────────────
// //     builder.addCase(deleteNotificationThunk.fulfilled, (state, action) => {
// //       const { notificationId, unreadCount } = action.payload;
// //       state.notifications = state.notifications.filter(
// //         (n) => n._id !== notificationId
// //       );
// //       state.unreadCount = unreadCount;
// //     });

// //     // ── clearAll ───────────────────────────────────────────────────────
// //     builder.addCase(clearAllThunk.fulfilled, (state) => {
// //       state.notifications = [];
// //       state.unreadCount   = 0;
// //     });
// //   },
// // });

// // export const {
// //   addRealtimeNotification,
// //   setUnreadCount,
// //   markOneReadLocal,
// //   markAllRead,
// // } = notificationSlice.actions;

// // export default notificationSlice.reducer;



// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import axios from "axios";

// const BASE = "/api/v2/notifications";

// // ── Async Thunks ──────────────────────────────────────────────────────────

// export const fetchNotifications = createAsyncThunk(
//   "notifications/fetch",
//   async ({ page = 1 } = {}, { rejectWithValue }) => {
//     try {
//       const { data } = await axios.get(BASE, { params: { page, limit: 20 } });
//       return { ...data.data, page };
//     } catch (err) {
//       // BUG FIX 3: error pe empty array return mat karo — state wipe hogi
//       // rejectWithValue use karo — rejected case handle karega, state safe rahegi
//       return rejectWithValue(err.response?.data?.message || "Failed to fetch");
//     }
//   }
// );

// export const markAllReadThunk = createAsyncThunk(
//   "notifications/markAllRead",
//   async (_, { rejectWithValue }) => {
//     try {
//       await axios.put(`${BASE}/read`);
//       return true;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed");
//     }
//   }
// );

// export const markOneReadThunk = createAsyncThunk(
//   "notifications/markOneRead",
//   async (notificationId, { rejectWithValue }) => {
//     try {
//       const { data } = await axios.put(`${BASE}/${notificationId}/read`);
//       return data.data;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed");
//     }
//   }
// );

// export const deleteNotificationThunk = createAsyncThunk(
//   "notifications/delete",
//   async (notificationId, { rejectWithValue }) => {
//     try {
//       const { data } = await axios.delete(`${BASE}/${notificationId}`);
//       return { notificationId, unreadCount: data.data.unreadCount };
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed");
//     }
//   }
// );

// export const clearAllThunk = createAsyncThunk(
//   "notifications/clearAll",
//   async (_, { rejectWithValue }) => {
//     try {
//       await axios.delete(BASE);
//       return true;
//     } catch (err) {
//       return rejectWithValue(err.response?.data?.message || "Failed");
//     }
//   }
// );

// // ── Slice ─────────────────────────────────────────────────────────────────

// const notificationSlice = createSlice({
//   name: "notifications",
//   initialState: {
//     notifications: [],
//     unreadCount:   0,
//     loading:       false,
//     loadingMore:   false,
//     hasMore:       true,
//     page:          1,
//     error:         null,
//   },

//   reducers: {
//     // BUG FIX 2 (partial) — real-time notification aane pe
//     // unreadCount yahan hi badhao — alag setUnreadCount event ka wait mat karo
//     // Double count avoid karne ke liye: socket se sirf notification:new suno
//     // notification:unread_count event ko IGNORE karo (notificationHandler already bhejta hai)
//     addRealtimeNotification: (state, action) => {
//       const incoming = action.payload;
//       if (!Array.isArray(state.notifications)) state.notifications = [];

//       // Duplicate check — same _id do baar nahi aayegi
//       const exists = state.notifications.some(
//         (n) => n._id === incoming._id
//       );
//       if (exists) return;

//       state.notifications.unshift(incoming);

//       // Unread count yahan hi badhao — socket ka alag event ka wait nahi
//       if (!incoming.isRead) {
//         state.unreadCount += 1;
//       }
//     },

//     // BUG FIX 2 — setUnreadCount sirf tab use karo jab
//     // koi aur source se authoritative count aaye (jaise page load)
//     // Real-time pe addRealtimeNotification khud count handle karta hai
//     setUnreadCount: (state, action) => {
//       state.unreadCount = action.payload;
//     },

//     markAllRead: (state) => {
//       if (Array.isArray(state.notifications)) {
//         state.notifications.forEach((n) => { n.isRead = true; });
//       }
//       state.unreadCount = 0;
//     },

//     markOneReadLocal: (state, action) => {
//       const n = state.notifications.find((n) => n._id === action.payload);
//       if (n && !n.isRead) {
//         n.isRead = true;
//         n.readAt = new Date().toISOString();
//         state.unreadCount = Math.max(0, state.unreadCount - 1);
//       }
//     },
//   },

//   extraReducers: (builder) => {
//     // ── fetchNotifications ─────────────────────────────────────────────
//     builder
//       .addCase(fetchNotifications.pending, (state, action) => {
//         if (action.meta.arg?.page > 1) {
//           state.loadingMore = true;
//         } else {
//           state.loading = true;
//         }
//         state.error = null;
//       })
//       .addCase(fetchNotifications.fulfilled, (state, action) => {
//         const { notifications, unreadCount, page, hasMore } = action.payload;
//         state.loading     = false;
//         state.loadingMore = false;
//         state.unreadCount = unreadCount ?? state.unreadCount;
//         state.hasMore     = hasMore ?? false;
//         state.page        = page;

//         if (page === 1) {
//           state.notifications = notifications ?? [];
//         } else {
//           // Infinite scroll — append, duplicates avoid
//           const existingIds = new Set(state.notifications.map((n) => n._id));
//           const newOnes = (notifications ?? []).filter(
//             (n) => !existingIds.has(n._id)
//           );
//           state.notifications.push(...newOnes);
//         }
//       })
//       // BUG FIX 3 — rejected pe state wipe mat karo
//       // Error aane pe purani notifications rahne do
//       .addCase(fetchNotifications.rejected, (state, action) => {
//         state.loading     = false;
//         state.loadingMore = false;
//         state.error       = action.payload ?? "Something went wrong";
//         // notifications aur unreadCount TOUCH nahi karo — purana data safe rahe
//       });

//     // ── markAllRead ────────────────────────────────────────────────────
//     builder.addCase(markAllReadThunk.fulfilled, (state) => {
//       state.notifications.forEach((n) => {
//         n.isRead = true;
//         n.readAt = new Date().toISOString();
//       });
//       state.unreadCount = 0;
//     });

//     // ── markOneRead ────────────────────────────────────────────────────
//     builder.addCase(markOneReadThunk.fulfilled, (state, action) => {
//       const { notification, unreadCount } = action.payload;
//       const idx = state.notifications.findIndex(
//         (n) => n._id === notification._id
//       );
//       if (idx !== -1) state.notifications[idx] = notification;
//       state.unreadCount = unreadCount;
//     });

//     // ── deleteNotification ─────────────────────────────────────────────
//     builder.addCase(deleteNotificationThunk.fulfilled, (state, action) => {
//       const { notificationId, unreadCount } = action.payload;
//       state.notifications = state.notifications.filter(
//         (n) => n._id !== notificationId
//       );
//       state.unreadCount = unreadCount;
//     });

//     // ── clearAll ───────────────────────────────────────────────────────
//     builder.addCase(clearAllThunk.fulfilled, (state) => {
//       state.notifications = [];
//       state.unreadCount   = 0;
//     });
//   },
// });

// export const {
//   addRealtimeNotification,
//   setUnreadCount,
//   markOneReadLocal,
//   markAllRead,
// } = notificationSlice.actions;

// export default notificationSlice.reducer;



// client/src/lib/redux/notificationSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE = "/api/v2/notifications";

// ── Async Thunks ──────────────────────────────────────────────────────────

export const fetchNotifications = createAsyncThunk(
  "notifications/fetch",
  async ({ page = 1 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await axios.get(BASE, { params: { page, limit: 20 } });
      return { ...data.data, page };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch");
    }
  }
);

export const markAllReadThunk = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await axios.put(`${BASE}/read`);
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const markOneReadThunk = createAsyncThunk(
  "notifications/markOneRead",
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await axios.put(`${BASE}/${notificationId}/read`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const deleteNotificationThunk = createAsyncThunk(
  "notifications/delete",
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await axios.delete(`${BASE}/${notificationId}`);
      return { notificationId, unreadCount: data.data.unreadCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

export const clearAllThunk = createAsyncThunk(
  "notifications/clearAll",
  async (_, { rejectWithValue }) => {
    try {
      await axios.delete(BASE);
      return true;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed");
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    notifications: [],
    unreadCount:   0,
    loading:       false,
    loadingMore:   false,
    hasMore:       true,
    page:          1,
    error:         null,
  },

  reducers: {
    addRealtimeNotification: (state, action) => {
      const incoming = action.payload;
      if (!Array.isArray(state.notifications)) state.notifications = [];

      // Duplicate check — same _id do baar add nahi hogi
      const exists = state.notifications.some((n) => n._id?.toString() === incoming._id?.toString());
      if (exists) return;

      state.notifications.unshift(incoming);

      // Unread count +1 — socket se alag event ka wait nahi
      if (!incoming.isRead) {
        state.unreadCount = (state.unreadCount || 0) + 1;
      }
    },

    // Sirf mark_read/delete ke baad server se authoritative count aane pe use karo
    setUnreadCount: (state, action) => {
      state.unreadCount = typeof action.payload === "number" ? action.payload : state.unreadCount;
    },

    markAllRead: (state) => {
      if (Array.isArray(state.notifications)) {
        state.notifications.forEach((n) => {
          n.isRead = true;
          n.readAt = new Date().toISOString();
        });
      }
      state.unreadCount = 0;
    },

    markOneReadLocal: (state, action) => {
      const n = state.notifications.find((n) => n._id === action.payload);
      if (n && !n.isRead) {
        n.isRead = true;
        n.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
  },

  extraReducers: (builder) => {
    // ── fetchNotifications ─────────────────────────────────────────────
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        if (action.meta.arg?.page > 1) state.loadingMore = true;
        else state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        const { notifications = [], unreadCount, page, hasMore } = action.payload;

        state.loading     = false;
        state.loadingMore = false;
        state.hasMore     = hasMore ?? false;
        state.page        = page;

        // unreadCount sirf DB se aaye authoritative value pe set karo
        // Real-time addRealtimeNotification se aaye duplicate count avoid hoga
        // kyunki page=1 fetch hone pe poori list replace ho jaati hai
        if (typeof unreadCount === "number") {
          state.unreadCount = unreadCount;
        }

        if (page === 1) {
          // Full replace — DB se fresh data
          state.notifications = notifications;
        } else {
          // Infinite scroll — sirf naye add karo
          const existingIds = new Set(state.notifications.map((n) => n._id?.toString()));
          const newOnes = notifications.filter((n) => !existingIds.has(n._id?.toString()));
          state.notifications.push(...newOnes);
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading     = false;
        state.loadingMore = false;
        state.error       = action.payload ?? "Something went wrong";
        // notifications aur unreadCount TOUCH NAHI — purana data safe rahe
      });

    // ── markAllRead ────────────────────────────────────────────────────
    builder.addCase(markAllReadThunk.fulfilled, (state) => {
      state.notifications.forEach((n) => {
        n.isRead = true;
        n.readAt = new Date().toISOString();
      });
      state.unreadCount = 0;
    });

    // ── markOneRead ────────────────────────────────────────────────────
    builder.addCase(markOneReadThunk.fulfilled, (state, action) => {
      const { notification, unreadCount } = action.payload;
      const idx = state.notifications.findIndex((n) => n._id === notification._id);
      if (idx !== -1) state.notifications[idx] = notification;
      if (typeof unreadCount === "number") state.unreadCount = unreadCount;
    });

    // ── deleteNotification ─────────────────────────────────────────────
    builder.addCase(deleteNotificationThunk.fulfilled, (state, action) => {
      const { notificationId, unreadCount } = action.payload;
      state.notifications = state.notifications.filter((n) => n._id !== notificationId);
      if (typeof unreadCount === "number") state.unreadCount = unreadCount;
    });

    // ── clearAll ───────────────────────────────────────────────────────
    builder.addCase(clearAllThunk.fulfilled, (state) => {
      state.notifications = [];
      state.unreadCount   = 0;
    });
  },
});

export const {
  addRealtimeNotification,
  setUnreadCount,
  markOneReadLocal,
  markAllRead,
} = notificationSlice.actions;

export default notificationSlice.reducer;