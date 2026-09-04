import { useState, useMemo } from "react";
import Select from "react-select";
import { Country, State, City } from "country-state-city";

export default function LocationSelect({ value, onChange, isDark }) {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState,   setSelectedState]   = useState(null);

  const accent = "#1e3a5f";

  // ── Options ──────────────────────────────────────────────────────────────
  const countryOptions = useMemo(() =>
    Country.getAllCountries().map((c) => ({
      value: c.isoCode,
      label: `${c.flag} ${c.name}`,
    })), []);

  const stateOptions = useMemo(() => {
    if (!selectedCountry) return [];
    return State.getStatesOfCountry(selectedCountry.value).map((s) => ({
      value: s.isoCode,
      label: s.name,
    }));
  }, [selectedCountry]);

  const cityOptions = useMemo(() => {
    if (!selectedCountry) return [];
    const cities = selectedState
      ? City.getCitiesOfState(selectedCountry.value, selectedState.value)
      : City.getCitiesOfCountry(selectedCountry.value);
    return (cities || []).map((ci) => ({
      value: `${ci.name}, ${selectedState?.label || ""}, ${selectedCountry.label.split(" ").slice(1).join(" ")}`.replace(", ,", ","),
      label: ci.name,
    }));
  }, [selectedCountry, selectedState]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCountryChange = (opt) => {
    setSelectedCountry(opt);
    setSelectedState(null);
    onChange(null);   // reset parent value
  };

  const handleStateChange = (opt) => {
    setSelectedState(opt);
    onChange(null);
  };

  const handleCityChange = (opt) => {
    onChange(opt);    // pass full {value, label} to parent
  };

  // ── Shared react-select styles ────────────────────────────────────────────
  const styles = (overrides = {}) => ({
    control: (base, state) => ({
      ...base,
      background:   isDark ? "#1f2937" : "#f9fafb",
      borderColor:  state.isFocused ? accent : (isDark ? "#374151" : "#f1f5f9"),
      borderRadius: 14,
      minHeight:    42,
      boxShadow:    state.isFocused ? `0 0 0 2px ${accent}33` : "none",
      fontSize:     14,
      "&:hover":    { borderColor: accent },
      ...overrides.control,
    }),
    menu: (base) => ({
      ...base,
      background:   isDark ? "#1f2937" : "#ffffff",
      borderRadius: 14,
      border:       `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
      boxShadow:    "0 12px 40px rgba(0,0,0,0.15)",
      zIndex:       9999,
    }),
    option: (base, state) => ({
      ...base,
      background: state.isSelected
        ? accent
        : state.isFocused ? (isDark ? "#374151" : "#f0f4ff") : "transparent",
      color:     state.isSelected ? "#fff" : (isDark ? "#f1f5f9" : "#111827"),
      fontSize:  14,
      cursor:    "pointer",
    }),
    singleValue:        (base) => ({ ...base, color: isDark ? "#f1f5f9" : "#111827" }),
    placeholder:        (base) => ({ ...base, color: isDark ? "#6b7280" : "#9ca3af", fontSize: 14 }),
    input:              (base) => ({ ...base, color: isDark ? "#f1f5f9" : "#111827" }),
    clearIndicator:     (base) => ({ ...base, color: isDark ? "#6b7280" : "#9ca3af", cursor: "pointer" }),
    dropdownIndicator:  (base) => ({ ...base, color: isDark ? "#6b7280" : "#9ca3af" }),
    indicatorSeparator: ()     => ({ display: "none" }),
      menuPortal: (base) => ({ ...base, zIndex: 999999 }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Country */}
      <Select
        options={countryOptions}
        value={selectedCountry}
        onChange={handleCountryChange}
        isClearable
        isSearchable
        placeholder="🌍 Country…"
        styles={styles()}
        noOptionsMessage={() => "No country found"}
        menuPortalTarget={document.body}
        menuPosition="fixed"
      />

      {/* State — only if country has states */}
      {selectedCountry && stateOptions.length > 0 && (
        <Select
          options={stateOptions}
          value={selectedState}
          onChange={handleStateChange}
          isClearable
          isSearchable
          placeholder="🏛️ State / Province…"
          styles={styles()}
          noOptionsMessage={() => "No state found"}
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />
      )}

      {/* City — only if country is selected */}
      {selectedCountry && (
        <Select
          options={cityOptions}
          value={value}
          onChange={handleCityChange}
          isClearable
          isSearchable
          placeholder="📍 City…"
          styles={styles()}
          noOptionsMessage={() => "No city found"}
          menuPortalTarget={document.body}
          menuPosition="fixed"
        />
      )}
    </div>
  );
}