import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCheck, Loader2 } from "lucide-react";
import { unfollowUser } from "../lib/redux/authSlice";
import { useNavigate } from "react-router-dom";
import api from "../lib/services/api";

export default function FollowListModal({ userId, type, onClose, onUnfollow }) {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [hasMore,  setHasMore]  = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.get(`/follow/${userId}/${type}?page=1&limit=20`)
      .then(({ data }) => {
        const items = type === "followers"
          ? data.data?.followers
          : data.data?.following;
        setList(items || []);
        setHasMore(data.data?.hasMore || false);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, type]);

  const handleUnfollow = async (targetUserId) => {
    const res = await dispatch(unfollowUser(targetUserId));
    if (unfollowUser.fulfilled.match(res)) {
      setList((prev) => prev.filter((u) => u._id !== targetUserId));
      onUnfollow?.();
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    const { data } = await api.get(`/follow/${userId}/${type}?page=${nextPage}&limit=20`);
    const items = type === "followers"
      ? data.data?.followers
      : data.data?.following;
    setList((prev) => [...prev, ...(items || [])]);
    setHasMore(data.data?.hasMore || false);
    setPage(nextPage);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-sm shadow-2xl max-h-[70vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
            <h2 className="text-base font-bold text-[#2d1f0f] capitalize">{type}</h2>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355]">
              <X size={18} />
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 p-3 space-y-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[#c09a6e]" />
              </div>
            ) : list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-sm font-semibold text-[#5a3e2b]">
                  {type === "followers" ? "No followers yet" : "Not following anyone yet"}
                </p>
              </div>
            ) : (
              <>
                {list.map((u) => (
                  <div key={u._id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-[#fdf3e7] transition-colors">
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => { navigate(`/profile/${u.username}`); onClose(); }}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#e8d5be] shrink-0">
                        {u.avatar?.url ? (
                          <img src={u.avatar.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#d4b896] to-[#c09a6e]">
                            <span className="text-white font-bold text-sm">
                              {u.fullName?.[0]?.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#2d1f0f]">{u.fullName}</p>
                        <p className="text-xs text-[#8b7355]">@{u.username}</p>
                      </div>
                    </div>

                    {/* Sirf Following tab mein Unfollow button */}
                    {type === "following" && (
                      <button
                        onClick={() => handleUnfollow(u._id)}
                        className="flex items-center gap-1 text-xs bg-white border border-[#ddd0c0] text-[#5a3e2b] hover:bg-[#f5ece0] px-3 py-1.5 rounded-full font-semibold transition-colors"
                      >
                        <UserCheck size={12} />
                        Following
                      </button>
                    )}
                  </div>
                ))}

                {/* Load more */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    className="w-full text-xs text-[#8b7355] hover:text-[#5a3e2b] py-3 font-semibold transition-colors"
                  >
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}