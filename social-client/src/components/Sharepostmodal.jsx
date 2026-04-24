import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, Search, Check, Send } from "lucide-react";
import { fetchFollowingForMessages, getOrCreateConversation } from "../store/slices/Messageslice";
import api from "../services/api";
import toast from "react-hot-toast";

const Avatar = ({ src, name, size = "w-10 h-10", textSize = "text-sm" }) =>
  src ? (
    <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />
  ) : (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-bold ${textSize} shrink-0`}
      style={{ background: "linear-gradient(135deg, #c8956c, #a07050)" }}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  );

export default function SharePostModal({ post, onClose }) {
  const dispatch = useDispatch();
  const { followingList } = useSelector((s) => s.messages);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    dispatch(fetchFollowingForMessages());
  }, [dispatch]);

  const filteredList = followingList.filter((item) =>
    item.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Kisi ko select karo!");
      return;
    }
    setSending(true);

    let successCount = 0;

    for (const userId of selectedUsers) {
      try {
        // Step 1: Conversation get or create
        const res = await dispatch(getOrCreateConversation(userId));

        if (!getOrCreateConversation.fulfilled.match(res)) {
          console.error("Conversation create failed for:", userId, res.payload);
          continue;
        }

        const conv = res.payload;
        console.log("✅ Conversation:", conv._id);

        // Step 2: Message send via API
        const shareText = post.caption
          ? `📤 Shared a post: "${post.caption.slice(0, 80)}${post.caption.length > 80 ? "..." : ""}"`
          : "📤 Shared a post";

        const payload = {
          text: shareText,
          image: post.image || "",
        };

        console.log("📤 Sending to conv:", conv._id, payload);

        const msgRes = await api.post(`/messages/${conv._id}/messages`, payload);
        console.log("✅ Message sent:", msgRes.data);
        successCount++;
      } catch (err) {
        console.error("❌ Share error:", err?.response?.data || err.message);
        toast.error(`Failed: ${err?.response?.data?.message || err.message}`);
      }
    }

    setSending(false);

    if (successCount > 0) {
      toast.success(`Post ${successCount} log(s) ko share ho gai! 🎉`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">Share Post</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Post Preview */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            {post.image ? (
              <img src={post.image} alt="post" className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : post.video ? (
              <video src={post.video} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">📝</div>
            )}
            <p className="text-xs text-gray-500 line-clamp-2 flex-1">
              {post.caption || "No caption"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* People List */}
        <div className="max-h-64 overflow-y-auto">
          {filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-xs">
              Koi nahi mila — pehle kisi ko follow karo
            </div>
          ) : (
            filteredList.map((item) => {
              const isSelected = selectedUsers.includes(item.user?._id);
              return (
                <button
                  key={item.user?._id}
                  onClick={() => toggleSelect(item.user?._id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 transition text-left
                    ${isSelected ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <Avatar
                    src={item.user?.avatar}
                    name={item.user?.name}
                    size="w-9 h-9"
                    textSize="text-xs"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{item.user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.user?.designation?.trim() || "EroSocial Member"}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition
                      ${isSelected ? "border-indigo-500 bg-indigo-500" : "border-gray-300"}`}
                  >
                    {isSelected && <Check size={11} className="text-white" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Send Button */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleShare}
            disabled={sending || selectedUsers.length === 0}
            className="w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            style={{
              background: selectedUsers.length > 0 ? "#4f46e5" : "#c7d2fe",
            }}
          >
            <Send size={14} />
            {sending
              ? "Sharing..."
              : `Share${selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}