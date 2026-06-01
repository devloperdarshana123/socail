// src/components/GoogleAuthButton.jsx
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { signInWithGoogle, firebaseSignOut } from "../config/firebase";
import { googleLogin } from "../lib/redux/authSlice";

// ─── Google "G" SVG Icon ─────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
// Props:
//   label     — button text (default: "Continue with Google")
//   className — extra tailwind classes for the button
//   onSuccess — optional callback(user) after successful login

export default function GoogleAuthButton({
  label     = "Continue with Google",
  className = "",
  onSuccess,
}) {
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleGoogleAuth() {
    if (loading) return;
    setLoading(true);

    try {
      // Step 1: Get Firebase ID token via Google popup
      const { idToken } = await signInWithGoogle();

      // Step 2: Send token to backend — backend verifies + creates/logs in user
      const result = await dispatch(googleLogin(idToken)).unwrap();

      toast.success(result.message || "Signed in with Google!");

      // Step 3: Navigate based on backend nextRoute
      const route = result.nextRoute || "/feed";
      navigate(route, { replace: true });

      // Step 4: Optional callback
      onSuccess?.(result.user);

    } catch (err) {
      // Firebase popup closed by user — silent, no toast
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") {
        return;
      }
      toast.error(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      // Always sign out from Firebase — we use our own JWT system
      await firebaseSignOut().catch(() => {});
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      disabled={loading}
      className={`
        flex items-center justify-center gap-3 w-full
        px-4 py-2.5 rounded-xl
        bg-white border border-slate-200
        text-slate-700 font-medium text-sm
        hover:bg-slate-50 hover:border-slate-300
        active:scale-[0.98]
        transition-all duration-150
        disabled:opacity-60 disabled:cursor-not-allowed
        shadow-sm
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Signing in...</span>
        </>
      ) : (
        <>
          <GoogleIcon />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}