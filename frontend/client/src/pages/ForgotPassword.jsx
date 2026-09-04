import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { forgotPassword, setPending } from "../lib/redux/authSlice";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email daalo");
    setLoading(true);

    const res = await dispatch(forgotPassword(email.trim().toLowerCase()));
    setLoading(false);

    if (forgotPassword.fulfilled.match(res)) {
      toast.success("OTP has been sent!");
      const { userId, purpose } = res.payload.data || {};
      if (userId) {
        dispatch(setPending({ userId, purpose }));
        navigate("/verify-otp");
      }
    } else {
      toast.error(res.payload || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_1px_2fr]">
        <div className="hidden lg:flex flex-col p-8">
          <img src={ero_logo} alt="Erovians" className="h-12 w-auto object-contain self-start" />
          <div className="flex-1 flex items-center justify-center">
            <AnimatedCollage />
          </div>
        </div>
        <div className="hidden lg:block bg-[#e2e6ef]" />
        <div className="flex flex-col justify-center px-6 py-10 md:px-10">
          <div className="w-full max-w-sm mx-auto">
            <div className="flex lg:hidden mb-8">
              <img src={ero_logo} alt="Erovians" className="h-9 w-auto object-contain" />
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#0f2557] leading-tight">
                Forgot password?
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                Enter your registered email. We’ll send you an OTP.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative rounded-xl border-2 border-[#e2e6ef] focus-within:border-[#0f2557] bg-white transition-all duration-200">
                <input
                  type="email" required placeholder=" "
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="peer block w-full bg-transparent pl-4 pr-4 pb-2.5 pt-6 text-sm text-[#0f2557] font-medium focus:outline-none"
                />
                <label className="absolute top-4 left-4 text-sm text-[#8494b4] pointer-events-none -translate-y-3 scale-75 origin-left duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]">
                  Email Address
                </label>
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm bg-[#0f2557] text-white hover:bg-[#1a3a7a] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Sending..." : "Request OTP ->"}
              </button>
            </form>
            <div className="mt-8 pt-6 border-t border-[#e2e6ef]">
              <button
                onClick={() => navigate("/login")}
                className="text-xs text-[#8494b4] hover:text-[#0f2557] transition-colors"
              >
                ← Go back to the login page.
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ForgotPassword;