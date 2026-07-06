

// import { useState } from "react";
// import MapView from "../components/MapView";
// import ChatBot from "../components/Chatbot";
// import StoryBar from "../components/StoryBar";

// const CATEGORIES = [
//   { label: "All",                    value: "all" },
//   { label: "Natural Stone Supplier", value: "natural_stone_supplier" },
//   { label: "Quarry Owner",           value: "quarry_owner" },
//   { label: "Stone Processor",        value: "stone_processor" },
//   { label: "CNC & Fabrication",      value: "cnc_fabrication" },
//   { label: "Tiles & Surfaces",       value: "tiles_surfaces" },
//   { label: "Interior Designer",      value: "interior_designer" },
//   { label: "Architect",              value: "architect" },
//   { label: "Contractor & Builder",   value: "contractor_builder" },
//   { label: "Importer / Exporter",    value: "importer_exporter" },
//   { label: "Distributor / Wholesaler", value: "distributor_wholesaler" },
//   { label: "Retailer",               value: "retailer" },
//   { label: "Equipment Supplier",     value: "equipment_supplier" },
//   { label: "Other",                  value: "other" },
//   // Purane values bhi support karo
//   { label: "Marble",    value: "marble" },
//   { label: "Granite",   value: "granite" },
//   { label: "Limestone", value: "limestone" },
//   { label: "Quarry",    value: "quarry" },
//   { label: "Supplier",  value: "supplier" },
//   { label: "Designer",  value: "designer" },
// ];

// export default function FeedPage() {
//   const [activeCategory, setActiveCategory] = useState("all");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [mapSearch, setMapSearch] = useState("");

//   return (
//     <div className="min-h-screen bg-gray-100">

//     {/* ── STORY BAR (top) ── */}
//       <div className="w-full bg-white border-b border-gray-100 shadow-sm px-4 py-3">
//         <StoryBar />
//       </div>

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
//   const active = activeCategory === cat.value;
//   return (
//     <button
//       key={cat.value}
//       onClick={() => setActiveCategory(cat.value)}
//                       className="px-4 py-1.5 rounded-full text-sm font-medium border transition"
//                       style={{
//                         background: active ? "#1e3a5f" : "#fff",
//                         color: active ? "#fff" : "#374151",
//                         borderColor: active ? "#1e3a5f" : "#d1d5db",
//                       }}
//                    >
//                       {cat.label}
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

//       {/* ── CHATBOT (floating, bottom) ── */}
//       <ChatBot />
//     </div>
//   );
// }


import { useState } from "react";
import MapView from "../components/MapView";
import ChatBot from "../components/Chatbot";
import StoryBar from "../components/StoryBar";

const CATEGORIES = [
  { label: "All",                    value: "all" },
  { label: "Natural Stone Supplier", value: "natural_stone_supplier" },
  { label: "Quarry Owner",           value: "quarry_owner" },
  { label: "Stone Processor",        value: "stone_processor" },
  { label: "CNC & Fabrication",      value: "cnc_fabrication" },
  { label: "Tiles & Surfaces",       value: "tiles_surfaces" },
  { label: "Interior Designer",      value: "interior_designer" },
  { label: "Architect",              value: "architect" },
  { label: "Contractor & Builder",   value: "contractor_builder" },
  { label: "Importer / Exporter",    value: "importer_exporter" },
  { label: "Distributor / Wholesaler", value: "distributor_wholesaler" },
  { label: "Retailer",               value: "retailer" },
  { label: "Equipment Supplier",     value: "equipment_supplier" },
  { label: "Other",                  value: "other" },
  // Purane values bhi support karo
  { label: "Marble",    value: "marble" },
  { label: "Granite",   value: "granite" },
  { label: "Limestone", value: "limestone" },
  { label: "Quarry",    value: "quarry" },
  { label: "Supplier",  value: "supplier" },
  { label: "Designer",  value: "designer" },
];

export default function FeedPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapSearch, setMapSearch] = useState("");

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #F8F6F0 0%, #F1ECE1 55%, #EDE6D8 100%)",
      }}
    >
      {/* Signature styles — medallion ring, fade-in, focus states */}
      <style>{`
        @keyframes feedFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes medallionSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .fp-fade-1 { animation: feedFadeUp .7s cubic-bezier(.16,1,.3,1) both; }
        .fp-fade-2 { animation: feedFadeUp .7s cubic-bezier(.16,1,.3,1) .1s both; }
        .fp-fade-3 { animation: feedFadeUp .7s cubic-bezier(.16,1,.3,1) .2s both; }
        .fp-medallion-ring {
          animation: medallionSpin 60s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .fp-fade-1, .fp-fade-2, .fp-fade-3, .fp-medallion-ring { animation: none; }
        }
        .fp-search-input:focus-within {
          box-shadow: 0 0 0 3px rgba(176,138,90,0.25);
        }
        .fp-pill:hover { transform: translateY(-1px); }
      `}</style>

      {/* ── STORY BAR (top) ── */}
      <div
        className="w-full border-b px-4 py-3"
        style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(6px)", borderColor: "#E4DCC9" }}
      >
        <StoryBar />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-10">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-10 lg:gap-14">

          {/* ── LEFT: AI Search Panel ── */}
          <div
            className="w-full lg:w-130 flex flex-col items-center text-center shrink-0 fp-fade-1"
            style={{ marginTop: "-40px" }}
          >
            {/* 3D Robot on a soft stone pedestal */}
            <div className="relative mb-2" style={{ width: "380px", height: "420px" }}>
              <div
                className="absolute rounded-full"
                style={{
                  width: "220px", height: "36px", left: "50%", bottom: "18px",
                  transform: "translateX(-50%)",
                  background: "radial-gradient(ellipse at center, rgba(30,58,95,0.16) 0%, rgba(30,58,95,0) 70%)",
                  filter: "blur(2px)",
                }}
              />
              <iframe
                src="/Robot-V1.html?embed=1"
                title="Erovians AI Robot"
                style={{ width: "100%", height: "100%", border: "none", background: "transparent", display: "block", position: "relative" }}
                scrolling="no"
              />
            </div>

            <h1
              className="text-3xl mb-1"
              style={{ fontWeight: 700, color: "#1e3a5f" }}
            >
              Erovians AI
            </h1>
            <p className="text-sm mb-7" style={{ color: "#8A8375" }}>
              Search sellers, marble, stones &amp; more
            </p>

            {/* Search Bar */}
            <div
              className="fp-search-input w-full flex gap-0 rounded-xl overflow-hidden bg-white mb-7 transition-shadow"
              style={{ border: "1px solid #E4DCC9", boxShadow: "0 4px 16px rgba(30,58,95,0.06)" }}
            >
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setMapSearch(searchQuery)}
                placeholder="e.g. marble supplier Delhi..."
                className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
                style={{ color: "#2A2A28" }}
              />
              <button
                onClick={() => setMapSearch(searchQuery)}
                className="px-6 py-3 text-sm font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #16304e 100%)" }}
              >
                Search
              </button>
            </div>

            {/* Filter by Category */}
            <div className="w-full text-left">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#B08A5A" }}
              >
                Filter by Category
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const active = activeCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setActiveCategory(cat.value)}
                      className="fp-pill px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150"
                      style={{
                        background: active ? "#1e3a5f" : "#fff",
                        color: active ? "#fff" : "#4B4A45",
                        borderColor: active ? "#1e3a5f" : "#E4DCC9",
                        boxShadow: active ? "0 3px 10px rgba(30,58,95,0.25)" : "none",
                      }}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Map — inlaid medallion frame (signature element) ── */}
          <div className="w-full lg:flex-1 flex items-center justify-center fp-fade-2">
            <div
              className="relative"
              style={{ width: "min(620px, 90vw)", height: "min(620px, 90vw)", marginTop: "-20px" }}
            >
              {/* Outer soft shadow bed */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 30px 60px -20px rgba(30,58,95,0.28)" }}
              />
              {/* Slow-rotating bronze dashed ring — the medallion signature */}
              <div
                className="fp-medallion-ring absolute rounded-full pointer-events-none"
                style={{
                  inset: "-14px",
                  border: "2px dashed rgba(176,138,90,0.55)",
                }}
              />
              {/* Solid bronze inlay ring */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{ inset: "-5px", border: "3px solid #B08A5A", opacity: 0.9 }}
              />
              {/* Map itself */}
              <div className="absolute inset-0 rounded-full overflow-hidden border-4 border-white">
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