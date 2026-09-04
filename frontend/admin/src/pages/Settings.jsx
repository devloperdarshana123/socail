

// src/pages/Settings.jsx
import { useEffect, useState, useRef, useCallback, useMemo, memo } from "react";
import { useDispatch, useSelector }                                 from "react-redux";
import {
  User, Lock, Bell, Shield, Monitor, LogOut, Camera,
  Eye, EyeOff, CheckCircle, AlertTriangle, Loader2,
  Trash2, Save, RefreshCw,
} from "lucide-react";

import {
  fetchAdminProfile,
  updateAdminProfile,
  uploadAdminAvatar,
  changeAdminPassword,
  updateNotifications,
  fetchAdminSessions,
  revokeSession,
  revokeAllOtherSessions,
  clearPasswordSuccess,
  clearErrors,
  setNotificationsOptimistic,
  selectAdminProfile,
  selectAdminPassword,
  selectAdminNotifications,
  selectAdminSessions,
} from "../lib/redux/adminSettingsSlice";
import { fetchAdminMe } from "../lib/redux/AdminauthSlice";

// ─────────────────────────────────────────────────────────────────────────────
//  Module-level constants
// ─────────────────────────────────────────────────────────────────────────────

// FIX: NAV was defined inside the module already — kept here (correct placement).
const NAV = [
  { id: "profile",       label: "Profile",       icon: User   },
  { id: "password",      label: "Password",      icon: Lock   },
  { id: "notifications", label: "Notifications", icon: Bell   },
  { id: "sessions",      label: "Sessions",      icon: Shield },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const relTime = (iso) => {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Module-level pure validators — close over nothing from component scope,
// so there's no reason to pay useCallback cost each render.
function validateProfileForm(form) {
  const errs = {};
  if (!form.fullName.trim())
    errs.fullName = "Full name is required.";
  else if (form.fullName.trim().length < 2)
    errs.fullName = "Must be at least 2 characters.";
  if (form.username && !/^[a-z0-9._]+$/.test(form.username))
    errs.username = "Only lowercase letters, numbers, dots, underscores.";
  if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
    errs.email = "Enter a valid email.";
  if (form.bio.length > 150)
    errs.bio = "Max 150 characters.";
  return errs;
}

function validatePwdForm(pwd) {
  const errs = {};
  if (!pwd.currentPassword)            errs.currentPassword = "Required.";
  if (!pwd.newPassword)                errs.newPassword = "Required.";
  else if (pwd.newPassword.length < 8) errs.newPassword = "Minimum 8 characters.";
  if (pwd.newPassword !== pwd.confirmPassword)
    errs.confirmPassword = "Passwords do not match.";
  return errs;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Toast
// ─────────────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState([]);
  // FIX: setTimeout not cleared on unmount → memory leak.
  // Store timer IDs and clear them on each removal and on unmount.
  const timers = useRef(new Map());

  // Cleanup all timers on unmount
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const add = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    const t = setTimeout(() => {
      setToasts((p) => p.filter((toast) => toast.id !== id));
      timers.current.delete(id);
    }, 3500);
    timers.current.set(id, t);
  }, []);

  return {
    toasts,
    success: useCallback((m) => add(m, "success"), [add]),
    error:   useCallback((m) => add(m, "error"),   [add]),
  };
}

// FIX: Wrapped with memo() — toasts array identity only changes when a toast
// is added or removed, so this correctly skips re-renders otherwise.
const Toast = memo(function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-[50] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
            ${t.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"}`}
        >
          {t.type === "success"
            ? <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            : <AlertTriangle size={16} className="text-red-500 shrink-0" />}
          {t.message}
        </div>
      ))}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

// FIX: Wrapped with memo() throughout — props are primitive strings/nodes,
// so these skip re-renders when unrelated parent state changes.
const Section = memo(function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#e8eef5] flex items-center justify-center shrink-0">
          <Icon size={18} className="text-[#1e3a5f]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
});

const Field = memo(function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
});

const Input = memo(function Input({
  type = "text", value, onChange, placeholder, disabled, rightEl, className = "",
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2.5 rounded-xl border text-sm text-slate-800 placeholder-slate-300
          bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20
          focus:border-[#1e3a5f] border-slate-200 transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${rightEl ? "pr-11" : ""} ${className}`}
      />
      {rightEl && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>
      )}
    </div>
  );
});

function PasswordInput({ label, value, onChange, placeholder, error, disabled }) {
  const [show, setShow] = useState(false);
  const toggle = useCallback(() => setShow((p) => !p), []);
  return (
    <Field label={label} error={error}>
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rightEl={
          <button type="button" onClick={toggle}
            className="text-slate-400 hover:text-slate-600 transition-colors">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
    </Field>
  );
}

// FIX: type="button" added — was missing, could submit ancestor forms.
const Toggle = memo(function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 disabled:opacity-50
        ${checked ? "bg-[#1e3a5f]" : "bg-slate-200"}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow
        transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Avatar Upload
// ─────────────────────────────────────────────────────────────────────────────

const AvatarUpload = memo(function AvatarUpload({ avatar, fullName, onUpload, uploading }) {
  const ref = useRef();

  // FIX: Was `.split(" ").map((w) => w[0])` — w[0] on an empty string (from a
  // double-space in name) returns undefined, rendering the string "undefined".
  // Added .filter(Boolean) to drop empty words before mapping.
  const initials = (fullName || "A")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleClick = useCallback(() => ref.current?.click(), []);

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        {/* FIX: CSS typo "overflow-hiddenbg-[#c5d3e0]" — missing space between
            utility classes meant neither applied. Split into two separate classes. */}
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#c5d3e0] border-2 border-indigo-100">
          {avatar?.url ? (
            <img src={avatar.url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl font-bold text-[#1e3a5f]">{initials}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#1e3a5f]
            hover:bg-[#162d4a] border-2 border-white flex items-center justify-center
            transition-all disabled:opacity-60"
        >
          {uploading
            ? <Loader2 size={12} className="text-white animate-spin" />
            : <Camera size={12} className="text-white" />}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">Profile Photo</p>
        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG or WebP — max 5 MB</p>
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="mt-2 text-xs font-semibold text-[#1e3a5f] hover:text-[#162d4a] disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Change photo"}
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Session Card
// ─────────────────────────────────────────────────────────────────────────────

// FIX: Wrapped with memo(). onRevoke is now a stable useCallback from the parent.
const SessionCard = memo(function SessionCard({ session, onRevoke, revoking }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all
      ${session.isCurrent
        ? "border-indigo-200 bg-[#e8eef5]"
        : "border-slate-100 bg-slate-50 hover:bg-slate-100"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
        ${session.isCurrent ? "bg-[#c5d3e0]" : "bg-slate-200"}`}>
        <Monitor size={16} className={session.isCurrent ? "text-[#1e3a5f]" : "text-slate-500"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {session.deviceInfo || "Unknown device"}
          </p>
          {session.isCurrent && (
            <span className="px-2 py-0.5 rounded-full bg-[#1e3a5f] text-white text-[10px] font-bold shrink-0">
              Current
            </span>
          )}
          {session.isTrusted && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold shrink-0">
              Trusted
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {session.ipAddress} · Last active {relTime(session.lastUsedAt)}
        </p>
        <p className="text-xs text-slate-400">Created {fmtDate(session.createdAt)}</p>
      </div>
      {!session.isCurrent && (
        <button
          type="button"
          onClick={() => onRevoke(session.id)}
          disabled={revoking === session.id}
          className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-500
            hover:bg-red-50 transition-all disabled:opacity-50"
        >
          {revoking === session.id
            ? <Loader2 size={15} className="animate-spin" />
            : <Trash2 size={15} />}
        </button>
      )}
    </div>
  );
});


const SideNav = memo(function SideNav({ active, onChange }) {
  return (
    <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 flex flex-col gap-1 h-full">
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          type="button"   // FIX: missing type="button" throughout SideNav
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold
            transition-all text-left
            ${active === id
              ? "bg-[#1e3a5f] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
        >
          <Icon size={16} className={active === id ? "text-white" : "text-slate-400"} />
          {label}
        </button>
      ))}
    </nav>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const dispatch = useDispatch();
  const toast    = useToast();

  const [tab, setTab] = useState("profile");

  // ── Redux state ─────────────────────────────────────────────────────────────
  const profileState = useSelector(selectAdminProfile);
  const pwdState     = useSelector(selectAdminPassword);
  const notifState   = useSelector(selectAdminNotifications);
  const sessState    = useSelector(selectAdminSessions);

  // ── Local form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    fullName: "", username: "", email: "", designation: "", bio: "",
  });
  const [formErrors, setFormErrors] = useState({});

  const [pwd, setPwd]           = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdErrors, setPwdErrors] = useState({});

  // Stable tab-change handler passed to SideNav
  const handleTabChange = useCallback((id) => setTab(id), []);

  // ── Boot: fetch profile ─────────────────────────────────────────────────────
  // FIX: toast.error was used inside the effect but not in deps → stale closure.
  useEffect(() => {
    dispatch(fetchAdminProfile())
      .unwrap()
      .catch(() => toast.error("Failed to load profile."));
  }, [dispatch, toast.error]);

  // ── Sync form when profile loads ────────────────────────────────────────────
  useEffect(() => {
    if (profileState.data) {
      const d = profileState.data;
      setForm({
        fullName:    d.fullName    || "",
        username:    d.username    || "",
        email:       d.email       || "",
        designation: d.designation || "",
        bio:         d.bio         || "",
      });
    }
  }, [profileState.data]);

  // ── Fetch sessions when tab opens ───────────────────────────────────────────
  // FIX: toast.error was used inside but not in deps.
  useEffect(() => {
    if (tab === "sessions") {
      dispatch(fetchAdminSessions())
        .unwrap()
        .catch(() => toast.error("Failed to load sessions."));
    }
  }, [tab, dispatch, toast.error]);

  // ── Clear errors on tab switch ──────────────────────────────────────────────
  useEffect(() => {
    dispatch(clearErrors());
    setPwdErrors({});
    setFormErrors({});
  }, [tab, dispatch]);

  // ── Password success auto-clear ─────────────────────────────────────────────
  useEffect(() => {
    if (pwdState.success) {
      setPwd({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed. Other devices logged out.");
      const t = setTimeout(() => dispatch(clearPasswordSuccess()), 3000);
      return () => clearTimeout(t);
    }
  }, [pwdState.success, dispatch, toast.success]);

  // ── Show Redux errors as toasts ─────────────────────────────────────────────
  // FIX: All four effects were missing toast.error in deps → stale closure risk.
  useEffect(() => {
    if (profileState.error) toast.error(profileState.error);
  }, [profileState.error, toast.error]);

  useEffect(() => {
    if (pwdState.error) toast.error(pwdState.error);
  }, [pwdState.error, toast.error]);

  useEffect(() => {
    if (notifState.error) toast.error(notifState.error);
  }, [notifState.error, toast.error]);

  useEffect(() => {
    if (sessState.error) toast.error(sessState.error);
  }, [sessState.error, toast.error]);

 
  const hasOtherSessions = useMemo(
    () => sessState.data.some((s) => !s.isCurrent),
    [sessState.data],
  );

 
  const handleProfileSave = useCallback(() => {
    const errs = validateProfileForm(form);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    dispatch(updateAdminProfile(form))
      .unwrap()
      .then(() => toast.success("Profile updated successfully."))
      .catch(() => {});
  }, [dispatch, form, toast.success]);

const handleAvatarUpload = useCallback((e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast.error("Only image files allowed."); return; }
  if (file.size > 5 * 1024 * 1024)    { toast.error("Image must be under 5MB."); return; }
  dispatch(uploadAdminAvatar(file))
    .unwrap()
    .then(() => {
      toast.success("Avatar updated.");
      dispatch(fetchAdminMe());
    })
    .catch(() => {});
  e.target.value = "";
}, [dispatch, toast.success, toast.error]);

  const handlePasswordSave = useCallback(() => {
    const errs = validatePwdForm(pwd);
    if (Object.keys(errs).length) { setPwdErrors(errs); return; }
    setPwdErrors({});
    dispatch(changeAdminPassword(pwd))
      .unwrap()
      .catch(() => {});
  }, [dispatch, pwd]);

  const handleNotifToggle = useCallback((val) => {
    dispatch(setNotificationsOptimistic(val));
    dispatch(updateNotifications({ notificationsEnabled: val }))
      .unwrap()
      .then(() => toast.success(`Notifications ${val ? "enabled" : "disabled"}.`))
      .catch(() => {});
  }, [dispatch, toast.success]);

  const handleRevoke = useCallback((sessionId) => {
    dispatch(revokeSession(sessionId))
      .unwrap()
      .then(() => toast.success("Session revoked."))
      .catch(() => {});
  }, [dispatch, toast.success]);

  const handleRevokeAll = useCallback(() => {
    dispatch(revokeAllOtherSessions())
      .unwrap()
      .then(() => toast.success("All other sessions logged out."))
      .catch(() => {});
  }, [dispatch, toast.success]);

  const handleRefreshSessions = useCallback(() => {
    dispatch(fetchAdminSessions())
      .unwrap()
      .catch(() => toast.error("Failed to refresh sessions."));
  }, [dispatch, toast.error]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <Toast toasts={toast.toasts} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage your admin account and preferences</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-stretch">

          {/* Sidebar */}
          <div className="w-full lg:w-52 shrink-0">
            <SideNav active={tab} onChange={handleTabChange} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ══════════════════════════════════════════════════════════════
                PROFILE TAB
            ══════════════════════════════════════════════════════════════ */}
            {tab === "profile" && (
              <Section
                title="Profile Information"
                subtitle="Update your admin account details"
                icon={User}
              >
                {profileState.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#1e3a5f]/50" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <AvatarUpload
                      avatar={profileState.data?.avatar}
                      fullName={form.fullName}
                      onUpload={handleAvatarUpload}
                      uploading={profileState.avatarUploading}
                    />

                    <div className="h-px bg-slate-100" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Full Name" error={formErrors.fullName}>
                        <Input
                          value={form.fullName}
                          onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                          placeholder="Your full name"
                        />
                      </Field>
                      <Field label="Username" error={formErrors.username}>
                        <Input
                          value={form.username}
                          onChange={(e) => setForm((p) => ({
                            ...p, username: e.target.value.toLowerCase(),
                          }))}
                          placeholder="username"
                        />
                      </Field>
                      <Field label="Email" error={formErrors.email}>
                        <Input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="admin@example.com"
                        />
                      </Field>
                      <Field label="Designation" error={formErrors.designation}>
                        <Input
                          value={form.designation}
                          onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                          placeholder="e.g. Super Admin"
                        />
                      </Field>
                    </div>

                    <Field label={`Bio (${form.bio.length}/150)`} error={formErrors.bio}>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                        placeholder="Short bio…"
                        rows={3}
                        maxLength={150}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50
                          focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20
                          focus:border-[#1e3a5f] text-sm text-slate-800 placeholder-slate-300
                          resize-none transition-all"
                      />
                    </Field>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleProfileSave}
                        disabled={profileState.saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1e3a5f]
                          hover:bg-[#162d4a] text-white text-sm font-semibold shadow-sm
                          transition-all disabled:opacity-60"
                      >
                        {profileState.saving
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Save size={15} />}
                        Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                PASSWORD TAB
            ══════════════════════════════════════════════════════════════ */}
            {tab === "password" && (
              <Section
                title="Change Password"
                subtitle="Keep your account secure with a strong password"
                icon={Lock}
              >
                <div className="space-y-4 max-w-md">
                  {pwdState.success && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50
                      border border-emerald-200">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <p className="text-sm text-emerald-700 font-medium">
                        Password changed successfully.
                      </p>
                    </div>
                  )}

                  <PasswordInput
                    label="Current Password"
                    value={pwd.currentPassword}
                    onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    error={pwdErrors.currentPassword}
                    disabled={pwdState.saving}
                  />
                  <PasswordInput
                    label="New Password"
                    value={pwd.newPassword}
                    onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Min 8 characters"
                    error={pwdErrors.newPassword}
                    disabled={pwdState.saving}
                  />
                  <PasswordInput
                    label="Confirm New Password"
                    value={pwd.confirmPassword}
                    onChange={(e) => setPwd((p) => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repeat new password"
                    error={pwdErrors.confirmPassword}
                    disabled={pwdState.saving}
                  />

                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Changing your password logs out all other active sessions immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePasswordSave}
                    disabled={pwdState.saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1e3a5f]
                      hover:bg-[#162d4a] text-white text-sm font-semibold shadow-sm
                      transition-all disabled:opacity-60"
                  >
                    {pwdState.saving
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Lock size={15} />}
                    Update Password
                  </button>
                </div>
              </Section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                NOTIFICATIONS TAB
            ══════════════════════════════════════════════════════════════ */}
            {tab === "notifications" && (
              <Section
                title="Notification Preferences"
                subtitle="Control how you receive alerts"
                icon={Bell}
              >
                <div className="divide-y divide-slate-100">
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">In-app Notifications</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Receive alerts inside the admin panel
                      </p>
                    </div>
                    <Toggle
                      checked={notifState.enabled}
                      onChange={handleNotifToggle}
                      disabled={notifState.saving}
                    />
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Email Notifications</p>
                      <p className="text-xs text-slate-300 mt-0.5">Coming soon</p>
                    </div>
                    <Toggle checked={false} onChange={() => {}} disabled />
                  </div>
                </div>
              </Section>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SESSIONS TAB
            ══════════════════════════════════════════════════════════════ */}
            {tab === "sessions" && (
              <Section
                title="Active Sessions"
                subtitle="Devices currently logged into your admin account"
                icon={Shield}
              >
                {sessState.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-[#1e3a5f]/50" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {sessState.data.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-8">
                          No active sessions found.
                        </p>
                      )}
                      {sessState.data.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          onRevoke={handleRevoke}
                          revoking={sessState.revoking}
                        />
                      ))}
                    </div>

                    {/* FIX: Was sessState.data.filter(...).length > 0 inline in JSX.
                        Replaced with hasOtherSessions derived via useMemo above. */}
                    {hasOtherSessions && (
                      <>
                        <div className="h-px bg-slate-100" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">
                              Log out all other sessions
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              All devices except this one will be signed out
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleRevokeAll}
                            disabled={sessState.revokingAll}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border
                              border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold
                              transition-all disabled:opacity-60"
                          >
                            {sessState.revokingAll
                              ? <Loader2 size={14} className="animate-spin" />
                              : <LogOut size={14} />}
                            Revoke All
                          </button>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={handleRefreshSessions}
                      disabled={sessState.loading}
                      className="flex items-center gap-1.5 text-xs text-slate-400
                        hover:text-[#1e3a5f] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={12} /> Refresh sessions
                    </button>
                  </div>
                )}
              </Section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}