import { useState } from "react";
import MapView from "../components/MapView";
import { Search } from "lucide-react";

const CATEGORIES = [
  { value: "all",       label: "All"       },
  { value: "marble",    label: "Marble"    },
  { value: "granite",   label: "Granite"   },
  { value: "limestone", label: "Limestone" },
  { value: "cnc",       label: "CNC"       },
  { value: "quarry",    label: "Quarry"    },
  { value: "supplier",  label: "Supplier"  },
  { value: "designer",  label: "Designer"  },
  { value: "other",     label: "Other"     },
];

export default function Marketplace() {
  const [searchQuery, setSearchQuery]         = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>


      {/* ── Map ── */}
      <div style={{ flex: 1, position: "relative" }}>
       <MapView
  searchQuery={searchQuery}
  selectedCategory={selectedCategory}
  onSearchChange={setSearchQuery}
  onCategoryChange={setSelectedCategory}
/>
      </div>
    </div>
  );
}