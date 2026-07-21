// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey           : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain       : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId        : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket    : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId            : import.meta.env.VITE_FIREBASE_APP_ID,
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

// App Check — proves requests come from our real web app, not a script.
// Requires VITE_RECAPTCHA_SITE_KEY (Firebase Console → App Check → register
// the web app → reCAPTCHA v3 provider). Skipped silently if unset so local
// dev without the key doesn't crash — set it in every deployed environment.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
export const appCheck = recaptchaSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;

// Always show account picker — even if user is already signed in
provider.setCustomParameters({ prompt: "select_account" });

// ─── Google Sign-In ───────────────────────────────────────────────────────────
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();
  return { idToken, user: result.user };
}

// ─── Firebase Sign-Out (clears Google session from browser) ──────────────────
export async function firebaseSignOut() {
  await signOut(auth);
}

export { auth };
export default app;