import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import {
  verifyOtp,
  resendOtp,
  clearOtpState,
  clearResendState,
} from "../lib/redux/authSlice";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

const RESEND_COOLDOWN = 30;

const OtpBox = ({
  index,
  value,
  onChange,
  onKeyDown,
  onPaste,
  inputRef,
  shake,
  hasError,
}) => (
  <input
    ref={inputRef}
    type="text"
    inputMode="numeric"
    maxLength={1}
    value={value}
    onChange={(e) => onChange(e, index)}
    onKeyDown={(e) => onKeyDown(e, index)}
    onPaste={(e) => onPaste(e, index)}
    onFocus={(e) => e.target.select()}
    className={`
      w-11 h-14 text-center text-xl font-bold rounded-xl border-2
      bg-white text-[#0f2557]
      transition-all duration-150 outline-none
      focus:border-[#0f2557] focus:shadow-[0_0_0_3px_rgba(15,37,87,0.08)]
      ${hasError ? "border-red-400 bg-red-50 text-red-500" : value ? "border-[#0f2557]" : "border-[#e2e6ef]"}
      ${shake ? "animate-shake" : ""}
    `}
    style={shake ? { animation: "shake 0.4s ease" } : {}}
  />
);

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

const VerifyOTP = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const pendingUserId = useSelector((s) => s.auth.pendingUserId);
  const pendingPurpose = useSelector((s) => s.auth.pendingPurpose);
  const nextRoute = useSelector((s) => s.auth.nextRoute);
  const {
    loading: verifyLoading,
    error: verifyError,
    success: verifySuccess,
  } = useSelector((s) => s.auth.otp);
  const {
    loading: resendLoading,
    success: resendSuccess,
    error: resendError,
  } = useSelector((s) => s.auth.resend);

  const [digits, setDigits] = useState(Array(6).fill(""));
  const [shake, setShake] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  // ── Guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingUserId) navigate("/register", { replace: true });
  }, [pendingUserId, navigate]);

  // ── Cooldown timer ────────────────────────────────────────────
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setCooldown(RESEND_COOLDOWN);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  // ── Verify success ────────────────────────────────────────────
  useEffect(() => {
    if (verifySuccess) {
      toast.success("Verified! 🎉");
      navigate(nextRoute || "/onboarding/username");
      dispatch(clearOtpState());
    }
  }, [verifySuccess, nextRoute, navigate, dispatch]);

  // ── Verify error ──────────────────────────────────────────────
  useEffect(() => {
    if (verifyError) {
      toast.error(verifyError);
      setHasError(true);
      setShake(true);
      setDigits(Array(6).fill(""));
      inputRefs.current[0]?.focus();
      setTimeout(() => {
        setShake(false);
        setHasError(false);
      }, 600);
      dispatch(clearOtpState());
    }
  }, [verifyError, dispatch]);

  // ── Resend success/error ──────────────────────────────────────
  useEffect(() => {
    if (resendSuccess) {
      toast.success("OTP resent! Check your email 📧");
      startTimer();
      dispatch(clearResendState());
    }
    if (resendError) {
      toast.error(resendError);
      dispatch(clearResendState());
    }
  }, [resendSuccess, resendError, dispatch, startTimer]);

  // ── Cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      dispatch(clearOtpState());
      dispatch(clearResendState());
    };
  }, [dispatch]);

  const submitOtp = useCallback(
    (filledDigits) => {
      const otp = filledDigits.join("");
      if (otp.length !== 6) return;
      dispatch(
        verifyOtp({ userId: pendingUserId, purpose: pendingPurpose, otp }),
      );
    },
    [dispatch, pendingUserId, pendingPurpose],
  );

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) return;
    const newDigits = [...digits];
    newDigits[index] = val.slice(-1);
    setDigits(newDigits);
    if (index < 5) inputRefs.current[index + 1]?.focus();
    if (newDigits.every((d) => d !== "")) submitOtp(newDigits);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = "";
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0)
      inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5)
      inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const newDigits = Array(6).fill("");
    pasted.split("").forEach((char, i) => {
      newDigits[i] = char;
    });
    setDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) submitOtp(newDigits);
  };

  const handleResend = () => {
    if (!canResend || resendLoading) return;
    dispatch(resendOtp({ userId: pendingUserId, purpose: pendingPurpose }));
  };

  const purposeLabel =
    pendingPurpose === "mobile_verify" ? "phone number" : "email address";

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-6px); }
          30%      { transform: translateX(6px); }
          45%      { transform: translateX(-5px); }
          60%      { transform: translateX(5px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(3px); }
        }
      `}</style>

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
                  Step 2 of 3
                </p>
                <h1 className="text-2xl font-bold text-[#0f2557] leading-tight mb-2">
                  Check your {purposeLabel}
                </h1>
                <p className="text-sm text-[#8494b4] leading-relaxed">
                  We sent a 6-digit code to your {purposeLabel}. Enter it below
                  to continue.
                </p>
              </div>

              {/* OTP Boxes */}
              <div className="flex gap-2.5 justify-between mb-6">
                {digits.map((digit, i) => (
                  <OtpBox
                    key={i}
                    index={i}
                    value={digit}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    inputRef={(el) => (inputRefs.current[i] = el)}
                    shake={shake}
                    hasError={hasError}
                  />
                ))}
              </div>

              {/* Loading hint */}
              <div className="h-5 mb-4">
                {verifyLoading && (
                  <p className="text-xs text-[#8494b4] flex items-center gap-1.5">
                    <Spinner /> Verifying...
                  </p>
                )}
              </div>

              {/* Resend */}
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-[#8494b4]">Didn't receive it?</span>
                {canResend ? (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="font-semibold text-[#0f2557] hover:underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {resendLoading ? "Sending..." : "Resend code"}
                  </button>
                ) : (
                  <span className="text-[#8494b4]">
                    Resend in{" "}
                    <span className="font-semibold text-[#0f2557] tabular-nums">
                      {cooldown}s
                    </span>
                  </span>
                )}
              </div>

              {/* Back */}
              <div className="mt-8 pt-6 border-t border-[#e2e6ef]">
<button
  onClick={() => navigate(
    pendingPurpose === "forgot_password" ? "/forgot-password" : "/register"
  )}
  className="text-xs text-[#8494b4] hover:text-[#0f2557] transition-colors"
>
  ← {pendingPurpose === "forgot_password" ? "Back to forgot password" : "Wrong email? Go back"}
</button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
};

export default VerifyOTP;
