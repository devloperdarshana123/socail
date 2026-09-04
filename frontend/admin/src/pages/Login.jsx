
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { adminLogin, clearLoginState } from "../lib/redux/AdminauthSlice";
import { setAdminTokenExpiry } from "../services/api";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

// ─────────────────────────────────────────────
//  FloatingInput
// ─────────────────────────────────────────────
const FloatingInput = ({
  label, name, type = "text", value, onChange,
  rightElement, error, autoComplete = "off", disabled = false,
}) => (
  <div className="flex flex-col gap-1">
    <div className={`
      relative rounded-xl border-2 bg-white transition-all duration-200
      ${disabled ? "opacity-60 cursor-not-allowed" : ""}
      ${error ? "border-red-400" : "border-[#e2e6ef] focus-within:border-[#0f2557]"}
    `}>
      <input
        id={name} name={name} type={type} value={value}
        onChange={onChange} placeholder=" " autoComplete={autoComplete}
        disabled={disabled}
        className={`
          peer block w-full bg-transparent pl-4
          ${rightElement ? "pr-11" : "pr-4"}
          pb-2.5 pt-6 text-sm text-[#0f2557] font-medium
          focus:outline-none focus:ring-0 disabled:cursor-not-allowed
        `}
      />
      <label htmlFor={name} className="
        absolute top-4 left-4 z-10 origin-left text-sm duration-200
        pointer-events-none select-none text-[#8494b4]
        -translate-y-3 scale-75
        peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100
        peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]
      ">
        {label}
      </label>
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>
      )}
    </div>
    {error && (
      <p className="text-xs text-red-500 pl-1 flex items-center gap-1">
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
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
  <button type="button" onClick={toggle}
    className="text-[#8494b4] hover:text-[#0f2557] transition-colors" tabIndex={-1}>
    {show ? (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    ) : (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    )}
  </button>
);

// ─────────────────────────────────────────────
//  Spinner
// ─────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);

// ─────────────────────────────────────────────
//  Login Component
// ─────────────────────────────────────────────
const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { loading, error, success } = useSelector((s) => s.adminAuth.login);
  const expiresAt = useSelector((s) => s.adminAuth.expiresAt);

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  // ── Backend error → field error ya toast ─────────────────────
  useEffect(() => {
    if (!error) return;

    if (
      error.toLowerCase().includes("password") ||
      error.toLowerCase().includes("incorrect")
    ) {
      setErrors({ password: error });
    } else if (
      error.toLowerCase().includes("email") ||
      error.toLowerCase().includes("user") ||
      error.toLowerCase().includes("found")
    ) {
      setErrors({ email: error });
    } else {
      toast.error(error);
    }

    const t = setTimeout(() => dispatch(clearLoginState()), 100);
    return () => clearTimeout(t);
  }, [error, dispatch]);

  // ── Success → dashboard ───────────────────────────────────────
  // useEffect(() => {
  //   if (success) {
  //     navigate("/dashboard", { replace: true });
  //     dispatch(clearLoginState());
  //   }
  // }, [success, navigate, dispatch]);

  useEffect(() => {
  if (success) {
    setAdminTokenExpiry(expiresAt);
    navigate("/dashboard", { replace: true });
    dispatch(clearLoginState());
  }
}, [success, navigate, dispatch, expiresAt]);
  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => { dispatch(clearLoginState()); };
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
    dispatch(adminLogin({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_1px_2fr]">

        {/* ── LEFT — Animated Collage ── */}
        <div className="hidden lg:flex flex-col p-8">
          <img src={ero_logo} alt="Erovians" className="h-12 w-auto object-contain self-start" />
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
              <img src={ero_logo} alt="Erovians" className="h-9 w-auto object-contain" />
            </div>

            {/* Heading */}
            <div className="mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f2557] bg-[#e8ecf7] px-3 py-1 rounded-full mb-3">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Super Admin
              </span>
              <h1 className="text-2xl font-bold text-[#0f2557] leading-tight">
                Admin Portal
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                Restricted access. Authorized personnel only.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FloatingInput
                label="Email Address" name="email" type="email"
                value={form.email} onChange={handleChange}
                error={errors.email} autoComplete="email" disabled={loading}
              />
              <FloatingInput
                label="Password" name="password"
                type={showPassword ? "text" : "password"}
                value={form.password} onChange={handleChange}
                error={errors.password} autoComplete="current-password"
                disabled={loading}
                rightElement={
                  <EyeIcon show={showPassword} toggle={() => setShowPassword((v) => !v)} />
                }
              />

              <button
                type="submit" disabled={loading}
                className="
                  w-full h-12 rounded-xl font-semibold text-sm mt-2
                  bg-[#0f2557] text-white
                  hover:bg-[#1a3a7a] active:scale-[0.98]
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {loading ? <><Spinner /> Signing in...</> : "Sign in →"}
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