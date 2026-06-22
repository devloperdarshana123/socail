
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import toast from "react-hot-toast";
import Select from "react-select";
import { Country, State, City } from "country-state-city";
import {
  User, Lock, AlertTriangle, Eye, EyeOff,
  Camera, LogOut, X, ChevronRight, Pencil,
} from "lucide-react";
import {
  updateProfile,
  updatePassword,
  deactivateAccount,
  clearProfileState,
  clearPasswordState,
  clearDeactivateState,
} from "../lib/redux/settingSlice";
import {
  uploadAvatar,
  removeAvatar,
} from "../lib/redux/userprofileslice";
import { logoutUser } from "../lib/redux/authSlice";

// ── Theme ──────────────────────────────────────────────────────
const T = {
  bg:       "#faf6f0",
  card:     "#ffffff",
  border:   "#e8d5be",
  brown:    "#5a3e2b",
  brownMid: "#8b6343",
  brownLt:  "#f5ece0",
  brownXlt: "#fdf9f5",
  accent:   "#c09a6e",
  text:     "#2d1f0f",
  textMid:  "#6b4c35",
  textLt:   "#a08060",
  red:      "#ef4444",
  redLt:    "#fef2f2",
  green:    "#22c55e",
};

const NAV_ITEMS = [
  { id: "profile",    label: "Personal Information", icon: User },
  { id: "password",   label: "Login & Password",     icon: Lock },
  { id: "deactivate", label: "Deactivate Account",   icon: AlertTriangle },
];

// ── Input ──────────────────────────────────────────────────────
function Field({ label, type = "text", placeholder, value, onChange, suffix, hint, disabled }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${suffix ? "pr-24" : ""}`}
          style={{ border: `1.5px solid ${T.border}`, background: T.brownXlt, color: T.text }}
          onFocus={(e) => { if (!disabled) e.target.style.borderColor = T.accent; }}
          onBlur={(e)  => (e.target.style.borderColor = T.border)}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: T.green }}>{suffix}</span>
        )}
      </div>
      {hint && <p className="text-xs mt-1" style={{ color: T.textLt }}>{hint}</p>}
    </div>
  );
}

// ── Password Field ─────────────────────────────────────────────
function PwdField({ label, placeholder, value, onChange, show, onToggle, matchOk, matchBad }) {
  const borderColor = matchBad ? "#fca5a5" : matchOk ? "#86efac" : T.border;
  const bg          = matchBad ? "#fef2f2" : matchOk ? "#f0fdf4" : T.brownXlt;
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none transition-all duration-200"
          style={{ border: `1.5px solid ${borderColor}`, background: bg, color: T.text }}
          onFocus={(e) => { if (!matchOk && !matchBad) e.target.style.borderColor = T.accent; }}
          onBlur={(e)  => { if (!matchOk && !matchBad) e.target.style.borderColor = T.border; }}
        />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: T.textLt }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {matchBad && <p className="text-xs mt-1 text-red-500">Passwords do not match!</p>}
      {matchOk  && <p className="text-xs mt-1 text-green-500">✓ Passwords match!</p>}
    </div>
  );
}

// ── Avatar Block ───────────────────────────────────────────────
function AvatarBlock({ user, size = "lg" }) {
  const dispatch = useDispatch();
  const { avatarLoading } = useSelector((s) => s.userProfile);
  const sz = size === "lg" ? "w-20 h-20 text-3xl" : "w-14 h-14 text-2xl";

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    dispatch(uploadAvatar(file));
  };

  const handleRemoveAvatar = () => {
    dispatch(removeAvatar());
  };

  return (
    <div className="relative inline-block">
      {avatarLoading && (
        <div className={`absolute inset-0 rounded-full flex items-center justify-center z-10 bg-black/40`}>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {user?.avatar?.url ? (
        <img src={user.avatar.url} alt="avatar"
          className={`rounded-full object-cover border-4 shadow-md ${sz}`}
          style={{ borderColor: T.card }} />
      ) : (
        <div className={`rounded-full flex items-center justify-center font-bold border-4 shadow-md ${sz}`}
          style={{ background: `linear-gradient(135deg, ${T.brown}, ${T.accent})`, color: "#fff", borderColor: T.card }}>
          {user?.fullName?.[0]?.toUpperCase() || "?"}
        </div>
      )}

      {/* Upload button */}
      <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center border-2 cursor-pointer transition-all hover:scale-110"
        style={{ background: T.brown, borderColor: T.card }}>
        <Camera size={12} color="#fff" />
        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      </label>

      {/* Remove button — sirf tab dikhao jab avatar ho */}
      {user?.avatar?.url && (
        <button
          onClick={handleRemoveAvatar}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition hover:scale-110"
          style={{ background: T.red, borderColor: T.card }}>
          <X size={9} color="#fff" />
        </button>
      )}
    </div>
  );
}

// ── Profile Tab ────────────────────────────────────────────────
function ProfileTab({ user }) {
  const dispatch = useDispatch();
  const { profile } = useSelector((s) => s.settings);

  const [fullName,          setFullName]          = useState(user?.fullName         || "");
  const [bio,               setBio]               = useState(user?.bio              || "");
  const [designation,       setDesignation]       = useState(user?.designation      || "");
  const [dob,               setDob]               = useState(user?.dateOfBirth ? new Date(user.dateOfBirth) : null);
  const [gender,            setGender]            = useState(user?.gender           || "prefer_not_to_say");
  const [website,           setWebsite]           = useState(user?.website          || "");
  const [businessCategory,  setBusinessCategory]  = useState(user?.businessCategory || "");
  const [selectedCountry,   setSelectedCountry]   = useState(null);
  const [selectedState,     setSelectedState]     = useState(null);
  const [selectedCity,      setSelectedCity]      = useState(null);
  const [countryOptions] = useState(() =>
  Country.getAllCountries().map(c => ({
    label: c.name, value: c.isoCode, flag: c.flag,
  }))
);

  // ── Sync when user changes ──
  useEffect(() => {
    setFullName(user?.fullName         || "");
    setBio(user?.bio                   || "");
    setDesignation(user?.designation   || "");
    setDob(user?.dateOfBirth ? new Date(user.dateOfBirth) : null);
    setGender(user?.gender             || "prefer_not_to_say");
    setWebsite(user?.website           || "");
    setBusinessCategory(user?.businessCategory || "");

    // Country
    if (user?.location?.country) {
      const found = Country.getAllCountries().find(
        c => c.name === user.location.country
      );
      setSelectedCountry(found ? { label: found.name, value: found.isoCode } : null);
    } else {
      setSelectedCountry(null);
    }

    // State
    if (user?.location?.state) {
      setSelectedState({ label: user.location.state, value: user.location.state });
    } else {
      setSelectedState(null);
    }

    // City
    if (user?.location?.city) {
      setSelectedCity({ label: user.location.city, value: user.location.city });
    } else {
      setSelectedCity(null);
    }
  }, [user]);

  const handleSave = () => {
    dispatch(updateProfile({
      fullName, bio, designation,
      dateOfBirth: dob ? dob.toISOString() : null,
      gender, website,
      businessCategory: businessCategory || null,
      location: (selectedCity || selectedState || selectedCountry) ? {
        city:    selectedCity?.label    || null,
        state:   selectedState?.label   || null,
        country: selectedCountry?.label || null,
      } : null,
    }))
      .unwrap()
      .then(() => toast.success("Profile updated successfully!"))
      .catch((err) => toast.error(err || "Update failed"));
  };

  const handleDiscard = () => {
    setFullName(user?.fullName         || "");
    setBio(user?.bio                   || "");
    setDesignation(user?.designation   || "");
    setDob(user?.dateOfBirth ? new Date(user.dateOfBirth) : null);
    setGender(user?.gender             || "prefer_not_to_say");
    setWebsite(user?.website           || "");
    setBusinessCategory(user?.businessCategory || "");
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    dispatch(clearProfileState());
  };

  // ── react-select shared styles ──
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      borderRadius: 12,
      borderColor: state.isFocused ? T.accent : T.border,
      background: T.brownXlt,
      fontSize: 14,
      minHeight: 42,
      boxShadow: "none",
      "&:hover": { borderColor: T.accent },
    }),
    option: (base, state) => ({
      ...base,
      background: state.isSelected ? T.brown : state.isFocused ? T.brownLt : "#fff",
      color: state.isSelected ? "#fff" : T.text,
      fontSize: 13,
    }),
    singleValue: (base) => ({ ...base, color: T.text }),
    placeholder: (base) => ({ ...base, color: T.textLt }),
    menu: (base) => ({ ...base, borderRadius: 12, overflow: "hidden" }),
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-5 rounded-full" style={{ background: T.accent }} />
        <p className="text-base font-bold" style={{ color: T.brown }}>Personal Information</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name" placeholder="Enter your name"
          value={fullName} onChange={(e) => setFullName(e.target.value)} />

        <Field label="Email Address" placeholder="Email"
          value={user?.email || ""} onChange={() => {}}
          suffix={user?.email ? "✓ Verified" : null} disabled />

        <Field label="Username" placeholder="@username"
          value={user?.username ? `@${user.username}` : ""}
          onChange={() => {}} disabled />

        <Field label="Designation / Specialty"
          placeholder="e.g. Interior Designer, Tile Supplier"
          value={designation} onChange={(e) => setDesignation(e.target.value)} />

        <Field label="Website" placeholder="https://yourwebsite.com"
          value={website} onChange={(e) => setWebsite(e.target.value)}
          hint="Must start with https://" />

        {/* Date of Birth */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>
            Date of Birth
          </label>
          <DatePicker
            selected={dob}
            onChange={(date) => setDob(date)}
            dateFormat="dd-MM-yyyy"
            showMonthDropdown showYearDropdown dropdownMode="select"
            maxDate={new Date()}
            placeholderText="Select date of birth"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            wrapperClassName="w-full"
            calendarClassName="rounded-xl shadow-lg border"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ border: `1.5px solid ${T.border}`, background: T.brownXlt, color: T.text }}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e)  => (e.target.style.borderColor = T.border)}>
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>

        {/* Business Category */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>
            Business Category
          </label>
          <select value={businessCategory} onChange={(e) => setBusinessCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ border: `1.5px solid ${T.border}`, background: T.brownXlt, color: T.text }}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e)  => (e.target.style.borderColor = T.border)}>
            <option value="">Select category</option>
            <option value="marble">Marble</option>
            <option value="granite">Granite</option>
            <option value="limestone">Limestone</option>
            <option value="cnc">CNC</option>
            <option value="quarry">Quarry</option>
            <option value="supplier">Supplier</option>
            <option value="designer">Designer</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>Country</label>
          <Select
        options={countryOptions}
            value={selectedCountry}
            onChange={(val) => { setSelectedCountry(val); setSelectedState(null); setSelectedCity(null); }}
            placeholder="Select country..."
            styles={selectStyles}
            formatOptionLabel={(opt) => (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{opt.flag}</span><span>{opt.label}</span>
              </div>
            )}
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>
            State / Province
          </label>
          <Select
            options={selectedCountry
              ? State.getStatesOfCountry(selectedCountry.value).map(s => ({
                  label: s.name, value: s.isoCode,
                }))
              : []}
            value={selectedState}
            onChange={(val) => { setSelectedState(val); setSelectedCity(null); }}
            placeholder={selectedCountry ? "Select state..." : "Select country first"}
            isDisabled={!selectedCountry}
            styles={selectStyles}
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>City</label>
          <Select
            options={selectedCountry && selectedState
              ? City.getCitiesOfState(selectedCountry.value, selectedState.value).map(c => ({
                  label: c.name, value: c.name,
                }))
              : []}
            value={selectedCity}
            onChange={setSelectedCity}
            placeholder={selectedState ? "Select city..." : "Select state first"}
            isDisabled={!selectedState}
            styles={selectStyles}
          />
        </div>

        {/* Bio */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1.5" style={{ color: T.brownMid }}>Bio</label>
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself..." maxLength={150}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 resize-none"
            style={{ border: `1.5px solid ${T.border}`, background: T.brownXlt, color: T.text }}
            onFocus={(e) => (e.target.style.borderColor = T.accent)}
            onBlur={(e)  => (e.target.style.borderColor = T.border)} />
          <p className="text-xs mt-1" style={{ color: T.textLt }}>{bio.length}/150</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <button onClick={handleDiscard}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
          style={{ border: `1.5px solid ${T.border}`, background: "transparent", color: T.brownMid }}>
          Discard Changes
        </button>
        <button onClick={handleSave} disabled={profile.loading}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: T.brown }}>
          {profile.loading ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
// ── Password Tab ───────────────────────────────────────────────
function PasswordTab() {
  const dispatch = useDispatch();
  const { password } = useSelector((s) => s.settings);
  const { user }     = useSelector((s) => s.auth);

  const isGoogleUser = user?.authProvider === "google" && !user?.hasPassword;

  const [oldPwd,  setOldPwd]  = useState("");
  const [newPwd,  setNewPwd]  = useState("");
  const [confPwd, setConfPwd] = useState("");
  const [showOld,  setShowOld]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  const matchOk  = confPwd.length > 0 && confPwd === newPwd;
  const matchBad = confPwd.length > 0 && confPwd !== newPwd;

  const handleUpdate = () => {
    if (!matchOk) return;
    dispatch(updatePassword({
      oldPassword: isGoogleUser ? null : oldPwd,
      newPassword: newPwd,
    }))
      .unwrap()
      .then(() => {
        setOldPwd(""); setNewPwd(""); setConfPwd("");
        toast.success(isGoogleUser
          ? "Password created! You can now login with email too."
          : "Password updated successfully!"
        );
      })
      .catch((err) => toast.error(err || "Failed"));
  };

  useEffect(() => {
    return () => { dispatch(clearPasswordState()); };
  }, [dispatch]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-5 rounded-full" style={{ background: T.accent }} />
        <p className="text-base font-bold" style={{ color: T.brown }}>Login & Password</p>
      </div>

      {isGoogleUser && (
        <div className="rounded-xl p-3 mb-5 flex items-start gap-3"
          style={{ background: "#f0f7ff", border: "1.5px solid #bfdbfe" }}>
          <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0 mt-0.5">
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-blue-700">Google Account</p>
            <p className="text-xs text-blue-600 mt-0.5">
             You're signed in with Google. Create a password to also login with your email.   
            </p>
          </div>
        </div>
      )}

      <p className="text-xs mb-5" style={{ color: T.textLt }}>
        {isGoogleUser
          ? "Create a password to enable email & password login."
          : "Keep your account secure with a strong password."}
      </p>

      <div className="flex flex-col gap-4">
        {!isGoogleUser && (
          <PwdField label="Current Password" placeholder="Enter current password"
            value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
            show={showOld} onToggle={() => setShowOld(!showOld)} />
        )}
        <PwdField label={isGoogleUser ? "Create Password" : "New Password"}
          placeholder="Min 8 characters"
          value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
          show={showNew} onToggle={() => setShowNew(!showNew)} />
        <PwdField label="Confirm Password" placeholder="Repeat password"
          value={confPwd} onChange={(e) => setConfPwd(e.target.value)}
          show={showConf} onToggle={() => setShowConf(!showConf)}
          matchOk={matchOk} matchBad={matchBad} />
      </div>

      <button onClick={handleUpdate}
        disabled={!matchOk || password.loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 mt-6 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: T.brown }}>
        {password.loading ? "Saving..." : isGoogleUser ? "🔒 Create Password" : "🔒 Update Password"}
      </button>
    </div>
  );
}
// ── Deactivate Tab ─────────────────────────────────────────────
function DeactivateTab() {
  const dispatch = useDispatch();
  const { deactivate } = useSelector((s) => s.settings);
  const [confirm, setConfirm] = useState("");
  const ready = confirm === "DEACTIVATE";

  const handleDeactivate = () => {
    if (!ready) return;
    dispatch(deactivateAccount())
      .unwrap()
      .then(() => {
        window.location.href = "/";
      })
       .catch((err) => toast.error(err || "Deactivation failed"));
      
  };

  useEffect(() => {
    return () => { dispatch(clearDeactivateState()); };
  }, [dispatch]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-5 rounded-full bg-red-400" />
        <p className="text-base font-bold text-red-600">Deactivate Account</p>
      </div>

      <div className="rounded-2xl p-4 mb-5 border" style={{ background: T.redLt, borderColor: "#fecaca" }}>
        <p className="text-sm font-bold text-red-700 mb-3">⚠️ Read carefully before proceeding</p>
        {[
          "Your account will be permanently deactivated",
          "All your posts and data will be deleted",
          "You will not be able to log in again",
          "This action cannot be undone",
        ].map((t) => (
          <p key={t} className="text-xs text-red-600 mt-1.5 flex items-start gap-1.5">
            <span className="mt-0.5">•</span> {t}
          </p>
        ))}
      </div>

     
      <div className="mb-5">
        <label className="block text-xs font-semibold mb-1.5 text-gray-500">
          Type <span className="text-red-500 font-bold">DEACTIVATE</span> to confirm
        </label>
        <input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="DEACTIVATE"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{ border: `1.5px solid ${ready ? "#fca5a5" : "#fecaca"}`, background: T.redLt, color: T.text }} />
      </div>

      <button onClick={handleDeactivate}
        disabled={!ready || deactivate.loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: T.red }}>
        {deactivate.loading ? "Deactivating..." : "⚠️ Deactivate My Account"}
      </button>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Settings() {
  const dispatch   = useDispatch();
  const { user }   = useSelector((s) => s.auth);
  const [activeTab, setActiveTab] = useState(() => {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return ["profile", "password", "deactivate"].includes(tab) ? tab : "profile";
});

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const tabContent = {
    profile:    <ProfileTab user={user} />,
    password:   <PasswordTab />,
    deactivate: <DeactivateTab />,
  };

  return (
    <div className="min-h-screen pt-14 pb-20 md:pt-0 md:pb-0" style={{ background: T.bg }}>
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">

        {/* Page Title */}
        <div className="mb-6 hidden md:block">
          <h1 className="text-2xl font-bold" style={{ color: T.brown }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: T.textLt }}>Manage your account and preferences</p>
        </div>

        {/* Mobile Header */}
        <div className="flex md:hidden items-center gap-3 rounded-2xl border px-4 py-3 mb-4"
          style={{ background: T.card, borderColor: T.border }}>
          <AvatarBlock user={user} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate" style={{ color: T.text }}>{user?.fullName}</p>
            <p className="text-xs truncate" style={{ color: T.textLt }}>@{user?.username}</p>
          </div>
          <button className="p-2 rounded-full hover:bg-[#f5ece0] transition-colors"
            onClick={() => setActiveTab("profile")}>
            <Pencil size={14} style={{ color: T.brownMid }} />
          </button>
        </div>

        <div className="flex gap-5 items-start">

          {/* Left Sidebar */}
          <div className="hidden md:flex flex-col items-center w-72 shrink-0 rounded-2xl border p-6 sticky top-24"
            style={{ background: T.card, borderColor: T.border }}>
            <AvatarBlock user={user} size="lg" />
            <p className="mt-3 font-bold text-sm text-center" style={{ color: T.text }}>{user?.fullName}</p>
            <p className="text-xs mt-1 mb-6" style={{ color: T.textLt }}>@{user?.username}</p>

            <nav className="w-full flex flex-col gap-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const active   = activeTab === id;
                const isDanger = id === "deactivate";
                return (
                  <button key={id}
                   onClick={() => {
  setActiveTab(id);
  window.history.pushState({}, "", `?tab=${id}`);
}}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                    style={{
                      background: active ? (isDanger ? "#fef2f2" : T.brownLt) : "transparent",
                      color: active ? (isDanger ? T.red : T.brown) : T.textLt,
                    }}>
                    <Icon size={15} style={{ color: active ? (isDanger ? T.red : T.accent) : T.textLt }} />
                    {label}
                    {active && <ChevronRight size={14} className="ml-auto"
                      style={{ color: isDanger ? T.red : T.accent }} />}
                  </button>
                );
              })}
            </nav>

            <div className="w-full border-t mt-4 pt-4" style={{ borderColor: T.border }}>
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left hover:bg-red-50 text-red-500">
                <LogOut size={15} className="text-red-400" />
                Log Out
              </button>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0 rounded-2xl border p-5 md:p-6 mb-20 md:mb-0"
            style={{ background: T.card, borderColor: T.border }}>
            {tabContent[activeTab]}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 flex md:hidden border-t"
        style={{ background: T.card, borderColor: T.border }}>
        {NAV_ITEMS.map(({ id, icon: Icon }) => {
          const active   = activeTab === id;
          const isDanger = id === "deactivate";
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold transition-colors"
              style={{ color: active ? (isDanger ? T.red : T.brown) : T.textLt }}>
              <Icon size={16} style={{ color: active ? (isDanger ? T.red : T.accent) : T.textLt }} />
              {id === "profile" ? "Profile" : id === "password" ? "Password" : "Deactivate"}
            </button>
          );
        })}
        <button onClick={handleLogout}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-semibold text-red-400">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}