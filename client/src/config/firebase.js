// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

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