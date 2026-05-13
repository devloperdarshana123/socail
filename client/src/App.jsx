
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation , useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster ,  toast } from "react-hot-toast";
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
import PublicProfile from "./pages/PublicProfile";
import { fetchMe , resetAuth } from "./lib/redux/authSlice";
import { resetProfile } from "./lib/redux/userprofileslice";
import { createPost } from "./lib/redux/postSlice";

const HIDE_NAVBAR_ON = ["/", "/register", "/verify-otp", "/onboarding/username"];
const HIDE_BANNER_ON = ["/privacy", "/terms", "/legal", "/help", "/about", "/locations", "/contact"];

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user     = useSelector((state) => state.auth.user);
  const creating = useSelector((state) => state.posts.creating);

  const showBanner = !HIDE_BANNER_ON.includes(location.pathname);
  const showNavbar = !HIDE_NAVBAR_ON.includes(location.pathname);

  const [showPostModal, setShowPostModal] = useState(false);

  // App load pe user fetch
  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);


  useEffect(() => {
  const handleForceLogout = () => {
    dispatch(resetAuth());
    dispatch(resetProfile());
    navigate("/"); 
  };
  window.addEventListener("auth:logout", handleForceLogout);
  return () => window.removeEventListener("auth:logout", handleForceLogout);
}, [dispatch , navigate]);
  // Post submit handler
  const handlePostSubmit = async (formData) => {
    const result = await dispatch(createPost(formData));

    if (createPost.fulfilled.match(result)) {
      setShowPostModal(false);
     toast.success("Post shared! 🎉");
    } else {
      // PostCreatorModal error apne andar dikhayega
      throw new Error(result.payload);
    }
  };

  return (
    <>
      {showNavbar && (
        <Navbar onCreatePost={() => setShowPostModal(true)} />
      )}

      <Routes>
        <Route path="/"                    element={<Login />} />
        <Route path="/register"            element={<Register />} />
        <Route path="/verify-otp"          element={<VerifyOTP />} />
        <Route path="/onboarding/username" element={<SetUsername />} />
        <Route path="/feed"                element={<FeedPage />} />
        <Route path="/privacy"             element={<PrivacyPage />} />
        <Route path="/terms"               element={<Terms />} />
        <Route path="/legal"               element={<Legal />} />
        <Route path="/about"               element={<About />} />
        <Route path="/help"                element={<Help />} />
        <Route path="/locations"           element={<Locations />} />
        <Route path="/contact"             element={<Contact />} />
        <Route path="/profile"             element={<Profile />} />
        <Route path="/profile/:username"   element={<PublicProfile />} />
        <Route path="/explore"             element={<Explore />} />
        
        <Route path="/saved"             element={<Saved/>} />
        <Route path="/settings"            element={<Settings />} />
        <Route path="*"                    element={<Navigate to="/" replace />} />
      </Routes>

      <PostCreatorModal
        isOpen={showPostModal}
        onClose={() => setShowPostModal(false)}
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
    success: {
      iconTheme: { primary: "#22c55e", secondary: "#fff" },
    },
    error: {
      iconTheme: { primary: "#ef4444", secondary: "#fff" },
    },
  }}
/>
    </>
  );
};

export default App;