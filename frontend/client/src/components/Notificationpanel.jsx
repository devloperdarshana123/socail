
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { formatDistanceToNow } from "date-fns";
import {
  markAllReadThunk,
  deleteNotificationThunk,
  clearAllThunk,
  fetchNotifications,
  markOneReadLocal,
} from "../lib/redux/notificationSlice";
import { bucketByDate, DATE_BUCKET_LABELS } from "../utils/dateBuckets";

export default function NotificationPanel() {
  const dispatch    = useDispatch();
  const panelRef    = useRef(null);
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    page,
  } = useSelector((s) => s.notifications);

  // ── Panel open/close ───────────────────────────────────────────────────
  const handleBellClick = () => {
    setOpen((prev) => {
      const opening = !prev;
      // Panel kholte hi sab read mark karo
      if (opening && unreadCount > 0) {
        dispatch(markAllReadThunk());
      }
      return opening;
    });
  };

  // Outside click se close
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Load more (infinite scroll) ────────────────────────────────────────
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      dispatch(fetchNotifications({ page: page + 1 }));
    }
  };

  // ── Single delete ──────────────────────────────────────────────────────
  const handleDelete = (e, id) => {
    e.stopPropagation();
    dispatch(deleteNotificationThunk(id));
  };

  // ── Mark one read on click ─────────────────────────────────────────────
  const handleItemClick = (notification) => {
    if (!notification.isRead) {
      dispatch(markOneReadLocal(notification._id));
    }
    // Yahan navigate kar sakte ho notification ke refId pe
    // e.g., navigate(`/post/${notification.refId}`)
  };

  // ── Group into Today / This Week / This Month / Older sections ─────────
  const groupedNotifications = useMemo(
    () => bucketByDate(notifications, "createdAt"),
    [notifications],
  );

  return (
    <div style={{ position: "relative" }} ref={panelRef}>

      {/* ── Bell button ──────────────────────────────────────────────── */}
      <button
        onClick={handleBellClick}
        aria-label="Notifications"
        style={{
          position:   "relative",
          background: "none",
          border:     "none",
          cursor:     "pointer",
          padding:    "6px",
          borderRadius: "8px",
          display:    "flex",
          alignItems: "center",
        }}
      >
        {/* Bell icon — apna SVG/icon library use karo */}
        <BellIcon />

        {/* Badge — sirf unread > 0 hone pe dikhta hai */}
        {unreadCount > 0 && (
          <span
            style={{
              position:    "absolute",
              top:         0,
              right:       0,
              background:  "#E24B4A",
              color:       "#fff",
              fontSize:    "10px",
              fontWeight:  500,
              borderRadius:"10px",
              minWidth:    "16px",
              height:      "16px",
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              padding:     "0 4px",
              lineHeight:  1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position:     "absolute",
            top:          "calc(100% + 8px)",
            right:        0,
            width:        "360px",
            maxHeight:    "480px",
            overflowY:    "auto",
            background:   "var(--color-background-primary)",
            border:       "0.5px solid var(--color-border-tertiary)",
            borderRadius: "12px",
            boxShadow:    "0 4px 24px rgba(0,0,0,0.08)",
            zIndex:       9999,
          }}
        >
          {/* Header */}
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "12px 16px",
              borderBottom:   "0.5px solid var(--color-border-tertiary)",
              position:       "sticky",
              top:            0,
              background:     "var(--color-background-primary)",
              zIndex:         1,
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 500 }}>
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                onClick={() => dispatch(clearAllThunk())}
                style={{
                  fontSize:     "12px",
                  color:        "#A32D2D",
                  background:   "none",
                  border:       "none",
                  cursor:       "pointer",
                  padding:      "4px 8px",
                  borderRadius: "6px",
                }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: "13px", color: "var(--color-text-tertiary)" }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", fontSize: "13px", color: "var(--color-text-tertiary)" }}>
              Koi notification nahi hai
            </div>
          ) : (
            <>
              {Object.entries(groupedNotifications).map(([bucket, items]) =>
                items.length === 0 ? null : (
                  <div key={bucket}>
                    <div
                      style={{
                        padding:      "8px 16px 4px",
                        fontSize:     "11px",
                        fontWeight:   600,
                        textTransform:"uppercase",
                        letterSpacing:"0.04em",
                        color:        "var(--color-text-tertiary)",
                      }}
                    >
                      {DATE_BUCKET_LABELS[bucket]}
                    </div>
                    {items.map((n) => (
                      <NotificationItem
                        key={n._id}
                        notification={n}
                        onClick={() => handleItemClick(n)}
                        onDelete={(e) => handleDelete(e, n._id)}
                      />
                    ))}
                  </div>
                )
              )}

              {/* Load more */}
              {hasMore && (
                <div style={{ padding: "12px", textAlign: "center" }}>
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      fontSize:     "12px",
                      color:        "var(--color-text-secondary)",
                      background:   "none",
                      border:       "0.5px solid var(--color-border-secondary)",
                      borderRadius: "8px",
                      padding:      "6px 16px",
                      cursor:       "pointer",
                    }}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Single notification row ────────────────────────────────────────────────
function NotificationItem({ notification: n, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const sender  = n.sender;
  const initials = sender?.fullName
    ? sender.fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : sender?.username?.slice(0, 2).toUpperCase() || "?";

  const timeAgo = n.createdAt
    ? formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })
    : "";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}   // ← yahan add karo
  onMouseLeave={() => setHovered(false)}
      style={{
        display:       "flex",
        alignItems:    "flex-start",
        gap:           "12px",
        padding:       "12px 16px",
        borderBottom:  "0.5px solid var(--color-border-tertiary)",
        cursor:        "pointer",
        position:      "relative",
        background:    n.isRead ? "transparent" : "rgba(55, 138, 221, 0.04)",
        // Unread hone pe left border
        borderLeft:    n.isRead ? "none" : "3px solid #378ADD",
        transition:    "background 0.15s",
      }}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <div
          style={{
            position:     "absolute",
            right:        "40px",
            top:          "50%",
            transform:    "translateY(-50%)",
            width:        "8px",
            height:       "8px",
            borderRadius: "50%",
            background:   "#378ADD",
          }}
        />
      )}

      {/* Avatar */}
      <div
        style={{
          width:          "36px",
          height:         "36px",
          borderRadius:   "50%",
          background:     "#E6F1FB",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       "12px",
          fontWeight:     500,
          color:          "#185FA5",
          flexShrink:     0,
          overflow:       "hidden",
        }}
      >
        {sender?.avatar?.url ? (
          <img
            src={sender.avatar.url}
            alt={sender.username}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", margin: "0 0 2px", lineHeight: 1.5, color: "var(--color-text-primary)" }}>
          <strong style={{ fontWeight: 500 }}>
            {sender?.fullName || sender?.username || "Someone"}
          </strong>{" "}
          {n.label || n.type}
          {n.meta?.preview && (
            <span style={{ color: "var(--color-text-secondary)", marginLeft: "4px" }}>
              "{n.meta.preview}"
            </span>
          )}
        </p>
        <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>
          {timeAgo}
        </span>
      </div>

      {/* Delete button */}
      <button
        onClick={onDelete}
        style={{
          background:   "none",
          border:       "none",
          cursor:       "pointer",
          padding:      "4px",
          borderRadius: "6px",
          color:        "var(--color-text-tertiary)",
          opacity: hovered ? 1 : 0,
transition: "opacity 0.15s",
          fontSize:     "14px",
          flexShrink:   0,
        }}
       
        aria-label="Delete notification"
      >
        ✕
      </button>
    </div>
  );
}

// ── Bell SVG icon ──────────────────────────────────────────────────────────
function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}