import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EroSocialImg from "../assets/SellerSignupform.svg";
import ero_logo from "../assets/seller_logo.png";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, setCredentials } from "../store/slices/authSlice";
import { signInWithGooglePopup, getGoogleRedirectResult } from "../lib/firebase/googleAuth";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [googleLoading, setGoogleLoading] = useState(false);
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.auth);

  // ✅ Redirect result check on page load (popup-blocked fallback)
  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getGoogleRedirectResult();
        if (!result) return; // Redirect se nahi aaya, kuch mat karo

        setGoogleLoading(true);
        const { idToken } = result;

      const res = await fetch(`${import.meta.env.VITE_SERVER}/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Google login failed");

        dispatch(setCredentials(data));
        toast.success("Logged in with Google! 🎉");
        navigate("/");
      } catch (err) {
        toast.error(err.message || "Google login failed");
      } finally {
        setGoogleLoading(false);
      }
    };

    checkRedirectResult();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error("Please enter all fields"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    const result = await dispatch(loginUser({ email: form.email, password: form.password }));
    if (loginUser.fulfilled.match(result)) {
      toast.success("Logged in successfully! 🎉");
      navigate("/");
    } else {
      toast.error(result.payload || "Invalid credentials");
    }
  };

  // ✅ Google Login Handler — signInWithGooglePopup use karo (fixed)
 const handleGoogleLogin = async () => {
  setGoogleLoading(true);
  try {
    const result = await signInWithGooglePopup();
    if (!result) { setGoogleLoading(false); return; }

    // ✅ idToken ki jagah yeh bhejo — backend yehi expect karta hai
    const res = await fetch(`${import.meta.env.VITE_SERVER}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        googleId: result.googleId,
        email:    result.user.email,
        name:     result.user.name,
        avatar:   result.user.picture,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Google login failed");

    dispatch(setCredentials(data));
    toast.success("Logged in with Google! 🎉");
    navigate("/");
  } catch (err) {
    toast.error(err.message || "Google login failed");
  } finally {
    setGoogleLoading(false);
  }
};

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="w-full h-screen bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full">

          {/* LEFT IMAGE */}
          <div className="hidden lg:flex items-center justify-center p-4 bg-linear-to-br from-indigo-50 to-purple-100">
            <img src={EroSocialImg} alt="EroSocial" className="w-full max-w-md h-auto object-contain" />
          </div>

          {/* RIGHT FORM */}
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto">

              {/* Logo */}
              <div className="mb-8">
                <img src={ero_logo} alt="EroSocial" className="h-16 w-auto object-contain" />
              </div>

              {/* Title */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Login</h2>
                <p className="text-sm text-gray-500 mt-1">Welcome back to EroSocial!</p>
              </div>

              {/* FORM */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email" name="email" placeholder="Enter email address"
                    value={form.email} onChange={handleChange}
                    className="w-full h-12 border-2 border-gray-300 rounded-lg px-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"} name="password"
                      placeholder="Enter password" value={form.password} onChange={handleChange}
                      className="w-full h-12 border-2 border-gray-300 rounded-lg px-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                      {showPassword ? (
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
                  </div>
                </div>

                {/* Terms */}
                <p className="text-xs text-gray-600">
                  By continuing, you agree to our{" "}
                  <a href="#" className="text-gray-900 font-medium hover:underline">Terms of Use</a>{" "}
                  and{" "}
                  <a href="#" className="text-gray-900 font-medium hover:underline">Privacy Policy</a>.
                </p>

                {/* Submit Button */}
                <button type="submit" disabled={loading}
                  className="w-full h-12 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? "Please wait..." : "Continue"}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Google Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full h-12 border-2 border-gray-300 rounded-lg flex items-center justify-center gap-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  {googleLoading ? "Please wait..." : "Continue with Google"}
                </button>

              </form>

              {/* Register Link */}
              <p className="text-center text-sm text-gray-500 mt-6">
                Don't have an account?{" "}
                <Link to="/register" className="text-gray-900 font-semibold hover:underline">Register Now</Link>
              </p>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;