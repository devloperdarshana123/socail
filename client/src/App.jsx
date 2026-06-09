

import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster, toast } from "react-hot-toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOTP from "./pages/VerifyOTP";
import SetUsername from "./pages/SetUsername";
import PrivacyPage from "./pages/PrivacyPage";
import Terms from "./pages/Terms";
import Legal from "./pages/LegalPage";
import About from "./pages/About";
import Help from "./pages/Help";
import Locations from "./pages/Locations";
import Contact from "./pages/Contact";
import CookieBanner from "./components/CookieBanner";
import FeedPage from "./pages/FeedPage";
import Navbar from "./components/Navbar";
import PostCreatorModal from "./components/PostCreatorModal";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Explore from "./pages/Explore";
import Saved from "./pages/Saved";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Messages from "./pages/Messages";
import PublicProfile from "./pages/PublicProfile";
import { fetchMe, resetAuth } from "./lib/redux/authSlice";
import { resetProfile } from "./lib/redux/userprofileslice";
import { createPost } from "./lib/redux/postSlice";
import { fetchNotifications } from "./lib/redux/notificationSlice";
// existing imports ke saath
import { setTokenExpiry } from "./lib/services/api";
// ✅ Socket hooks — sirf ek baar App level pe mount karo
import useSocketInit from "./lib/hooks/useSocketInit";


const ProtectedRoute = ({ children }) => {
  const { user, fetchMe: { loading } } = useSelector((s) => s.auth);
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
};
const HIDE_NAVBAR_ON = ["/", "/register", "/verify-otp", "/onboarding/username", "/forgot-password", "/reset-password"];
const HIDE_BANNER_ON = ["/privacy", "/terms", "/legal", "/help", "/about", "/locations", "/contact"];

const App = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

  // const user    = useSelector((state) => state.auth.user);
  // const creating = useSelector((state) => state.posts.creating);


  const user           = useSelector((state) => state.auth.user);
const creating       = useSelector((state) => state.posts.creating);
const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  const showBanner = !HIDE_BANNER_ON.includes(location.pathname);
  const showNavbar = !HIDE_NAVBAR_ON.includes(location.pathname);

  // ✅ Socket — ek baar connect, poori app mein reuse hoga
  useSocketInit();

  const [showPostModal, setShowPostModal] = useState(() =>
    new URLSearchParams(window.location.search).get("modal") === "create-post"
  );

  // App load pe user fetch
 useEffect(() => {
  dispatch(fetchMe()).then((result) => 
    
    {
    // Agar user already logged in hai (page reload) toh silent refresh shuru karo
    if (fetchMe.fulfilled.match(result)) {
       setTokenExpiry(null);
    }
  });
}, []);

  // Force logout handler
  useEffect(() => {
  const handleForceLogout = () => {
  dispatch(resetAuth());
  dispatch(resetProfile());
  navigate("/", { replace: true });
};
window.addEventListener("auth:logout", handleForceLogout);
return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, [dispatch, navigate]);

  // Token refresh — localStorage update
  // useEffect(() => {
  //   const handleTokenRefreshed = (e) => {
  //     if (e.detail?.token) localStorage.setItem("accessToken", e.detail.token);
  //   };
  //   window.addEventListener("auth:tokenRefreshed", handleTokenRefreshed);
  //   return () => window.removeEventListener("auth:tokenRefreshed", handleTokenRefreshed);
  // }, []);


  useEffect(() => {
  if (user?._id) {
    dispatch(fetchNotifications({ page: 1 }));
  }
}, [user?._id]);



  const handlePostSubmit = async (postData) => {
  const result = await dispatch(createPost(postData));
  if (createPost.fulfilled.match(result)) {
    setShowPostModal(false);
    toast.success(postData.isDraft ? "Draft saved! 📝" : "Post shared! 🎉");
  } else {
    throw new Error(result.payload);
  }
};
  return (
    <>
      {showNavbar && (
        <Navbar onCreatePost={() => {
          setShowPostModal(true);
          window.history.pushState({}, "", "?modal=create-post");
        }} />
      )}

      <Routes>
        <Route path="/"                    element={<Login />} />
        <Route path="/register"            element={<Register />} />
        <Route path="/verify-otp"          element={<VerifyOTP />} />
        <Route path="/onboarding/username" element={<SetUsername />} />
        <Route path="/feed"              element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
        <Route path="/privacy"             element={<PrivacyPage />} />
        <Route path="/terms"               element={<Terms />} />
        <Route path="/legal"               element={<Legal />} />
        <Route path="/about"               element={<About />} />
        <Route path="/help"                element={<Help />} />
        <Route path="/locations"           element={<Locations />} />
        <Route path="/contact"             element={<Contact />} />
       <Route path="/profile"           element={<ProtectedRoute><Profile /></ProtectedRoute>} />
   <Route path="/profile/:username" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
       <Route path="/explore"           element={<ProtectedRoute><Explore /></ProtectedRoute>} />
        <Route path="/forgot-password"     element={<ForgotPassword />} />
        <Route path="/reset-password"      element={<ResetPassword />} />
<Route path="/messages"          element={<ProtectedRoute><Messages /></ProtectedRoute>} />
     <Route path="/saved"             element={<ProtectedRoute><Saved /></ProtectedRoute>} />
      <Route path="/settings"          element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>

      <PostCreatorModal
        isOpen={showPostModal}
        onClose={() => {
          setShowPostModal(false);
          window.history.pushState({}, "", window.location.pathname);
        }}
        currentUser={user}
        onSubmit={handlePostSubmit}
      />

      {showBanner && <CookieBanner />}

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#ffffff",
            color: "#2d1f0f",
            border: "1.5px solid #e8d5be",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: "600",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#fff" } },
          error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
    </>
  );
};

export default App;