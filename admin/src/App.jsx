

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Toaster } from "sonner";
import { fetchAdminMe, forceLogout } from "./lib/redux/AdminauthSlice";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

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
import CommentsPage from "./pages/Commentspage";


import DashboardPage from "./pages/DashboardPage";
import PostsPage from "./pages/PostsPage";
import ReportsPage from "./pages/Reportspage";
import SettingsPage from "./pages/Settings";
import UserDetailPage from "./pages/UserDetailPage";
import AuditLog from "./pages/AuditLog";

// ─────────────────────────────────────────────
//  Protected Route — sirf super_admin access
// ─────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, fetchMe } = useSelector((s) => s.adminAuth);
  const location = useLocation();
  if (!fetchMe.initialized) return <AppLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
};
// ─────────────────────────────────────────────
//  Public Route — logged in ho toh dashboard pe
// ─────────────────────────────────────────────
const PublicRoute = ({ children }) => {
  const { isAuthenticated, fetchMe } = useSelector((s) => s.adminAuth);
  const location = useLocation();
  if (!fetchMe.initialized) return <AppLoader />;
  if (isAuthenticated) {
    const dest = location.state?.from || "/dashboard";
    return <Navigate to={dest} replace />;
  }
  return children;
};
function AppLoader() {
  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-4 z-50">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-violet-300/60 animate-spin"
          style={{ animationDuration: "0.6s", animationDirection: "reverse" }} />
      </div>
      <p className="text-xs font-semibold text-slate-500 tracking-widest uppercase">Loading</p>
    </div>
  );
}

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
              <DashboardPage/>
            }
          />

          <Route path="/users" element={<UsersPage />} />

         <Route path="/users/:id" element={<UserDetailPage />} />

          <Route path="/posts" element={<PostsPage />} />

          <Route
            path="/reports"
            element={<ReportsPage/> }
          />
           <Route
            path="/settings"
            element={<SettingsPage/>}
          />
           <Route
            path="/comments"
            element={<CommentsPage/>}
          />

          <Route
            path="/audit-logs"
            element={<AuditLog/>}
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