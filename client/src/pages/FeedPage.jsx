// import { useState } from "react";
// import MapView from "../components/MapView";
// import ChatBot from "../components/Chatbot";
// import StoryBar from "../components/StoryBar";

// const CATEGORIES = ["All", "Marble", "Granite", "Limestone", "CNC", "Quarry", "Supplier", "Designer", "Other"];

// export default function FeedPage() {
//   const [activeCategory, setActiveCategory] = useState("all");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [mapSearch, setMapSearch] = useState("");

//   return (
//     <div className="min-h-screen bg-gray-100">

      

//       {/* ── MAIN CONTENT ── */}
//       <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-8">
//         <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

//           {/* ── LEFT: AI Search Panel ── */}
//           <div className="w-full lg:w-130 flex flex-col items-center text-center shrink-0" style={{ marginTop: "-50px" }}>

//             {/* 3D Robot */}
//             <div className="mb-4" style={{ width: "380px", height: "420px", overflow: "hidden" }}>
//               <iframe
//                 src="/Robot-V1.html?embed=1"
//                 title="Erovians AI Robot"
//                 style={{ width: "100%", height: "100%", border: "none", background: "transparent", display: "block" }}
//                 scrolling="no"
//               />
//             </div>

//             <h1 className="text-2xl font-bold text-gray-800 mb-1">Erovians AI</h1>
//             <p className="text-sm text-gray-500 mb-6">Search sellers, marble, stones & more</p>

//             {/* Search Bar */}
//             <div className="w-full flex gap-0 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm mb-6">
//               <input
//                 type="text"
//                 value={searchQuery}
//                 onChange={(e) => setSearchQuery(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && setMapSearch(searchQuery)}
//                 placeholder="e.g. marble supplier Delhi..."
//                 className="flex-1 px-4 py-3 text-sm outline-none text-gray-700 bg-transparent"
//               />
//               <button
//                 onClick={() => setMapSearch(searchQuery)}
//                 className="px-6 py-3 text-sm font-semibold text-white shrink-0 hover:opacity-90 transition"
//                 style={{ background: "#1e3a5f" }}
//               >
//                 Search
//               </button>
//             </div>

//             {/* Filter by Category */}
//             <div className="w-full text-left">
//               <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
//                 Filter by Category
//               </p>
//               <div className="flex flex-wrap gap-2">
//                 {CATEGORIES.map((cat) => {
//                   const val = cat.toLowerCase();
//                   const active = activeCategory === val;
//                   return (
//                     <button
//                       key={cat}
//                       onClick={() => setActiveCategory(val)}
//                       className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
//                       style={{
//                         background: active ? "#1e3a5f" : "#fff",
//                         color: active ? "#fff" : "#374151",
//                         borderColor: active ? "#1e3a5f" : "#d1d5db",
//                       }}
//                     >
//                       {cat}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>
//           </div>

//           {/* ── RIGHT: Map ── */}
//           <div className="w-full lg:flex-1 flex items-center justify-center">
//             <div
//               className="relative"
//               style={{ width: "min(600px, 90vw)", height: "min(600px, 90vw)", marginTop: "-30px" }}
//             >
//               <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-white shadow-2xl">
//                 <MapView
//                   searchQuery={mapSearch}
//                   selectedCategory={activeCategory}
//                   onSearchChange={setMapSearch}
//                   onCategoryChange={setActiveCategory}
//                 />
//               </div>
//             </div>
//           </div>

//         </div>
//       </div>

//       {/* ── CHATBOT ── */}
//       <ChatBot />
// <div className="w-full bg-white border-t border-gray-100 shadow-sm px-4 py-3">
//   <div className="max-w-6xl mx-auto">
//     <StoryBar />
//   </div>
// </div>
//     </div>
//   );
// }


import { useState } from "react";
import MapView from "../components/MapView";
import ChatBot from "../components/Chatbot";
import StoryBar from "../components/StoryBar";

const CATEGORIES = ["All", "Marble", "Granite", "Limestone", "CNC", "Quarry", "Supplier", "Designer", "Other"];

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapSearch, setMapSearch] = useState("");

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── STORY BAR (top) ── */}
      <div className="w-full bg-white border-b border-gray-100 shadow-sm px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <StoryBar />
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-8">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

          {/* ── LEFT: AI Search Panel ── */}
          <div className="w-full lg:w-130 flex flex-col items-center text-center shrink-0" style={{ marginTop: "-50px" }}>

            {/* 3D Robot */}
            <div className="mb-4" style={{ width: "380px", height: "420px", overflow: "hidden" }}>
              <iframe
                src="/Robot-V1.html?embed=1"
                title="Erovians AI Robot"
                style={{ width: "100%", height: "100%", border: "none", background: "transparent", display: "block" }}
                scrolling="no"
              />
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-1">Erovians AI</h1>
            <p className="text-sm text-gray-500 mb-6">Search sellers, marble, stones & more</p>

            {/* Search Bar */}
            <div className="w-full flex gap-0 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setMapSearch(searchQuery)}
                placeholder="e.g. marble supplier Delhi..."
                className="flex-1 px-4 py-3 text-sm outline-none text-gray-700 bg-transparent"
              />
              <button
                onClick={() => setMapSearch(searchQuery)}
                className="px-6 py-3 text-sm font-semibold text-white shrink-0 hover:opacity-90 transition"
                style={{ background: "#1e3a5f" }}
              >
                Search
              </button>
            </div>

            {/* Filter by Category */}
            <div className="w-full text-left">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Filter by Category
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const val = cat.toLowerCase();
                  const active = activeCategory === val;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(val)}
                      className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
                      style={{
                        background: active ? "#1e3a5f" : "#fff",
                        color: active ? "#fff" : "#374151",
                        borderColor: active ? "#1e3a5f" : "#d1d5db",
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Map ── */}
          <div className="w-full lg:flex-1 flex items-center justify-center">
            <div
              className="relative"
              style={{ width: "min(600px, 90vw)", height: "min(600px, 90vw)", marginTop: "-30px" }}
            >
              <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                <MapView
                  searchQuery={mapSearch}
                  selectedCategory={activeCategory}
                  onSearchChange={setMapSearch}
                  onCategoryChange={setActiveCategory}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── CHATBOT (floating, bottom) ── */}
      <ChatBot />
    </div>
  );
}