import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCheck, UserX, Loader2 } from "lucide-react";
import {
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
} from "../lib/redux/authSlice";

export default function FollowRequestsPanel({ onClose }) {
  const dispatch = useDispatch();
  const { followRequests, followRequestsLoading } = useSelector((s) => s.auth);

  useEffect(() => {
    dispatch(getFollowRequests());
  }, [dispatch]);

  const handleAccept = (userId) => dispatch(acceptFollowRequest(userId));
  const handleReject = (userId) => dispatch(rejectFollowRequest(userId));

  return (
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
        className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-md shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e4d4]">
          <div>
            <h2 className="text-base font-bold text-[#2d1f0f]">Follow Requests</h2>
            {followRequests?.total > 0 && (
              <p className="text-xs text-[#8b7355]">{followRequests.total} pending</p>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5ece0] text-[#8b7355]">
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {followRequestsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#c09a6e]" />
            </div>
          ) : !followRequests?.requests?.length ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <span className="text-4xl">🎉</span>
              <p className="text-sm font-semibold text-[#5a3e2b]">No pending requests</p>
            </div>
          ) : (
            <AnimatePresence>
              {followRequests.requests.map((req) => (
                <motion.div
                  key={req._id}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[#fdf3e7] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-[#e8d5be] shrink-0">
                      {req.follower?.avatar?.url ? (
                        <img src={req.follower.avatar.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#d4b896] to-[#c09a6e]">
                          <span className="text-white font-bold">
                            {req.follower?.fullName?.[0]?.toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#2d1f0f]">{req.follower?.fullName}</p>
                      <p className="text-xs text-[#8b7355]">@{req.follower?.username}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req.follower._id)}
                      className="flex items-center gap-1 text-xs bg-[#5a3e2b] hover:bg-[#4a3020] text-white px-3 py-1.5 rounded-full font-semibold transition-colors"
                    >
                      <UserCheck size={13} /> Accept
                    </button>
                    <button
                      onClick={() => handleReject(req.follower._id)}
                      className="flex items-center gap-1 text-xs bg-white border border-[#ddd0c0] text-[#8b7355] hover:bg-[#f5ece0] px-3 py-1.5 rounded-full font-semibold transition-colors"
                    >
                      <UserX size={13} /> Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}