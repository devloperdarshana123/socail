import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { resetPassword } from "../lib/redux/authSlice";
import AnimatedCollage from "../components/AnimatedCollage";
import Footer from "../components/Footer";
import ero_logo from "../assets/seller_logo.png";

const ResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useSelector((s) => s.auth.isAuthenticated);
  const [form, setForm] = useState({ newPassword: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // OTP verify ke baad hi yahan aana chahiye
  useEffect(() => {
    if (!isAuthenticated) navigate("/forgot-password", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8)
      return toast.error("The password must be at least 8 characters long.");
    if (form.newPassword !== form.confirm)
      return toast.error("Passwords do not match.");

    setLoading(true);
    const res = await dispatch(resetPassword({ newPassword: form.newPassword }));
    setLoading(false);

    if (resetPassword.fulfilled.match(res)) {
      toast.success("Password has been reset! Please log in now");
      navigate("/login");
    } else {
      toast.error(res.payload || "Something went wrong.");
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
                Set New password 
              </h1>
              <p className="text-sm text-[#8494b4] mt-1">
                “Use a strong password — at least 8 characters.”
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
               { key: "newPassword", label: "New Password", show: showNew, toggle: () => setShowNew(v => !v) },
{ key: "confirm",     label: "Confirm Password", show: showConfirm, toggle: () => setShowConfirm(v => !v) },
              ].map(({ key, label, show, toggle }) => (
                <div key={key} className="relative rounded-xl border-2 border-[#e2e6ef] focus-within:border-[#0f2557] bg-white transition-all duration-200">
                  <input
                    type={show ? "text" : "password"} placeholder=" " required
                    value={form[key]} onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                    disabled={loading}
                    className="peer block w-full bg-transparent pl-4 pr-11 pb-2.5 pt-6 text-sm text-[#0f2557] font-medium focus:outline-none"
                  />
                  <label className="absolute top-4 left-4 text-sm text-[#8494b4] pointer-events-none -translate-y-3 scale-75 origin-left duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-[#0f2557]">
                    {label}
                  </label>
                  <button type="button" onClick={toggle} tabIndex={-1}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8494b4] hover:text-[#0f2557]">
  {show ? (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )}
</button>
                </div>
              ))}
              <button
                type="submit" disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm bg-[#0f2557] text-white hover:bg-[#1a3a7a] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? "Saving..." : " Reset Password →"}
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;