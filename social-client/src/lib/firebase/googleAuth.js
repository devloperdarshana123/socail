import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

// ══════════════════════════════════════════════════════════════════════════════
// GOOGLE AUTH HELPER
//
// Strategy:
//   1. Popup try karo — fast, no page reload
//   2. Popup blocked by browser → redirect fallback
//   3. Page load pe getRedirectResult check karo
//
// Yeh file sirf Firebase se idToken nikaalti hai.
// idToken ko backend pe bhejne ka kaam authSlice.js ka hai.
// ══════════════════════════════════════════════════════════════════════════════

// ── Sign in with Popup → fallback to Redirect ─────────────────────────────────
// Returns: { idToken, user: { email, name, picture } }
// Throws: Error if both popup and redirect fail
export const signInWithGooglePopup = async () => {
  try {
    // ── Try popup first ───────────────────────────────────────────────────
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();

    console.log("signinwithgogoglepopup me idtoken", idToken, result);

    return {
      idToken,
      user: {
        email: result.user.email,
        name: result.user.displayName,
        picture: result.user.photoURL,
      },
    };
  } catch (error) {
    // ── Popup blocked → fallback to redirect ──────────────────────────────
    // Firebase error codes for blocked popup:
    // auth/popup-blocked        → browser ne block kiya
    // auth/popup-closed-by-user → user ne popup band kiya (don't redirect)
    // auth/cancelled-popup-request → multiple popups (don't redirect)
    if (error.code === "auth/popup-blocked") {
      // Redirect — page reload hoga, getRedirectResult page load pe handle karega
      await signInWithRedirect(auth, googleProvider);
      // Yahan return nahi hota — page reload ho jaata hai
      return null;
    }

    // User ne khud popup band kiya — silently handle karo, error mat throw karo
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) {
      return null;
    }

    // Koi aur error — throw karo
    throw error;
  }
};

// ── Check redirect result on page load ────────────────────────────────────────
// Yeh function App.jsx ya Auth.jsx ke useEffect mein call karo on mount.
// Agar redirect se wapas aaya hai toh result milega, warna null.
//
// Returns: { idToken, user: { email, name, picture } } | null
export const getGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);

    if (!result) return null; // Redirect se nahi aaya

    const idToken = await result.user.getIdToken();

    return {
      idToken,
      user: {
        email: result.user.email,
        name: result.user.displayName,
        picture: result.user.photoURL,
      },
    };
  } catch (error) {
    // Redirect result fetch karne mein error
    console.error("Redirect result error:", error);
    return null;
  }
};