

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Country, State } from "country-state-city";
import { useDispatch, useSelector } from "react-redux";
import {
  updateProfile,
  changePassword,
  setPassword,
  deactivateAccount,
  uploadAvatar,
  removeAvatar,
} from "../store/slices/settingsSlice";
import { updateUser as updateUserAction } from "../store/slices/authSlice";
import toast from "react-hot-toast";
import {
  User, Lock, AlertTriangle,
  Eye, EyeOff, Check, Camera, LogOut, X,
} from "lucide-react";

const NAVY = "#1e3a5f";
const NAVY_DARK = "#162d4a";
const NAVY_LIGHT = "#e8eef5";
const NAVY_MID = "#4f7cac";

export default function Settings() {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const { savingProfile, savingPassword, settingPassword, avatarUploading, deactivating } =
    useSelector((state) => state.settings);

  const isGoogleUser = !!user?.googleId;
const [activeTab, setActiveTab] = useState(
  () => localStorage.getItem("settings_tab") || "profile"
);
  const [designation, setDesignation] = useState(user?.designation || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [country, setCountry] = useState(user?.location?.country || "");
  const [state, setState] = useState(user?.location?.state || "");
  const [businessCategory, setBusinessCategory] = useState(user?.businessCategory || "other");

  // Change password (normal users)
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Set password (Google users)
  const [setNewPwd, setSetNewPwd] = useState("");
  const [setConfirmPwd, setSetConfirmPwd] = useState("");
  const [showSetNew, setShowSetNew] = useState(false);
  const [showSetConfirm, setShowSetConfirm] = useState(false);
  const [passwordSetDone, setPasswordSetDone] = useState(false);

  const [deactivateConfirm, setDeactivateConfirm] = useState("");

  const handleTabChange = (tab) => {
  setActiveTab(tab);
  localStorage.setItem("settings_tab", tab);
};

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { toast.error("Name and email are mandatory!"); return; }
    const result = await dispatch(updateProfile({ name, email, designation, bio, country, state, businessCategory }));
    if (updateProfile.fulfilled.match(result)) {
      dispatch(updateUserAction({ name, email, designation, bio, businessCategory, location: { ...user?.location, country, state } }));
      toast.success("Profile updated!");
    } else {
      toast.error(result.payload || "Update failed!");
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const result = await dispatch(uploadAvatar(file));
    if (uploadAvatar.fulfilled.match(result)) {
      dispatch(updateUserAction({ avatar: result.payload }));
      toast.success("Avatar updated!");
    } else {
      toast.error(result.payload || "Upload failed!");
    }
  };

  const handleAvatarRemove = async () => {
    const result = await dispatch(removeAvatar());
    if (removeAvatar.fulfilled.match(result)) {
      dispatch(updateUserAction({ avatar: "" }));
      toast.success("Avatar removed!");
    } else {
      toast.error(result.payload || "Remove failed!");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) { toast.error("Fill all fields!"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match!"); return; }
    if (newPassword.length < 6) { toast.error("Min 6 characters!"); return; }
    const result = await dispatch(changePassword({ oldPassword, newPassword }));
    if (changePassword.fulfilled.match(result)) {
      toast.success("Password changed!");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } else {
      toast.error(result.payload || "Change failed!");
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!setNewPwd || !setConfirmPwd) { toast.error("Fill all fields!"); return; }
    if (setNewPwd !== setConfirmPwd) { toast.error("Passwords do not match!"); return; }
    if (setNewPwd.length < 6) { toast.error("Min 6 characters!"); return; }
    const result = await dispatch(setPassword({ newPassword: setNewPwd, confirmPassword: setConfirmPwd }));
    if (setPassword.fulfilled.match(result)) {
      toast.success("Password set successfully!");
      setSetNewPwd(""); setSetConfirmPwd("");
      setPasswordSetDone(true);
    } else {
      toast.error(result.payload || "Set password failed!");
    }
  };

  const handleDeactivate = async () => {
    if (deactivateConfirm !== "DEACTIVATE") { toast.error("Type DEACTIVATE to confirm!"); return; }
    const result = await dispatch(deactivateAccount());
    if (deactivateAccount.fulfilled.match(result)) {
      toast.success("Account deactivated!");
      logout();
    } else {
      toast.error(result.payload || "Deactivation failed!");
    }
  };

  const passMatchOk  = confirmPassword && confirmPassword === newPassword;
  const passMatchBad = confirmPassword && confirmPassword !== newPassword;
  const setMatchOk   = setConfirmPwd && setConfirmPwd === setNewPwd;
  const setMatchBad  = setConfirmPwd && setConfirmPwd !== setNewPwd;

  const navItems = [
    { id: "profile",    label: "Personal Information", icon: <User size={15} /> },
    { id: "password",   label: "Login & Password",     icon: <Lock size={15} /> },
    { id: "deactivate", label: "Deactivate Account",   icon: <AlertTriangle size={15} /> },
  ];

  const btnNavy = {
    background: NAVY, color: "#fff", border: "none",
    borderRadius: "12px", padding: "10px 0", fontSize: "14px",
    fontWeight: 600, cursor: "pointer", width: "100%", transition: "background .15s",
  };
  const btnOutline = {
    background: "transparent", color: NAVY, border: `1.5px solid ${NAVY}`,
    borderRadius: "12px", padding: "10px 0", fontSize: "14px",
    fontWeight: 600, cursor: "pointer", width: "100%", transition: "all .15s",
  };

  const AvatarBlock = ({ size = "lg" }) => (
    <div className="relative inline-block">
      {user?.avatar ? (
        <img src={user.avatar} alt="avatar"
          className={`rounded-full object-cover border-4 border-white shadow-md ${size === "lg" ? "w-20 h-20" : "w-14 h-14"}`} />
      ) : (
        <div className={`rounded-full flex items-center justify-center text-white font-bold border-4 border-white shadow-md ${size === "lg" ? "w-20 h-20 text-3xl" : "w-14 h-14 text-2xl"}`}
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${NAVY_MID})` }}>
          {user?.name?.charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white cursor-pointer transition"
        style={{ background: NAVY }}
        onMouseEnter={(e) => (e.currentTarget.style.background = NAVY_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.background = NAVY)}>
        {avatarUploading
          ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Camera size={12} color="#fff" />}
        <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
      </label>
      {user?.avatar && (
        <button onClick={handleAvatarRemove}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center hover:bg-red-600 transition">
          <X size={9} color="#fff" />
        </button>
      )}
    </div>
  );

  const NavLinks = () => (
    <>
      <nav className="w-full flex flex-col gap-1">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          const isDanger = item.id === "deactivate";
          return (
            <button key={item.id} onClick={() => handleTabChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left"
              style={{
                background: active ? (isDanger ? "#fef2f2" : NAVY_LIGHT) : "transparent",
                color: active ? (isDanger ? "#ef4444" : NAVY) : "#6b7280",
              }}>
              <span style={{ color: active ? (isDanger ? "#f87171" : NAVY_MID) : "#9ca3af" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 mt-3 pt-3 w-full">
        <button onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition text-left">
          <LogOut size={15} className="text-red-400" /> Log Out
        </button>
      </div>
    </>
  );

  // ── PASSWORD TAB ─────────────────────────────────────────────────────────────
  const PasswordTab = () => {
    if (isGoogleUser) {
      return (
        <form onSubmit={handleSetPassword}>
          <p className="text-base font-bold mb-1" style={{ color: NAVY }}>Set Password</p>
          <p className="text-xs text-gray-400 mb-3">
            Your account is connected via Google. Set a password to also log in with email & password.
          </p>
          {/* Google badge */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-5">
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span className="text-xs text-blue-700 font-medium">Connected with Google</span>
          </div>

          {passwordSetDone ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
           <p className="text-green-700 font-semibold text-sm">✅ Password set successfully!</p>
<p className="text-xs text-green-600 mt-1">You can now log in with your email & password too.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {[
                { label: "New Password",     val: setNewPwd,     set: setSetNewPwd,     show: showSetNew,     setShow: setShowSetNew,     ph: "Min 6 characters" },
                { label: "Confirm Password", val: setConfirmPwd, set: setSetConfirmPwd, show: showSetConfirm, setShow: setShowSetConfirm, ph: "Repeat new password", isConfirm: true },
              ].map(({ label, val, set, show, setShow, ph, isConfirm }) => (
                <div key={label}>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>{label}</label>
                  <div className="relative">
                    <input
                      className="w-full px-3 py-2.5 pr-10 border rounded-xl text-sm text-gray-800 outline-none transition placeholder:text-gray-400"
                      style={{
                        borderColor: isConfirm ? (setMatchBad ? "#fca5a5" : setMatchOk ? "#86efac" : "#e5e7eb") : "#e5e7eb",
                        background:  isConfirm ? (setMatchBad ? "#fef2f2" : setMatchOk ? "#f0fdf4" : "#f9fafb") : "#f9fafb",
                      }}
                      onFocus={(e) => { if (!isConfirm || (!setMatchBad && !setMatchOk)) e.target.style.borderColor = NAVY; }}
                      onBlur={(e)  => { if (!isConfirm || (!setMatchBad && !setMatchOk)) e.target.style.borderColor = "#e5e7eb"; }}
                      type={show ? "text" : "password"} value={val}
                      onChange={(e) => set(e.target.value)} placeholder={ph}
                    />
                    <button type="button" onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {isConfirm && setMatchBad && <p className="text-xs text-red-500 mt-1">Passwords do not match!</p>}
                  {isConfirm && setMatchOk  && <p className="text-xs text-green-500 mt-1">✓ Passwords match!</p>}
                </div>
              ))}
              <button type="submit" disabled={settingPassword}
                style={{ ...btnNavy, marginTop: 8, opacity: settingPassword ? 0.6 : 1, cursor: settingPassword ? "not-allowed" : "pointer" }}
                onMouseEnter={(e) => !settingPassword && (e.currentTarget.style.background = NAVY_DARK)}
                onMouseLeave={(e) => (e.currentTarget.style.background = NAVY)}>
                🔒 {settingPassword ? "Setting..." : "Set Password"}
              </button>
            </div>
          )}
        </form>
      );
    }

    // Normal user
    return (
      <form onSubmit={handleChangePassword}>
        <p className="text-base font-bold mb-1" style={{ color: NAVY }}>Login & Password</p>
        <p className="text-xs text-gray-400 mb-5">Keep your account secure with a strong password.</p>
        <div className="flex flex-col gap-4">
          {[
            { label: "Current Password",     val: oldPassword,     set: setOldPassword,     show: showOld,     setShow: setShowOld,     ph: "Enter current password" },
            { label: "New Password",         val: newPassword,     set: setNewPassword,     show: showNew,     setShow: setShowNew,     ph: "Min 6 characters" },
            { label: "Confirm New Password", val: confirmPassword, set: setConfirmPassword, show: showConfirm, setShow: setShowConfirm, ph: "Repeat new password", isConfirm: true },
          ].map(({ label, val, set, show, setShow, ph, isConfirm }) => (
            <div key={label}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>{label}</label>
              <div className="relative">
                <input
                  className="w-full px-3 py-2.5 pr-10 border rounded-xl text-sm text-gray-800 outline-none transition placeholder:text-gray-400"
                  style={{
                    borderColor: isConfirm ? (passMatchBad ? "#fca5a5" : passMatchOk ? "#86efac" : "#e5e7eb") : "#e5e7eb",
                    background:  isConfirm ? (passMatchBad ? "#fef2f2" : passMatchOk ? "#f0fdf4" : "#f9fafb") : "#f9fafb",
                  }}
                  onFocus={(e) => { if (!isConfirm || (!passMatchBad && !passMatchOk)) e.target.style.borderColor = NAVY; }}
                  onBlur={(e)  => { if (!isConfirm || (!passMatchBad && !passMatchOk)) e.target.style.borderColor = "#e5e7eb"; }}
                  type={show ? "text" : "password"} value={val}
                  onChange={(e) => set(e.target.value)} placeholder={ph}
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {isConfirm && passMatchBad && <p className="text-xs text-red-500 mt-1">Passwords do not match!</p>}
              {isConfirm && passMatchOk  && <p className="text-xs text-green-500 mt-1">✓ Passwords match!</p>}
            </div>
          ))}
        </div>
        <button type="submit" disabled={savingPassword}
          style={{ ...btnNavy, marginTop: 24, opacity: savingPassword ? 0.6 : 1, cursor: savingPassword ? "not-allowed" : "pointer" }}
          onMouseEnter={(e) => !savingPassword && (e.currentTarget.style.background = NAVY_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.background = NAVY)}>
          🔒 {savingPassword ? "Updating..." : "Update Password"}
        </button>
      </form>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">

        {/* ── MOBILE HEADER ── */}
        <div className="flex md:hidden items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
          <AvatarBlock size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm truncate">{user?.name}</p>
            <span className="text-xs font-semibold" style={{ color: NAVY }}>
              {user?.designation?.trim() || "EroSocial Member"}
            </span>
          </div>
        </div>

        {/* ── DESKTOP LAYOUT ── */}
        <div className="flex gap-5 items-stretch max-w-full mx-auto">

          {/* LEFT SIDEBAR */}
          <div className="hidden md:flex flex-col items-center w-80 shrink-0 rounded-2xl shadow-sm border border-gray-100 p-6"
            style={{ background: "#fff" }}>
            <AvatarBlock size="lg" />
            <p className="mt-3 font-bold text-gray-800 text-sm text-center">{user?.name}</p>
            <span className="mt-1.5 mb-6 text-xs font-semibold px-3 py-1 rounded-full text-center"
              style={{ background: NAVY_LIGHT, color: NAVY }}>
              {user?.designation?.trim() || "EroSocial Member"}
            </span>
            <NavLinks />
          </div>

          {/* RIGHT CONTENT */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">

            {activeTab === "profile" && (
              <form onSubmit={handleSaveProfile}>
                <p className="text-base font-bold mb-5" style={{ color: NAVY }}>Personal Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Full Name</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition placeholder:text-gray-400"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Email Address</label>
                    <div className="relative">
                      <input className="w-full px-3 py-2.5 pr-20 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition placeholder:text-gray-400"
                        onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" />
                      {email && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-semibold flex items-center gap-1">
                          <Check size={11} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Designation / Specialty</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition placeholder:text-gray-400"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      type="text" value={designation} onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Interior Designer, Tile Supplier" maxLength={60} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Bio</label>
                    <textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition placeholder:text-gray-400 resize-none"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us about yourself..." maxLength={200} />
                    <p className="text-xs text-gray-400 mt-1">{bio.length}/200</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Country</label>
                    <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      value={country} onChange={(e) => { setCountry(e.target.value); setState(""); }}>
                      <option value="">Select Country</option>
                      {Country.getAllCountries().map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>State / City</label>
                    <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      value={state} onChange={(e) => setState(e.target.value)} disabled={!country}>
                      <option value="">Select State</option>
                      {State.getStatesOfCountry(country).map((s) => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: NAVY_MID }}>Business Category</label>
                    <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-gray-50 outline-none transition"
                      onFocus={(e) => (e.target.style.borderColor = NAVY)} onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
                      value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)}>
                      {["marble","granite","limestone","cnc","quarry","supplier","designer","other"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-6">
                  <button type="button" style={btnOutline}
                    onClick={() => { setName(user?.name || ""); setEmail(user?.email || ""); setDesignation(user?.designation || ""); setBio(user?.bio || ""); }}>
                    Discard Changes
                  </button>
                  <button type="submit" disabled={savingProfile}
                    style={{ ...btnNavy, opacity: savingProfile ? 0.6 : 1, cursor: savingProfile ? "not-allowed" : "pointer" }}
                    onMouseEnter={(e) => !savingProfile && (e.currentTarget.style.background = NAVY_DARK)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = NAVY)}>
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "password" && <PasswordTab />}

            {activeTab === "deactivate" && (
              <div>
                <p className="text-base font-bold text-gray-800 mb-1">Deactivate Account</p>
                <p className="text-xs text-gray-400 mb-5">This action is irreversible. Please read carefully.</p>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                  <p className="text-sm font-bold text-red-700 mb-2">⚠️ Read carefully!</p>
                  {["Your account will be permanently deactivated","All your posts and data will be deleted","You will not be able to log in again","This action cannot be undone"].map((t) => (
                    <p key={t} className="text-xs text-red-600 mt-1.5">• {t}</p>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 font-medium mb-1.5">
                    Type <span className="text-red-500 font-bold">DEACTIVATE</span> to confirm
                  </label>
                  <input className="w-full px-3 py-2.5 border border-red-200 rounded-xl text-sm text-gray-800 bg-red-50 outline-none focus:border-red-400 transition placeholder:text-gray-400"
                    type="text" value={deactivateConfirm} onChange={(e) => setDeactivateConfirm(e.target.value)} placeholder="DEACTIVATE" />
                </div>
                <button onClick={handleDeactivate} disabled={deactivating || deactivateConfirm !== "DEACTIVATE"}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {deactivating ? "Deactivating..." : "⚠️ Deactivate My Account"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      <div className="flex md:hidden border-t border-gray-100 bg-white">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          const isDanger = item.id === "deactivate";
          return (
            <button key={item.id} onClick={() => handleTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold transition"
              style={{ color: active ? (isDanger ? "#ef4444" : NAVY) : "#9ca3af" }}>
              <span style={{ color: active ? (isDanger ? "#ef4444" : NAVY_MID) : "#9ca3af" }}>{item.icon}</span>
              {item.id === "profile" ? "Profile" : item.id === "password" ? "Password" : "Deactivate"}
            </button>
          );
        })}
        <button onClick={() => logout()}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold text-red-400 transition hover:text-red-500">
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}