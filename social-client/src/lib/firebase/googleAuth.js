import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

// Throws: Error if both popup and redirect fail
export const signInWithGooglePopup = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();

    return {
      idToken,
      // ✅ Yeh add karo
      googleId: result.user.uid,
      user: {
        email:   result.user.email,
        name:    result.user.displayName,
        picture: result.user.photoURL,
      },
    };
  } catch (error) {
    if (error.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    if (
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request"
    ) return null;
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