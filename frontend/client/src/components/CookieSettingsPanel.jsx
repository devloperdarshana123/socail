import { useState } from "react";

const CookieSettingsPanel = ({ currentConsent, onSave, onClose }) => {
  const [analytics, setAnalytics] = useState(currentConsent.analytics);
  const [marketing, setMarketing] = useState(currentConsent.marketing);

  const handleSave = () => {
    onSave({ analytics, marketing });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie settings"
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(500px, 100vw)",
        background: "#fff",
        borderRadius: "16px 16px 0 0",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        zIndex: 999,
        padding: "24px",
        maxHeight: "85vh",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 6px" }}>
            Cookie Settings
          </h2>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
            "Choose which cookies you'd like to allow"
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close settings"
          style={{
            background: "#f3f4f6",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            cursor: "pointer",
            fontSize: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
      </div>

      {/* Cookie Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>

        {/* Essential — always on */}
        <CookieItem
          title="Essential Cookies"
          description="Required for login, security, and core site functionality"
          enabled={true}
          locked={true}
        />

        {/* Analytics */}
        <CookieItem
          title="Analytics Cookies"
          description="Help us understand how visitors interact with our website"
          enabled={analytics}
          onChange={setAnalytics}
        />

        {/* Marketing */}
        <CookieItem
          title="Marketing Cookies"
          description="Used to deliver personalised ads based on your interests"
          enabled={marketing}
          onChange={setMarketing}
        />
      </div>

      {/* Footer Buttons */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={() => onSave({ analytics: false, marketing: false })}
          style={{
            flex: 1,
            background: "transparent",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "12px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reject All
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            background: "#111827",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "12px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

// Reusable toggle row
const CookieItem = ({ title, description, enabled, onChange, locked }) => (
  <div
    style={{
      padding: "14px 16px",
      borderRadius: "10px",
      border: "1px solid #e5e7eb",
      display: "flex",
      alignItems: "center",
      gap: "14px",
      background: locked ? "#f9fafb" : "#fff",
    }}
  >
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 3px" }}>{title}</p>
      <p style={{ fontSize: "12px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>

    {locked ? (
      <span style={{
        fontSize: "11px",
        color: "#059669",
        background: "#d1fae5",
        padding: "3px 10px",
        borderRadius: "20px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}>
        Always on
      </span>
    ) : (
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "12px",
          background: enabled ? "#111827" : "#d1d5db",
          border: "none",
          cursor: "pointer",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute",
          top: "2px",
          left: enabled ? "22px" : "2px",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
        }} />
      </button>
    )}
  </div>
);

export default CookieSettingsPanel;