import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { fetchStoriesFeed, deleteStory, fetchMyHighlights } from "../lib/redux/storySlice";
import StoryViewer from "./StoryViewer";
import StoryCreate from "./StoryCreate";

export default function StoryBar() {
  const dispatch    = useDispatch();
  const currentUser = useSelector((s) => s.auth.user);
  const { feed, feedLoading, highlights } = useSelector((s) => s.stories);

  const [viewerOpen,  setViewerOpen]  = useState(false);
  const [viewerStart, setViewerStart] = useState(0);
  const [createOpen,  setCreateOpen]  = useState(false);

  useEffect(() => {
  dispatch(fetchStoriesFeed());
  dispatch(fetchMyHighlights());
}, []);

  const myGroup = feed.find(
    (g) => g.author?._id === currentUser?._id || g.author === currentUser?._id
  );
  const others = feed.filter(
    (g) => g.author?._id !== currentUser?._id && g.author !== currentUser?._id
  );
  const sorted = myGroup ? [myGroup, ...others] : feed;

  if (feedLoading) return (
    <div className="flex gap-3 px-1 py-3 overflow-x-auto">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="shrink-0 flex flex-col items-center gap-1.5 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-[#e8d5be]" />
          <div className="w-10 h-2 rounded bg-[#e8d5be]" />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex gap-4 px-1 py-3 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

        {/* Add story */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
          onClick={() => setCreateOpen(true)}>
          <div className="relative">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#e8d5be] bg-[#f5ece0]">
              {currentUser?.avatar?.url ? (
                <img src={currentUser.avatar.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#c09a6e]">
                  <span className="text-white font-bold">{currentUser?.fullName?.[0]}</span>
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#2d1f0f] rounded-full flex items-center justify-center border-2 border-white">
              <Plus size={11} className="text-white" strokeWidth={3} />
            </div>
          </div>
          <p className="text-xs text-[#5a3e2b] font-medium w-14 text-center truncate">Your story</p>
        </div>

        {/* All stories */}
        {sorted.map((group, idx) => (
          <div key={group.author?._id || idx}
            className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer"
            onClick={() => { setViewerStart(idx); setViewerOpen(true); }}>
            <div className={`w-14 h-14 rounded-full p-0.5 ${
              group.hasUnwatched
                ? "bg-gradient-to-tr from-[#c09a6e] to-[#8b6343]"
                : "bg-[#e8d5be]"
            }`}>
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-white">
                {group.author?.avatar?.url ? (
                  <img src={group.author.avatar.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#c09a6e]">
                    <span className="text-white text-sm font-bold">{group.author?.fullName?.[0]}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-[#5a3e2b] font-medium w-14 text-center truncate">
              {group.author?.username}
            </p>
          </div>
        ))}


{/* Highlights */}
{highlights.map((h) => (
  <div key={h._id}
    className="shrink-0 flex flex-col items-center gap-1.5 cursor-pointer">
    <div className="w-14 h-14 rounded-full p-0.5 bg-[#e8d5be]">
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-[#f5ece0]">
        {h.coverImage ? (
          <img src={h.coverImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#c09a6e]">
            <span className="text-white text-sm font-bold">{h.title?.[0]?.toUpperCase()}</span>
          </div>
        )}
      </div>
    </div>
    <p className="text-xs text-[#5a3e2b] font-medium w-14 text-center truncate">
      {h.title}
    </p>
  </div>
))}

      </div>

      {viewerOpen && (
        <StoryViewer
          feed={sorted}
          startIndex={viewerStart}
          onClose={() => setViewerOpen(false)}
          onDelete={(id) => dispatch(deleteStory(id))}
        />
      )}

      {createOpen && (
        <StoryCreate
          onClose={() => setCreateOpen(false)}
          onCreated={() => dispatch(fetchStoriesFeed())}
        />
      )}
    </>
  );
}