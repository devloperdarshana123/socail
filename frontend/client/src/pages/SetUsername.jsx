import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUsernameSuggestions,
  checkUsernameAvailability,
  setUsername,
  clearOnboardingState,
} from "../lib/redux/authSlice";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

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
//  SetUsername Component
// ─────────────────────────────────────────────
const SetUsername = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector((s) => s.auth.user);
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const nextRoute = useSelector((s) => s.auth.nextRoute);
  const {
    suggestions,
    suggestionsLoading,
    checkLoading,
    checkResult,
    setLoading,
    error,
  } = useSelector((s) => s.auth.onboarding);

  const [input, setInput] = useState("");
  const debounceRef = useRef(null);

  // ── Guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate("/", { replace: true });
      return;
    }
    if (user.isOnboardingComplete) {
      navigate("/feed", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // ── Fetch suggestions on mount ────────────────────────────────
  useEffect(() => {
    dispatch(fetchUsernameSuggestions());
    return () => {
      dispatch(clearOnboardingState());
    };
  }, [dispatch]);

  // ── Error toast ───────────────────────────────────────────────
  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearOnboardingState()); // ← add karo
    }
  }, [error, dispatch]);

  const prevSetLoading = useRef(false);
  useEffect(() => {
    if (prevSetLoading.current && !setLoading && nextRoute === "/feed") {
      toast.success("Welcome to Erovians! 🎉");
      navigate("/feed", { replace: true });
      dispatch(clearOnboardingState());
    }
    prevSetLoading.current = setLoading;
  }, [setLoading, nextRoute, navigate, dispatch]);

  // ── Input change + debounce check ────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setInput(val);
    clearTimeout(debounceRef.current);
    if (val.length < 3) return;
    debounceRef.current = setTimeout(() => {
      dispatch(checkUsernameAvailability(val));
    }, 500);
  };

  // ── Suggestion click ──────────────────────────────────────────
  const handleSuggestionClick = (s) => {
    setInput(s);
    dispatch(checkUsernameAvailability(s));
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return toast.error("Username is required");
    if (input.length < 3) return toast.error("At least 3 characters required");
    if (checkResult && !checkResult.available)
      return toast.error("Username is already taken");
    dispatch(setUsername(input));
  };

  // ── Availability status ───────────────────────────────────────
  const renderStatus = () => {
    if (input.length < 3) return null;
    if (checkLoading)
      return (
        <p className="text-xs text-[#8494b4] flex items-center gap-1.5 pl-1">
          <Spinner /> Checking...
        </p>
      );
    if (!checkResult) return null;
    if (checkResult.available)
      return (
        <p className="text-xs text-emerald-500 pl-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          @{checkResult.username} is available
        </p>
      );
    return (
      <p className="text-xs text-red-500 pl-1 flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        @{checkResult.username} is already taken
      </p>
    );
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
                Step 3 of 3
              </p>
              <h1 className="text-2xl font-bold text-[#0f2557] leading-tight">
                Pick your username
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                This is how others will find you on Erovians.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Input */}
              <div className="flex flex-col gap-1">
                <div
                  className={`
                  relative rounded-xl border-2 bg-white transition-all duration-200
                  ${
                    checkResult && !checkResult.available && input.length >= 3
                      ? "border-red-400"
                      : checkResult?.available
                        ? "border-emerald-400"
                        : "border-[#e2e6ef] focus-within:border-[#0f2557]"
                  }
                `}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={handleInputChange}
                    placeholder=" "
                    maxLength={30}
                    disabled={setLoading}
                    className="
                      peer block w-full bg-transparent
                      pl-8 pr-4 pb-2.5 pt-6
                      text-sm text-[#0f2557] font-medium
                      focus:outline-none focus:ring-0
                      disabled:cursor-not-allowed
                    "
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8494b4] text-sm pointer-events-none select-none">
                    @
                  </span>
                  <label
                    className="
                    absolute top-4 left-8 z-10 origin-left text-sm duration-200
                    pointer-events-none select-none text-[#8494b4]
                    -translate-y-3 scale-75
                    peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100
                    peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]
                  "
                  >
                    Username
                  </label>
                </div>
                {renderStatus()}
              </div>

              {/* Suggestions */}
              <div>
                <p className="text-xs text-[#8494b4] mb-2 font-medium">
                  {suggestionsLoading
                    ? "Generating suggestions..."
                    : "Suggestions for you"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestionsLoading
                    ? Array(4)
                        .fill(0)
                        .map((_, i) => (
                          <div
                            key={i}
                            className="h-8 w-24 rounded-lg bg-[#f5f7fc] animate-pulse"
                          />
                        ))
                    : suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className={`
                            px-3 py-1.5 rounded-lg text-xs font-semibold
                            border-2 transition-all duration-150
                            ${
                              input === s
                                ? "border-[#0f2557] bg-[#0f2557] text-white"
                                : "border-[#e2e6ef] text-[#0f2557] hover:border-[#0f2557] hover:bg-[#f5f7fc]"
                            }
                          `}
                        >
                          @{s}
                        </button>
                      ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={
                  setLoading ||
                  checkLoading ||
                  (checkResult && !checkResult.available)
                }
                className="
                  w-full h-12 rounded-xl font-semibold text-sm
                  bg-[#0f2557] text-white
                  hover:bg-[#1a3a7a] active:scale-[0.98]
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {setLoading ? (
                  <>
                    <Spinner /> Setting username...
                  </>
                ) : (
                  "Finish →"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default SetUsername;
