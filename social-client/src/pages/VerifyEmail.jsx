import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ero_logo from "../assets/seller_logo.png";
import api from "../services/api";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // ── Agar email nahi mila toh register pe bhejo ──
  useEffect(() => {
    if (!email) navigate("/register");
  }, [email]);

  // ── Countdown timer ──
  useEffect(() => {
    if (timer === 0) { setCanResend(true); return; }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // ── OTP input handler ──
  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return; // sirf numbers
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    // Auto focus next
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  // ── Backspace handler ──
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  // ── Paste handler ──
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      setOtp(pasted.split(""));
      document.getElementById("otp-5").focus();
    }
  };

  // ── Submit OTP ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) { toast.error("Enter complete 6-digit OTP"); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-email", { email, otp: code });
      toast.success("Email verified! Welcome to Erovians 🎉");
      // Token save karo agar backend deta hai
      if (data.accessToken) {
        localStorage.setItem("erosocial_token", data.accessToken);
        localStorage.setItem("erosocial_user", JSON.stringify(data.user));
      }
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    setResendLoading(true);
    try {
      await api.post("/auth/resend-otp", { email });
      toast.success("OTP resent to your email!");
      setTimer(60);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      document.getElementById("otp-0").focus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend OTP");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-md p-8">

        {/* Logo */}
        <div className="mb-8">
          <img src={ero_logo} alt="Erovians" className="h-14 w-auto object-contain" />
        </div>

        {/* Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Verify your email</h2>
          <p className="text-sm text-gray-500 mt-1">
            We sent a 6-digit OTP to{" "}
            <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        {/* OTP Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* OTP Boxes */}
          <div className="flex gap-3 justify-between" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
            ))}
          </div>

          {/* Timer / Resend */}
          <div className="text-center">
            {canResend ? (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                className="text-sm text-gray-700 font-medium hover:underline disabled:opacity-50"
              >
                {resendLoading ? "Sending..." : "Resend OTP"}
              </button>
            ) : (
              <p className="text-sm text-gray-400">
                Resend OTP in{" "}
                <span className="font-medium text-gray-600">{timer}s</span>
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || otp.join("").length < 6}
            className="w-full h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Verify Email"}
          </button>

        </form>

        {/* Back to Register */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Wrong email?{" "}
          <button
            onClick={() => navigate("/register")}
            className="text-gray-900 font-semibold hover:underline"
          >
            Go back
          </button>
        </p>

      </div>
    </div>
  );
};

export default VerifyEmail;