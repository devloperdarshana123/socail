import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { registerUser, clearRegisterState } from "../lib/redux/authSlice";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";
import { signInWithGoogle, firebaseSignOut } from "../config/firebase";
import { googleLogin } from "../lib/redux/authSlice";
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
  leftSymbol,
  error,
  autoComplete = "off",
  disabled = false,
}) => (
  <div className="flex flex-col gap-1">
    <div
      className={`
        relative rounded-xl border-2 bg-white transition-all duration-200
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        ${
          error
            ? "border-red-400"
            : "border-[#e2e6ef] focus-within:border-[#0f2557]"
        }
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
          peer block w-full bg-transparent
          ${leftSymbol ? "pl-8" : "pl-4"}
          ${rightElement ? "pr-11" : "pr-4"}
          pb-2.5 pt-6
          text-sm text-[#0f2557] font-medium
          focus:outline-none focus:ring-0
          disabled:cursor-not-allowed
        `}
      />
      {leftSymbol && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8494b4] text-sm pointer-events-none select-none">
          {leftSymbol}
        </span>
      )}
      <label
        htmlFor={name}
        className={`
          absolute top-4 z-10 origin-left text-sm duration-200 pointer-events-none select-none
          ${leftSymbol ? "left-8" : "left-4"}
          text-[#8494b4]
          -translate-y-3 scale-75
          peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100
          peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]
        `}
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
//  Password Strength
// ─────────────────────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return null;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (password.length < 6)
    return { label: "Weak", color: "#ef4444", width: "25%", level: 1 };
  if (password.length < 8)
    return { label: "Fair", color: "#f97316", width: "50%", level: 2 };
  if (!hasUpper || !hasNumber)
    return { label: "Medium", color: "#f59e0b", width: "66%", level: 3 };
  if (hasUpper && hasNumber && hasSpecial && password.length >= 10)
    return { label: "Strong", color: "#10b981", width: "100%", level: 4 };
  return { label: "Good", color: "#3b82f6", width: "83%", level: 3 };
};

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
//  Register Component
// ─────────────────────────────────────────────
const Register = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { loading, error, success } = useSelector((s) => s.auth.register);
  const nextRoute = useSelector((s) => s.auth.nextRoute);

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});

  const strength = getPasswordStrength(form.password);

  // ── Backend error ────────────────────────────────────────────
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // ── Success → navigate ───────────────────────────────────────
  useEffect(() => {
    if (success) {
      toast.success("OTP sent to your email! 📧");
      navigate(nextRoute || "/verify-otp");
      dispatch(clearRegisterState());
    }
  }, [success, nextRoute, navigate, dispatch]);

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      dispatch(clearRegisterState());
    };
  }, [dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (form.fullName.trim().length < 2) {
      newErrors.fullName = "At least 2 characters required";
    } else if (form.fullName.trim().length > 60) {
      newErrors.fullName = "Cannot exceed 60 characters";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Enter a valid email address";
    }

    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (form.password.length < 8) {
      newErrors.password = "At least 8 characters required";
    }

    setErrors(newErrors);

    const firstError = Object.values(newErrors)[0];
    if (firstError) toast.error(firstError);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    dispatch(
      registerUser({
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      }),
    );
  };


  const handleGoogleRegister = async () => {
  try {
    const { idToken } = await signInWithGoogle();
    const result = await dispatch(googleLogin(idToken)).unwrap();
    toast.success(result.message || "Account created with Google!");
    navigate(result.nextRoute || "/feed", { replace: true });
  } catch (err) {
    if (
      err?.code === "auth/popup-closed-by-user" ||
      err?.code === "auth/cancelled-popup-request"
    ) return;
    toast.error(err?.message || "Google sign-up failed. Please try again.");
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
              <p className="text-xs font-semibold tracking-widest text-[#8494b4] uppercase mb-2">
                Step 1 of 3
              </p>
              <h1 className="text-2xl font-bold text-[#0f2557] leading-tight">
                Create your account
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                Already have one?{" "}
                <Link
                  to="/login"
                  className="text-[#0f2557] font-semibold hover:underline underline-offset-2"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full Name */}
              <FloatingInput
                label="Full Name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                error={errors.fullName}
                autoComplete="name"
                disabled={loading}
              />

              {/* Email */}
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

              {/* Password + strength */}
              <div className="flex flex-col gap-1">
                <FloatingInput
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  error={errors.password}
                  autoComplete="new-password"
                  disabled={loading}
                  rightElement={
                    <EyeIcon
                      show={showPassword}
                      toggle={() => setShowPassword((v) => !v)}
                    />
                  }
                />
                {form.password && strength && (
                  <div className="px-1">
                    <div className="h-1 w-full bg-[#e2e6ef] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: strength.width,
                          backgroundColor: strength.color,
                        }}
                      />
                    </div>
                    <p
                      className="text-xs mt-1 font-medium"
                      style={{ color: strength.color }}
                    >
                      {strength.label} password
                    </p>
                  </div>
                )}
              </div>

              {/* Terms */}
              <p className="text-xs text-[#8494b4] leading-relaxed pt-1">
                By continuing, you agree to our{" "}
                <a
                  href="#"
                  className="text-[#0f2557] font-medium hover:underline underline-offset-2"
                >
                  Terms of Use
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="text-[#0f2557] font-medium hover:underline underline-offset-2"
                >
                  Privacy Policy
                </a>
                .
              </p>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                 onClick={handleGoogleRegister} 
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
                    <Spinner />
                    Creating account...
                  </>
                ) : (
                  "Continue →"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#e2e6ef]" />
                <span className="text-xs text-[#8494b4] font-medium">or</span>
                <div className="flex-1 h-px bg-[#e2e6ef]" />
              </div>

              {/* Google — UI only, backend baad mein */}
              <button
                type="button"
                disabled={loading}
                className="
                  w-full h-12 rounded-xl
                  border-2 border-[#e2e6ef]
                  flex items-center justify-center gap-3
                  text-sm font-semibold text-[#0f2557]
                  hover:border-[#0f2557] hover:bg-[#f5f7fc]
                  active:scale-[0.98]
                  transition-all duration-200
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

export default Register;
