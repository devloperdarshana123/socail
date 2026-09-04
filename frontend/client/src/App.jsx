
import React, { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster, toast } from "react-hot-toast";

import Navbar from "./components/Navbar";
import CookieBanner from "./components/CookieBanner";
import PostCreatorModal from "./components/PostCreatorModal";

// ✅ Lazy loaded pages — har page apna alag chunk banega, route hit hone par load hoga
const Login          = lazy(() => import("./pages/Login"));
const Register       = lazy(() => import("./pages/Register"));
const VerifyOTP       = lazy(() => import("./pages/VerifyOTP"));
const SetUsername     = lazy(() => import("./pages/SetUsername"));
const PrivacyPage     = lazy(() => import("./pages/PrivacyPage"));
const Terms           = lazy(() => import("./pages/Terms"));
const Legal           = lazy(() => import("./pages/LegalPage"));
const About           = lazy(() => import("./pages/About"));
const Help            = lazy(() => import("./pages/Help"));
const Locations       = lazy(() => import("./pages/Locations"));
const Contact         = lazy(() => import("./pages/Contact"));
const FeedPage        = lazy(() => import("./pages/FeedPage"));
const Profile         = lazy(() => import("./pages/Profile"));
const Settings        = lazy(() => import("./pages/Settings"));
const Explore         = lazy(() => import("./pages/Explore"));
const Saved           = lazy(() => import("./pages/Saved"));
const ForgotPassword  = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword   = lazy(() => import("./pages/ResetPassword"));
const Messages        = lazy(() => import("./pages/Messages"));
const PublicProfile   = lazy(() => import("./pages/PublicProfile"));

import { fetchMe, resetAuth } from "./lib/redux/authSlice";
import { resetProfile } from "./lib/redux/userprofileslice";
import { createPost, fetchMyPosts } from "./lib/redux/postSlice";
import { fetchNotifications } from "./lib/redux/notificationSlice";
// existing imports ke saath
import { setTokenExpiry } from "./lib/services/api";
// ✅ Socket hooks — sirf ek baar App level pe mount karo
import useSocketInit from "./lib/hooks/useSocketInit";

const ProtectedRoute = ({ children }) => {
  const { user, fetchMe: { loading } } = useSelector((s) => s.auth);

  if (loading && !user) return null;
  if (!user) return <Navigate to="/" replace />;

  // Onboarding incomplete — redirect karo sahi step pe
  if (!user.isOnboardingComplete) {
    if (user.onboardingStep === 1) return <Navigate to="/verify-otp" replace />;
    if (user.onboardingStep === 2) return <Navigate to="/onboarding/username" replace />;
  }

  // Account active nahi — login pe bhejo
  if (user.accountStatus === "banned" || user.accountStatus === "suspended" || user.accountStatus === "deactivated") {
    return <Navigate to="/" replace />;
  }

  return children;
};

const HIDE_NAVBAR_ON = ["/", "/register", "/verify-otp", "/onboarding/username", "/forgot-password", "/reset-password", "/terms", "/privacy", "/legal", "/about", "/help", "/locations", "/contact"];
const HIDE_BANNER_ON = ["/privacy", "/terms", "/legal", "/help", "/about", "/locations", "/contact"];

// ✅ Suspense fallback — route chunk load hone tak yeh dikhega
const RouteLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="w-8 h-8 border-3 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
  </div>
);

const App = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const dispatch  = useDispatch();

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
    dispatch(fetchMe()).then((result) => {
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

  useEffect(() => {
    if (user?._id) {
      dispatch(fetchNotifications({ page: 1 }));
    }
  }, [user?._id, dispatch]);

  const handlePostSubmit = async (postData) => {
    const result = await dispatch(createPost(postData));
    if (createPost.fulfilled.match(result)) {
      setShowPostModal(false);
      toast.success(postData.isDraft ? "Draft saved! 📝" : "Post shared! 🎉");
      if (!postData.isDraft && user?._id) {
        dispatch(fetchMyPosts(user._id));
      }
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

      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/"                    element={<Login />} />
          <Route path="/register"            element={<Register />} />
          <Route path="/verify-otp"          element={<VerifyOTP />} />
          <Route path="/onboarding/username" element={<SetUsername />} />
          <Route path="/feed"                element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="/privacy"             element={<PrivacyPage />} />
          <Route path="/terms"               element={<Terms />} />
          <Route path="/legal"               element={<Legal />} />
          <Route path="/about"               element={<About />} />
          <Route path="/help"                element={<Help />} />
          <Route path="/locations"           element={<Locations />} />
          <Route path="/contact"             element={<Contact />} />
          <Route path="/profile"             element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/:username"   element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
          <Route path="/explore"             element={<ProtectedRoute><Explore /></ProtectedRoute>} />
          <Route path="/forgot-password"     element={<ForgotPassword />} />
          <Route path="/reset-password"      element={<ResetPassword />} />
          <Route path="/messages"            element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/saved"               element={<ProtectedRoute><Saved /></ProtectedRoute>} />
          <Route path="/settings"            element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

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