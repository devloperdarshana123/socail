

import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Toaster } from "sonner";
import { fetchAdminMe, forceLogout } from "./lib/redux/AdminauthSlice";

// ── Layouts ──
import AdminLayout from "./layouts/AdminLayout";

// ── Pages ──
import Login from "./pages/Login";
import About from "./pages/About";
import Help from "./pages/Help";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Legal from "./pages/Legal";
import Location from "./pages/Location";
import Contact from "./pages/Contact";
import UsersPage from "./pages/UsersPage";

// ── baad mein uncomment karo jab ban jayein ──
// import Dashboard from "./pages/Dashboard";
// import PostsPage from "./pages/PostsPage";
// import ReportsPage from "./pages/ReportsPage";
// import SettingsPage from "./pages/SettingsPage";
// import UserDetailPage from "./pages/UserDetailPage";

// ─────────────────────────────────────────────
//  Protected Route — sirf super_admin access
// ─────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, fetchMe } = useSelector((s) => s.adminAuth);
  if (!fetchMe.initialized) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// ─────────────────────────────────────────────
//  Public Route — logged in ho toh dashboard pe
// ─────────────────────────────────────────────
const PublicRoute = ({ children }) => {
  const { isAuthenticated, fetchMe } = useSelector((s) => s.adminAuth);
  if (!fetchMe.initialized) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

// ─────────────────────────────────────────────
//  App
// ─────────────────────────────────────────────
const App = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchAdminMe());
  }, [dispatch]);

  useEffect(() => {
    const handleForceLogout = () => {
      dispatch(forceLogout());
      navigate("/", { replace: true });
    };
    window.addEventListener("admin:logout", handleForceLogout);
    return () => window.removeEventListener("admin:logout", handleForceLogout);
  }, [dispatch, navigate]);

  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      if (e.detail?.token) localStorage.setItem("adminAccessToken", e.detail.token);
    };
    window.addEventListener("admin:tokenRefreshed", handleTokenRefreshed);
    return () => window.removeEventListener("admin:tokenRefreshed", handleTokenRefreshed);
  }, []);

  return (
    <>
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/about"     element={<About />} />
        <Route path="/help"      element={<Help />} />
        <Route path="/privacy"   element={<Privacy />} />
        <Route path="/terms"     element={<Terms />} />
        <Route path="/legal"     element={<Legal />} />
        <Route path="/locations" element={<Location />} />
        <Route path="/contact"   element={<Contact />} />

        {/* ── Protected Routes — AdminLayout ke andar ── */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                    </svg>
                  </div>
                  <p className="text-white/60 text-sm font-medium">Dashboard — Coming Soon</p>
                </div>
              </div>
            }
          />

          <Route path="/users" element={<UsersPage />} />

          <Route
            path="/users/:id"
            element={
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
                <p className="text-white/40 text-sm">User Detail — Coming Soon</p>
              </div>
            }
          />

          <Route
            path="/posts"
            element={
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
                <p className="text-white/40 text-sm">Posts — Coming Soon</p>
              </div>
            }
          />

          <Route
            path="/reports"
            element={
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
                <p className="text-white/40 text-sm">Reports — Coming Soon</p>
              </div>
            }
          />

          <Route
            path="/settings"
            element={
              <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
                <p className="text-white/40 text-sm">Settings — Coming Soon</p>
              </div>
            }
          />
        </Route>

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          duration: 3500,
          style: { borderRadius: "12px", fontSize: "13px", fontWeight: "600" },
        }}
      />
    </>
  );
};

export default App;