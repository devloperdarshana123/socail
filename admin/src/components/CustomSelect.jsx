// src/components/CustomSelect.jsx
import { useState, useRef, useEffect } from "react";

export default function CustomSelect({ value, onChange, options, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:border-white/20 focus:outline-none focus:border-violet-500/60 transition-colors min-w-[130px] cursor-pointer"
      >
        <span className="flex-1 text-left truncate">
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-full w-max bg-[#1a2035] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors text-left ${
                opt.value === value
                  ? "bg-violet-600/20 text-violet-300"
                  : "text-white/70 hover:bg-white/8 hover:text-white"
              }`}
            >
              {opt.value === value && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {opt.value !== value && <span className="w-3.5" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}