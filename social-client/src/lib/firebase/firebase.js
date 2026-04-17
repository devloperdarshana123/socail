import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAMeDUuRMUtEXGvJKRBpvs_Qg4W-AcOUzk",
  authDomain: "social-erovians.firebaseapp.com",
  projectId: "social-erovians",
  storageBucket: "social-erovians.firebasestorage.app",
  messagingSenderId: "377356851941",
  appId: "1:377356851941:web:654d2c03b356b203f3120c",
  measurementId: "G-67QL4WVV6B"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });