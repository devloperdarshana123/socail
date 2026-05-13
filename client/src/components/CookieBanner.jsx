import useCookieConsent from "../lib/hooks/useCookieConsent";
import CookieSettingsPanel from "./CookieSettingsPanel";

const CookieBanner = () => {
  const {
    showBanner,
    showSettings,
    consent,
    acceptAll,
    rejectAll,
    saveCustom,
    openSettings,
    closeSettings,
  } = useCookieConsent();

  // Kuch nahi dikhana hai toh null return karo
  if (!showBanner && !showSettings) return null;

  return (
    <>
      {/* Dark overlay — settings panel ke peeche */}
      {showSettings && (
        <div
          onClick={closeSettings}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 998,
          }}
        />
      )}

      {/* Main Banner */}
      {showBanner && !showSettings && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            background: "#fff",
            borderTop: "1px solid #e5e7eb",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          }}
        >
          {/* Text */}
          <div style={{ flex: 1, minWidth: "240px" }}>
            <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 4px" }}>
               We use cookies 🍪
            </p>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
              We use cookies to enhance your experience. You can manage your preferences anytime.{" "}
              <a href="/legal" style={{ color: "#111", textDecoration: "underline" }}>
                Cookie Policy
              </a>
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={openSettings}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "13px",
                color: "#6b7280",
                cursor: "pointer",
                padding: "8px 12px",
              }}
            >
              Customize
            </button>

            <button
              onClick={rejectAll}
              style={{
                background: "transparent",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                padding: "8px 18px",
                cursor: "pointer",
                color: "#374151",
              }}
            >
              Reject All
            </button>

            <button
              onClick={acceptAll}
              style={{
                background: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                padding: "8px 20px",
                cursor: "pointer",
              }}
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <CookieSettingsPanel
          currentConsent={consent}
          onSave={saveCustom}
          onClose={closeSettings}
        />
      )}
    </>
  );
};

export default CookieBanner;