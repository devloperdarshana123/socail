// src/config/firebase.js

const FIREBASE_TOKEN_VERIFY_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

export const verifyGoogleToken = async (idToken) => {
  if (!idToken) throw new Error("ID Token is required");

  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY not set in .env");

  const response = await fetch(`${FIREBASE_TOKEN_VERIFY_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error("Invalid or expired Google token. Please try again.");
  }

  const firebaseUser = data.users?.[0];
  if (!firebaseUser) throw new Error("Invalid or expired Google token.");
  if (!firebaseUser.emailVerified) throw new Error("Google email is not verified.");

  return {
    googleId: firebaseUser.localId,
    email: firebaseUser.email,
    name: firebaseUser.displayName || null,
    picture: firebaseUser.photoUrl || null,
  };
};