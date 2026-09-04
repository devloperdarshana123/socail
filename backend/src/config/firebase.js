import admin from "firebase-admin";

// Google Sign-In and App Check are optional features layered on top of the
// core (Prisma + JWT) auth flow — email/password and admin login never touch
// this module. Firebase Admin used to initialize eagerly at import time and
// throw synchronously on a bad/missing key, which crashed the whole process
// (including unrelated routes) before the HTTP server could even start.
// Initializing defensively here means a missing/invalid key only disables
// Google Sign-In and App Check, instead of taking the entire API down.
export let firebaseReady = false;

if (!admin.getApps().length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
    firebaseReady = true;
  } catch {
    // Silently degraded — see comment above. Check `firebaseReady` if a
    // caller needs to know whether Firebase-backed features are available.
  }
} else {
  firebaseReady = true;
}

export default admin;