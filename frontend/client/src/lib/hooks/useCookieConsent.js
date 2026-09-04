import { useState, useEffect } from "react";
import { saveConsentAPI, getConsentAPI } from "../services/api";

const POLICY_VERSION = "1.0";
const STORAGE_KEY = "erovians_cookie_consent";

// Browser mein unique sessionId generate karo — agar nahi hai toh naya banao
const getOrCreateSessionId = () => {
  let sessionId = localStorage.getItem("erovians_session_id");
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("erovians_session_id", sessionId);
  }
  return sessionId;
};

const useCookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState({
    essential: true,
    analytics: false,
    marketing: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  // App load hone pe check karo — kya pehle consent diya tha?
  useEffect(() => {
    const checkConsent = async () => {
      try {
        // Step 1: localStorage se fast check
        const saved = localStorage.getItem(STORAGE_KEY);

        if (saved) {
          const parsed = JSON.parse(saved);

          // Policy version match karo — nahi mila toh dobara poochho
          if (parsed.policyVersion === POLICY_VERSION) {
            setConsent({
              essential: true,
              analytics: parsed.analytics ?? false,
              marketing: parsed.marketing ?? false,
            });
            loadScripts(parsed);
            setIsLoading(false);
            return; // Banner mat dikhao
          }
        }

        // Step 2: Backend se check karo — agar user dusre device se aaya ho
        const sessionId = getOrCreateSessionId();
        const response = await getConsentAPI(sessionId);

        if (response?.data?.policyVersion === POLICY_VERSION) {
          const backendConsent = response.data;
          const consentData = {
            essential: true,
            analytics: backendConsent.analytics,
            marketing: backendConsent.marketing,
            policyVersion: POLICY_VERSION,
          };
          // localStorage update karo
          localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
          setConsent(consentData);
          loadScripts(consentData);
          setIsLoading(false);
          return;
        }

        // Step 3: Koi consent nahi mila — banner dikhao
        setShowBanner(true);
      } catch {
        // Backend fail bhi ho toh banner dikhao
        setShowBanner(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkConsent();
  }, []);

  // Consent save karo — localStorage + backend dono mein
  const saveConsent = async (newConsent) => {
    const consentData = {
      essential: true,
      analytics: newConsent.analytics ?? false,
      marketing: newConsent.marketing ?? false,
      policyVersion: POLICY_VERSION,
    };

    // 1. localStorage mein turant save — fast UI response
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
    setConsent(consentData);
    setShowBanner(false);
    setShowSettings(false);

    // 2. Scripts load karo based on consent
    loadScripts(consentData);

    // 3. Backend mein save karo — legal proof ke liye
    try {
      const sessionId = getOrCreateSessionId();
      await saveConsentAPI({
        sessionId,
        analytics: consentData.analytics,
        marketing: consentData.marketing,
        policyVersion: POLICY_VERSION,
      });
    } catch {
      // Backend fail ho toh bhi UI kaam karta rahe
      console.warn("Consent backend save failed — will retry on next visit");
    }
  };

  // Accept All
  const acceptAll = () => {
    saveConsent({ analytics: true, marketing: true });
  };

  // Reject All
  const rejectAll = () => {
    saveConsent({ analytics: false, marketing: false });
  };

  // Custom settings save
  const saveCustom = (customConsent) => {
    saveConsent(customConsent);
  };

  // Settings panel open/close
  const openSettings = () => setShowSettings(true);
  const closeSettings = () => setShowSettings(false);

  return {
    showBanner,
    showSettings,
    consent,
    isLoading,
    acceptAll,
    rejectAll,
    saveCustom,
    openSettings,
    closeSettings,
  };
};

// Analytics/Marketing scripts inject karo — consent ke baad hi
const loadScripts = (consent) => {
  if (consent.analytics) {
    injectAnalytics();
  }
  if (consent.marketing) {
    injectMarketing();
  }
};

const injectAnalytics = () => {
  // Google Analytics already load hua hai toh dobara mat karo
  if (window.GA_INITIALIZED) return;
  window.GA_INITIALIZED = true;

  // Google Analytics script inject karo
  // const script = document.createElement("script");
  // script.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GA_ID}`;
  // script.async = true;
  // document.head.appendChild(script);
  console.log("Analytics loaded"); // TODO: Real GA code yahan
};

const injectMarketing = () => {
  if (window.MARKETING_INITIALIZED) return;
  window.MARKETING_INITIALIZED = true;

  // Facebook Pixel ya koi aur marketing script yahan
  console.log("Marketing loaded"); // TODO: Real pixel code yahan
};

export default useCookieConsent;