

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { fetchTotalUnread } from "./store/slices/Messageslice";
import { Toaster } from 'sonner';
import Navbar from "./components/Navbar";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Explore from "./pages/Explore";
import SavedPosts from "./pages/Savedposts";
import FollowRequests from "./pages/FollowRequests";
import Messages from "./pages/Messages";
import Marketplace from "./pages/Marketplace";
import UserProfile from "./pages/Userprofile";
import FloatingChatbot from "./components/FloatingChatbot";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

const AuthRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) return <Navigate to="/" />;
  return children;
};

export default function App() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    if (!user?._id) return;
    dispatch(fetchTotalUnread());
    const interval = setInterval(() => dispatch(fetchTotalUnread()), 30000);
    return () => clearInterval(interval);
  }, [user?._id, dispatch]);

  return (
    <>
      <Toaster position="bottom-right" richColors />

      {user ? (
        <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
          <Navbar onCreatePost={() => setShowCreatePost(true)} />
          <div className="flex-1 overflow-hidden flex px-4 py-6 items-start">
            <div className="flex-1 min-w-0 h-full overflow-y-auto">
              <Routes>
                <Route path="/" element={<ProtectedRoute><Marketplace showCreatePost={showCreatePost} setShowCreatePost={setShowCreatePost} /></ProtectedRoute>} />
                <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/settings"        element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/explore"         element={<ProtectedRoute><Explore /></ProtectedRoute>} />
                <Route path="/saved"           element={<ProtectedRoute><SavedPosts /></ProtectedRoute>} />
                <Route path="/follow-requests" element={<ProtectedRoute><FollowRequests /></ProtectedRoute>} />
                <Route path="/messages"        element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/messages/:userId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/user/:userId"    element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/marketplace"     element={<Navigate to="/" replace />} />
                <Route path="*"               element={<Navigate to="/" />} />
              </Routes>
            </div>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login"    element={<AuthRoute><Login /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
          <Route path="*"         element={<Navigate to="/login" />} />
        </Routes>
      )}

      {user && <FloatingChatbot />}
    </>
  );
}