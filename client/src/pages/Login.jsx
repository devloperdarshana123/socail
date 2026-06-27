import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, clearLoginState, googleLogin  } from "../lib/redux/authSlice";
import api , { setTokenExpiry } from "../lib/services/api";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

import { signInWithGoogle, firebaseSignOut } from "../config/firebase";


// ─────────────────────────────────────────────
//  FloatingInput
// ─────────────────────────────────────────────
const FloatingInput = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  rightElement,
  error,
  autoComplete = "off",
  disabled = false,
}) => (
  <div className="flex flex-col gap-1">
    <div
      className={`
      relative rounded-xl border-2 bg-white transition-all duration-200
      ${disabled ? "opacity-60 cursor-not-allowed" : ""}
      ${error ? "border-red-400" : "border-[#e2e6ef] focus-within:border-[#0f2557]"}
    `}
    >
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder=" "
        autoComplete={autoComplete}
        disabled={disabled}
        className={`
          peer block w-full bg-transparent pl-4
          ${rightElement ? "pr-11" : "pr-4"}
          pb-2.5 pt-6 text-sm text-[#0f2557] font-medium
          focus:outline-none focus:ring-0 disabled:cursor-not-allowed
        `}
      />
      <label
        htmlFor={name}
        className="
        absolute top-4 left-4 z-10 origin-left text-sm duration-200
        pointer-events-none select-none text-[#8494b4]
        -translate-y-3 scale-75
        peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100
        peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]
      "
      >
        {label}
      </label>
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
    {error && (
      <p className="text-xs text-red-500 pl-1 flex items-center gap-1">
        <svg
          className="w-3 h-3 shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        {error}
      </p>
    )}
  </div>
);

// ─────────────────────────────────────────────
//  EyeIcon
// ─────────────────────────────────────────────
const EyeIcon = ({ show, toggle }) => (
  <button
    type="button"
    onClick={toggle}
    className="text-[#8494b4] hover:text-[#0f2557] transition-colors"
    tabIndex={-1}
  >
    {show ? (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
        />
      </svg>
    ) : (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    )}
  </button>
);

// ─────────────────────────────────────────────
//  Spinner
// ─────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v8H4z"
    />
  </svg>
);

// ─────────────────────────────────────────────
//  Login Component
// ─────────────────────────────────────────────
const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { loading, error, success, deactivated } = useSelector((s) => s.auth.login);
  const nextRoute = useSelector((s) => s.auth.nextRoute);
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const user = useSelector((s) => s.auth.user);
  const expiresAt = useSelector((s) => s.auth.expiresAt);

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // ── Already logged in guard ───────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && user) {
      if (!user.isOnboardingComplete) {
        if (user.onboardingStep === 1)
          navigate("/verify-otp", { replace: true });
        else if (user.onboardingStep === 2)
          navigate("/onboarding/username", { replace: true });
      } else {
        navigate("/feed", { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  // ── Backend error ─────────────────────────────────────────────
useEffect(() => {
  if (!error) return;
  console.log("Login error:", error);

if (
  error.toLowerCase().includes("password") ||
  error.toLowerCase().includes("incorrect") ||
  error.toLowerCase().includes("wrong")
) {
  setErrors({ password: error });
} else if (
  error.toLowerCase().includes("email") ||
  error.toLowerCase().includes("account") ||
  error.toLowerCase().includes("found") ||
  error.toLowerCase().includes("user") ||
  error.toLowerCase().includes("exist")
) {
  setErrors({ email: error });
} else {
  toast.error(error);
}
  const t = setTimeout(() => dispatch(clearLoginState()), 100);
  return () => clearTimeout(t);
}, [error, dispatch]);




useEffect(() => {
  if (success && nextRoute) {
    setTokenExpiry(expiresAt);   // ← null se exact value
    navigate(nextRoute);
    dispatch(clearLoginState());
  }
}, [success, nextRoute, navigate, dispatch, expiresAt]);
  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      dispatch(clearLoginState());
    };
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";
    if (!form.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    const firstError = Object.values(newErrors)[0];
    if (firstError) toast.error(firstError);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(
      loginUser({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      }),
    );
  };



  const handleReactivate = async () => {
  if (!deactivated?.userId || !form.password) {
    toast.error("Password is required to reactivate.");
    return;
  }
  try {
    setReactivateLoading(true);
    const res = await api.post("/settings/reactivate", {
      userId: deactivated.userId,
      password: form.password,
    });
    toast.success("Account reactivated! Welcome back 🎉");
    dispatch(clearLoginState());
    navigate(res.data?.nextRoute || "/feed", { replace: true });
  } catch (err) {
    toast.error(err?.response?.data?.message || "Reactivation failed.");
  } finally {
    setReactivateLoading(false);
  }
};
const handleGoogleLogin = async () => {
  try {
    const { idToken } = await signInWithGoogle();
    
    const result = await dispatch(googleLogin(idToken)).unwrap();
setTokenExpiry(result.expiresAt || null);  
toast.success(result.message || "Signed in with Google!");
navigate(result.nextRoute || "/feed", { replace: true });
  } catch (err) {
    if (
      err?.code === "auth/popup-closed-by-user" ||
      err?.code === "auth/cancelled-popup-request"
    ) return;
    toast.error(err?.message || "Google sign-in failed. Please try again.");
  } finally {
    await firebaseSignOut().catch(() => {});
  }
};
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_1px_2fr]">
        {/* ── LEFT — Animated Collage ── */}
        <div className="hidden lg:flex flex-col p-8">
          <img
            src={ero_logo}
            alt="Erovians"
            className="h-12 w-auto object-contain self-start"
          />
          <div className="flex-1 flex items-center justify-center">
            <AnimatedCollage />
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div className="hidden lg:block bg-[#e2e6ef]" />

        {/* ── RIGHT — Form ── */}
        <div className="flex flex-col justify-center px-6 py-10 md:px-10 overflow-y-auto">
          <div className="w-full max-w-sm mx-auto">
            {/* Mobile logo */}
            <div className="flex lg:hidden mb-8">
              <img
                src={ero_logo}
                alt="Erovians"
                className="h-9 w-auto object-contain"
              />
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#0f2557] leading-tight">
                Welcome back
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="text-[#0f2557] font-semibold hover:underline underline-offset-2"
                >
                  Sign up
                </Link>
              </p>
            </div>

            {deactivated && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
      <h2 className="text-lg font-bold text-[#0f2557] mb-2">
        Account Deactivated
      </h2>
      <p className="text-sm text-[#8494b4] mb-5">
        Your account is deactivated. Would you like to reactivate it and restore all your posts?
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={handleReactivate}
          disabled={reactivateLoading}
          className="w-full h-11 rounded-xl bg-[#0f2557] text-white text-sm font-semibold hover:bg-[#1a3a7a] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {reactivateLoading ? <><Spinner /> Reactivating...</> : "Yes, Reactivate"}
        </button>
        <button
          onClick={() => dispatch(clearLoginState())}
          disabled={reactivateLoading}
          className="w-full h-11 rounded-xl border-2 border-[#e2e6ef] text-[#0f2557] text-sm font-semibold hover:border-[#0f2557] transition-all disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FloatingInput
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                disabled={loading}
              />

              <FloatingInput
                label="Password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
                disabled={loading}
                rightElement={
                  <EyeIcon
                    show={showPassword}
                    toggle={() => setShowPassword((v) => !v)}
                  />
                }
              />

              {/* Forgot password */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#8494b4] hover:text-[#0f2557] transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="
                  w-full h-12 rounded-xl font-semibold text-sm
                  bg-[#0f2557] text-white
                  hover:bg-[#1a3a7a] active:scale-[0.98]
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {loading ? (
                  <>
                    <Spinner /> Signing in...
                  </>
                ) : (
                  "Sign in →"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#e2e6ef]" />
                <span className="text-xs text-[#8494b4] font-medium">or</span>
                <div className="flex-1 h-px bg-[#e2e6ef]" />
              </div>

              {/* Google */}
              <button
                type="button"
                disabled={loading}
                 onClick={handleGoogleLogin}
                className="
                  w-full h-12 rounded-xl
                  border-2 border-[#e2e6ef]
                  flex items-center justify-center gap-3
                  text-sm font-semibold text-[#0f2557]
                  hover:border-[#0f2557] hover:bg-[#f5f7fc]
                  active:scale-[0.98] transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
