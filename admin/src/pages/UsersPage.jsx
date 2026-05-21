// // src/pages/UsersPage.jsx
// import { useEffect, useState, useCallback, useRef } from "react";
// import { useDispatch, useSelector } from "react-redux";
// import { useNavigate } from "react-router-dom";
// import customSelect from "../components/CustomSelect";
// import {
//   fetchUsers,
//   updateUserStatus,
//   toggleVerifiedBadge,
//   deleteUser,
//   setFilters,
//   setPage,
//   clearErrors,
//   resetFilters,
//   selectUsers,
//   selectUsersLoading,
//   selectUsersError,
//   selectActionLoading,
//   selectActionError,
//   selectUsersPagination,
//   selectUsersFilters,
// } from "../lib/redux/usersSlice";

// // ─── Utility ──────────────────────────────────────────────────────────────────

// function useDebounce(value, delay = 400) {
//   const [debounced, setDebounced] = useState(value);
//   useEffect(() => {
//     const t = setTimeout(() => setDebounced(value), delay);
//     return () => clearTimeout(t);
//   }, [value, delay]);
//   return debounced;
// }

// function formatDate(iso) {
//   if (!iso) return "—";
//   return new Date(iso).toLocaleDateString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// }

// function getInitials(name = "") {
//   return name
//     .split(" ")
//     .map((w) => w[0])
//     .join("")
//     .slice(0, 2)
//     .toUpperCase();
// }

// // ─── Sub-components ───────────────────────────────────────────────────────────

// function StatusBadge({ status }) {
//   const map = {
//     active: { bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Active" },
//     suspended: { bg: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Suspended" },
//     banned: { bg: "bg-red-500/15 text-red-400 border-red-500/30", label: "Banned" },
//   };
//   const s = map[status] || map.active;
//   return (
//     <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${s.bg}`}>
//       <span className="w-1.5 h-1.5 rounded-full bg-current" />
//       {s.label}
//     </span>
//   );
// }

// function RoleBadge({ role }) {
//   const map = {
//     user: "bg-sky-500/15 text-sky-400 border-sky-500/30",
//     moderator: "bg-violet-500/15 text-violet-400 border-violet-500/30",
//   };
//   return (
//     <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${map[role] || map.user}`}>
//       {role === "moderator" ? "Mod" : "User"}
//     </span>
//   );
// }

// function Avatar({ user, size = "md" }) {
//   const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
//   const colors = ["bg-pink-600", "bg-violet-600", "bg-cyan-600", "bg-amber-600", "bg-emerald-600", "bg-rose-600"];
//   const color = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];

//   if (user?.profilePicture) {
//     return (
//       <img
//         src={user.profilePicture}
//         alt={user.username}
//         className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10`}
//       />
//     );
//   }
//   return (
//     <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white/10`}>
//       {getInitials(user?.fullName || user?.username || "?")}
//     </div>
//   );
// }

// function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger = false, loading = false }) {
//   if (!isOpen) return null;
//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//       <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
//       <div className="relative bg-[#161b27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
//         <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
//         <p className="text-sm text-white/60 mb-6">{message}</p>
//         <div className="flex gap-3 justify-end">
//           <button
//             onClick={onClose}
//             disabled={loading}
//             className="px-4 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/12 text-white/80 transition-colors disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={onConfirm}
//             disabled={loading}
//             className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
//               danger
//                 ? "bg-red-600 hover:bg-red-500 text-white"
//                 : "bg-violet-600 hover:bg-violet-500 text-white"
//             }`}
//           >
//             {loading && (
//               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
//               </svg>
//             )}
//             {confirmLabel}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function StatusModal({ isOpen, onClose, onConfirm, user, loading }) {
//   const [status, setStatus] = useState("");
//   const [reason, setReason] = useState("");

//   useEffect(() => {
//     if (isOpen) { setStatus(""); setReason(""); }
//   }, [isOpen]);

//   if (!isOpen || !user) return null;

//   const statusOptions = [
//     { value: "active", label: "Active", color: "text-emerald-400" },
//     { value: "suspended", label: "Suspended", color: "text-amber-400" },
//     { value: "banned", label: "Banned", color: "text-red-400" },
//   ].filter((o) => o.value !== user.status);

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
//       <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
//       <div className="relative bg-[#161b27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
//         <h3 className="text-lg font-semibold text-white mb-1">Change Status</h3>
//         <p className="text-sm text-white/50 mb-5">
//           Update account status for <span className="text-white/80">@{user.username}</span>
//         </p>

//         <div className="space-y-3 mb-4">
//           {statusOptions.map((opt) => (
//             <label
//               key={opt.value}
//               className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
//                 status === opt.value
//                   ? "border-violet-500 bg-violet-500/10"
//                   : "border-white/10 hover:border-white/20"
//               }`}
//             >
//               <input
//                 type="radio"
//                 name="status"
//                 value={opt.value}
//                 checked={status === opt.value}
//                 onChange={() => setStatus(opt.value)}
//                 className="accent-violet-500"
//               />
//               <span className={`text-sm font-medium ${opt.color}`}>{opt.label}</span>
//             </label>
//           ))}
//         </div>

//         <textarea
//           value={reason}
//           onChange={(e) => setReason(e.target.value)}
//           placeholder="Reason (optional) — this may be sent to the user"
//           rows={3}
//           className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-violet-500/60 mb-5"
//         />

//         <div className="flex gap-3 justify-end">
//           <button
//             onClick={onClose}
//             disabled={loading}
//             className="px-4 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/12 text-white/80 transition-colors disabled:opacity-50"
//           >
//             Cancel
//           </button>
//           <button
//             onClick={() => onConfirm({ status, reason })}
//             disabled={!status || loading}
//             className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
//           >
//             {loading && (
//               <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
//               </svg>
//             )}
//             Update Status
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function UserRowMenu({ user, onStatusChange, onToggleVerify, onDelete, actionLoading }) {
//   const [open, setOpen] = useState(false);
//   const ref = useRef(null);
//   const isLoading = actionLoading === user._id;

//   useEffect(() => {
//     function handleClick(e) {
//       if (ref.current && !ref.current.contains(e.target)) setOpen(false);
//     }
//     document.addEventListener("mousedown", handleClick);
//     return () => document.removeEventListener("mousedown", handleClick);
//   }, []);

//   return (
//     <div ref={ref} className="relative">
//       <button
//         onClick={() => setOpen((o) => !o)}
//         disabled={isLoading}
//         className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40"
//       >
//         {isLoading ? (
//           <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
//             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
//             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
//           </svg>
//         ) : (
//           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
//             <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
//           </svg>
//         )}
//       </button>

//       {open && (
//         <div className="absolute right-0 top-9 z-30 w-52 bg-[#1a2035] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
//           <button
//             onClick={() => { setOpen(false); onStatusChange(user); }}
//             className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/8 hover:text-white transition-colors"
//           >
//             <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
//             </svg>
//             Change Status
//           </button>
//           <button
//             onClick={() => { setOpen(false); onToggleVerify(user._id); }}
//             className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/8 hover:text-white transition-colors"
//           >
//             <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
//             </svg>
//             {user.isVerified ? "Remove Verified" : "Mark Verified"}
//           </button>
//           <div className="border-t border-white/8 my-1" />
//           <button
//             onClick={() => { setOpen(false); onDelete(user); }}
//             className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
//           >
//             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
//             </svg>
//             Delete Account
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Skeleton ─────────────────────────────────────────────────────────────────

// function SkeletonRow() {
//   return (
//     <tr className="border-b border-white/5">
//       {[...Array(7)].map((_, i) => (
//         <td key={i} className="px-4 py-3.5">
//           <div className="h-4 bg-white/8 rounded-full animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
//         </td>
//       ))}
//     </tr>
//   );
// }

// // ─── Main Page ────────────────────────────────────────────────────────────────

// export default function UsersPage() {
//   const dispatch = useDispatch();
//   const navigate = useNavigate();

//   const users = useSelector(selectUsers);
//   const loading = useSelector(selectUsersLoading);
//   const error = useSelector(selectUsersError);
//   const actionLoading = useSelector(selectActionLoading);
//   const actionError = useSelector(selectActionError);
//   const { totalUsers, totalPages, currentPage } = useSelector(selectUsersPagination);
//   const filters = useSelector(selectUsersFilters);

//   // Local search input (debounced before dispatching)
//   const [searchInput, setSearchInput] = useState(filters.search);
//   const debouncedSearch = useDebounce(searchInput, 450);

//   // Modals
//   const [statusModal, setStatusModal] = useState({ open: false, user: null });
//   const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
//   const [deleteLoading, setDeleteLoading] = useState(false);

//   // Toast
//   const [toast, setToast] = useState(null);

//   const showToast = useCallback((message, type = "success") => {
//     setToast({ message, type });
//     setTimeout(() => setToast(null), 3500);
//   }, []);

//   // ── Fetch on filter change ──────────────────────────────────────────────────
//   useEffect(() => {
//     // Build query — always exclude super_admin on the backend
//     // The controller handles role filtering; we never request super_admin here
//     const queryParams = {
//       search: filters.search,
//       role: filters.role || undefined,
//       status: filters.status || undefined,
//       verified: filters.verified || undefined,
//       sortBy: filters.sortBy,
//       sortOrder: filters.sortOrder,
//       page: filters.page,
//       limit: filters.limit,
//     };
//     dispatch(fetchUsers(queryParams));
//   }, [dispatch, filters]);

//   // ── Sync debounced search → Redux ───────────────────────────────────────────
//   useEffect(() => {
//     if (debouncedSearch !== filters.search) {
//       dispatch(setFilters({ search: debouncedSearch, page: 1 }));
//     }
//   }, [debouncedSearch]);

//   // ── Action error toast ──────────────────────────────────────────────────────
//   useEffect(() => {
//     if (actionError) {
//       showToast(actionError, "error");
//       dispatch(clearErrors());
//     }
//   }, [actionError]);

//   // ── Handlers ────────────────────────────────────────────────────────────────

//   const handleFilterChange = (key, value) => {
//     dispatch(setFilters({ [key]: value, page: 1 }));
//   };

//   const handleSort = (col) => {
//     if (filters.sortBy === col) {
//       dispatch(setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" }));
//     } else {
//       dispatch(setFilters({ sortBy: col, sortOrder: "desc" }));
//     }
//   };

//   const handleStatusConfirm = async ({ status, reason }) => {
//     const result = await dispatch(
//       updateUserStatus({ userId: statusModal.user._id, status, reason })
//     );
//     if (!result.error) {
//       showToast(`@${statusModal.user.username} status updated to ${status}`);
//       setStatusModal({ open: false, user: null });
//     }
//   };

//   const handleDeleteConfirm = async () => {
//     setDeleteLoading(true);
//     const result = await dispatch(deleteUser(deleteModal.user._id));
//     setDeleteLoading(false);
//     if (!result.error) {
//       showToast(`@${deleteModal.user.username} deleted`);
//       setDeleteModal({ open: false, user: null });
//     }
//   };

//   const handleToggleVerify = async (userId) => {
//     const result = await dispatch(toggleVerifiedBadge(userId));
//     if (!result.error) {
//       const u = users.find((x) => x._id === userId);
//       showToast(`@${u?.username} ${u?.isVerified ? "unverified" : "verified"}`);
//     }
//   };

//   const SortIcon = ({ col }) => {
//     if (filters.sortBy !== col) return <span className="w-3 h-3 opacity-20">↕</span>;
//     return <span className="w-3 h-3 text-violet-400">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>;
//   };

//   return (
//     <>
//       {/* ── Toast ──────────────────────────────────────────────────────────── */}
//       {toast && (
//         <div
//           className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-md transition-all ${
//             toast.type === "error"
//               ? "bg-red-500/20 border-red-500/30 text-red-300"
//               : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
//           }`}
//         >
//           {toast.message}
//         </div>
//       )}

//       {/* ── Modals ──────────────────────────────────────────────────────────── */}
//       <StatusModal
//         isOpen={statusModal.open}
//         user={statusModal.user}
//         onClose={() => setStatusModal({ open: false, user: null })}
//         onConfirm={handleStatusConfirm}
//         loading={actionLoading === statusModal.user?._id}
//       />
//       <ConfirmModal
//         isOpen={deleteModal.open}
//         onClose={() => setDeleteModal({ open: false, user: null })}
//         onConfirm={handleDeleteConfirm}
//         title="Delete Account"
//         message={`Permanently delete @${deleteModal.user?.username}? This cannot be undone. All their posts and data will be removed.`}
//         confirmLabel="Delete"
//         danger
//         loading={deleteLoading}
//       />

//       {/* ── Page ────────────────────────────────────────────────────────────── */}
//       <div className="min-h-screen bg-[#0d1117] text-white">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

//           {/* Header */}
//           <div className="flex items-start justify-between mb-8">
//             <div>
//               <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
//               <p className="text-sm text-white/50 mt-1">
//                 {loading ? "Loading..." : `${totalUsers.toLocaleString()} total users`}
//               </p>
//             </div>
//             <button
//               onClick={() => { dispatch(resetFilters()); setSearchInput(""); }}
//               className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
//             >
//               Reset filters
//             </button>
//           </div>

//           {/* Filters Bar */}
//           <div className="flex flex-wrap gap-3 mb-6">
//             {/* Search */}
//             <div className="relative flex-1 min-w-[220px] max-w-sm">
//               <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//               </svg>
//               <input
//                 type="text"
//                 value={searchInput}
//                 onChange={(e) => setSearchInput(e.target.value)}
//                 placeholder="Search name, username, email…"
//                 className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 transition-colors"
//               />
//               {searchInput && (
//                 <button
//                   onClick={() => { setSearchInput(""); dispatch(setFilters({ search: "", page: 1 })); }}
//                   className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
//                 >
//                   ×
//                 </button>
//               )}
//             </div>

//             {/* Role */}
//           <CustomSelect
//   value={filters.role}
//   onChange={(val) => handleFilterChange("role", val)}
//   options={[
//     { value: "", label: "All Roles" },
//     { value: "user", label: "User" },
//     { value: "moderator", label: "Moderator" },
//   ]}
// />

//             {/* Status */}
//           <CustomSelect
//   value={filters.status}
//   onChange={(val) => handleFilterChange("status", val)}
//   options={[
//     { value: "", label: "All Statuses" },
//     { value: "active", label: "Active" },
//     { value: "suspended", label: "Suspended" },
//     { value: "banned", label: "Banned" },
//   ]}
// />

//             {/* Verified */}
//           <CustomSelect
//   value={filters.verified}
//   onChange={(val) => handleFilterChange("verified", val)}
//   options={[
//     { value: "", label: "All" },
//     { value: "true", label: "Verified ✓" },
//     { value: "false", label: "Unverified" },
//   ]}
// />


//             {/* Per page */}
//           <CustomSelect
//   value={String(filters.limit)}
//   onChange={(val) => handleFilterChange("limit", Number(val))}
//   options={[
//     { value: "12", label: "12 / page" },
//     { value: "24", label: "24 / page" },
//     { value: "50", label: "50 / page" },
//   ]}
// />

//           {/* Error Banner */}
//           {error && (
//             <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-sm text-red-300 flex items-center justify-between">
//               <span>{error}</span>
//               <button
//                 onClick={() => dispatch(fetchUsers({ ...filters }))}
//                 className="text-xs underline hover:text-red-200"
//               >
//                 Retry
//               </button>
//             </div>
//           )}

//           {/* Table */}
//           <div className="bg-[#111827] border border-white/8 rounded-2xl overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead>
//                   <tr className="border-b border-white/8">
//                     {[
//                       { label: "User", col: "fullName" },
//                       { label: "Role", col: null },
//                       { label: "Status", col: "status" },
//                       { label: "Posts", col: "postsCount" },
//                       { label: "Followers", col: "followersCount" },
//                       { label: "Joined", col: "createdAt" },
//                       { label: "", col: null },
//                     ].map(({ label, col }) => (
//                       <th
//                         key={label}
//                         onClick={col ? () => handleSort(col) : undefined}
//                         className={`px-4 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider ${col ? "cursor-pointer hover:text-white/70 select-none" : ""}`}
//                       >
//                         <span className="inline-flex items-center gap-1">
//                           {label}
//                           {col && <SortIcon col={col} />}
//                         </span>
//                       </th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {loading
//                     ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
//                     : users.length === 0
//                     ? (
//                       <tr>
//                         <td colSpan={7} className="px-4 py-16 text-center text-white/30 text-sm">
//                           <div className="flex flex-col items-center gap-2">
//                             <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
//                             </svg>
//                             No users found
//                           </div>
//                         </td>
//                       </tr>
//                     )
//                     : users.map((user) => (
//                       <tr
//                         key={user._id}
//                         className="border-b border-white/5 hover:bg-white/3 transition-colors group"
//                       >
//                         {/* User cell */}
//                         <td className="px-4 py-3.5">
//                           <div className="flex items-center gap-3">
//                             <Avatar user={user} />
//                             <div className="min-w-0">
//                               <div className="flex items-center gap-1.5">
//                                 <span className="text-sm font-medium text-white truncate">
//                                   {user.fullName || user.username}
//                                 </span>
//                                 {user.isVerified && (
//                                   <svg className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
//                                     <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
//                                   </svg>
//                                 )}
//                               </div>
//                               <p className="text-xs text-white/40 truncate">@{user.username}</p>
//                             </div>
//                           </div>
//                         </td>

//                         <td className="px-4 py-3.5">
//                           <RoleBadge role={user.role} />
//                         </td>

//                         <td className="px-4 py-3.5">
//                           <StatusBadge status={user.status} />
//                         </td>

//                         <td className="px-4 py-3.5 text-sm text-white/60 tabular-nums">
//                           {(user.postsCount ?? 0).toLocaleString()}
//                         </td>

//                         <td className="px-4 py-3.5 text-sm text-white/60 tabular-nums">
//                           {(user.followersCount ?? 0).toLocaleString()}
//                         </td>

//                         <td className="px-4 py-3.5 text-sm text-white/50">
//                           {formatDate(user.createdAt)}
//                         </td>

//                         {/* Actions */}
//                         <td className="px-4 py-3.5">
//                           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
//                             <button
//                               onClick={() => navigate(`/users/${user._id}`)}
//                               className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/14 text-white/70 hover:text-white transition-colors"
//                             >
//                               View
//                             </button>
//                             <UserRowMenu
//                               user={user}
//                               onStatusChange={(u) => setStatusModal({ open: true, user: u })}
//                               onToggleVerify={handleToggleVerify}
//                               onDelete={(u) => setDeleteModal({ open: true, user: u })}
//                               actionLoading={actionLoading}
//                             />
//                           </div>
//                         </td>
//                       </tr>
//                     ))}
//                 </tbody>
//               </table>
//             </div>

//             {/* Pagination */}
//             {!loading && totalPages > 1 && (
//               <div className="flex items-center justify-between px-4 py-3.5 border-t border-white/8">
//                 <p className="text-xs text-white/40">
//                   Page {currentPage} of {totalPages}
//                 </p>
//                 <div className="flex items-center gap-1">
//                   <button
//                     onClick={() => dispatch(setPage(currentPage - 1))}
//                     disabled={currentPage <= 1}
//                     className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                   >
//                     ← Prev
//                   </button>

//                   {/* Page numbers */}
//                   {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
//                     // Show pages around current
//                     let page;
//                     if (totalPages <= 7) {
//                       page = i + 1;
//                     } else if (currentPage <= 4) {
//                       page = i + 1;
//                       if (i === 6) page = totalPages;
//                     } else if (currentPage >= totalPages - 3) {
//                       page = totalPages - 6 + i;
//                       if (i === 0) page = 1;
//                     } else {
//                       const pages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
//                       page = pages[Math.min(i, 4)];
//                     }
//                     return (
//                       <button
//                         key={i}
//                         onClick={() => dispatch(setPage(page))}
//                         className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
//                           page === currentPage
//                             ? "bg-violet-600 text-white"
//                             : "bg-white/5 hover:bg-white/10 text-white/60"
//                         }`}
//                       >
//                         {page}
//                       </button>
//                     );
//                   })}

//                   <button
//                     onClick={() => dispatch(setPage(currentPage + 1))}
//                     disabled={currentPage >= totalPages}
//                     className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
//                   >
//                     Next →
//                   </button>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }



import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import {
  fetchUsers, updateUserStatus, toggleVerifiedBadge, deleteUser,
  setFilters, setPage, clearErrors, resetFilters,
  selectUsers, selectUsersLoading, selectUsersError,
  selectActionLoading, selectActionError,
  selectUsersPagination, selectUsersFilters,
} from "../lib/redux/usersSlice";

function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function StatusBadge({ status }) {
  const map = {
    active:    { bg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Active" },
    suspended: { bg: "bg-amber-500/15 text-amber-400 border-amber-500/30",       label: "Suspended" },
    banned:    { bg: "bg-red-500/15 text-red-400 border-red-500/30",             label: "Banned" },
  };
  const s = map[status] || map.active;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${s.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function RoleBadge({ role }) {
  const map = {
    user:      "bg-sky-500/15 text-sky-400 border-sky-500/30",
    moderator: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${map[role] || map.user}`}>
      {role === "moderator" ? "Mod" : "User"}
    </span>
  );
}

function Avatar({ user, size = "md" }) {
  const sizes  = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const colors = ["bg-pink-600","bg-violet-600","bg-cyan-600","bg-amber-600","bg-emerald-600","bg-rose-600"];
  const color  = colors[(user?.username?.charCodeAt(0) || 0) % colors.length];
  if (user?.profilePicture) {
    return <img src={user.profilePicture} alt={user.username} className={`${sizes[size]} rounded-full object-cover ring-2 ring-white/10`} />;
  }
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold text-white ring-2 ring-white/10`}>
      {getInitials(user?.fullName || user?.username || "?")}
    </div>
  );
}

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger = false, loading = false }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161b27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/12 text-white/80 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${danger ? "bg-red-600 hover:bg-red-500 text-white" : "bg-violet-600 hover:bg-violet-500 text-white"}`}>
            {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusModal({ isOpen, onClose, onConfirm, user, loading }) {
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (isOpen) { setStatus(""); setReason(""); } }, [isOpen]);
  if (!isOpen || !user) return null;
  const statusOptions = [
    { value: "active",    label: "Active",    color: "text-emerald-400" },
    { value: "suspended", label: "Suspended", color: "text-amber-400" },
    { value: "banned",    label: "Banned",    color: "text-red-400" },
  ].filter((o) => o.value !== user.status);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#161b27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-1">Change Status</h3>
        <p className="text-sm text-white/50 mb-5">Update account status for <span className="text-white/80">@{user.username}</span></p>
        <div className="space-y-3 mb-4">
          {statusOptions.map((opt) => (
            <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${status === opt.value ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:border-white/20"}`}>
              <input type="radio" name="status" value={opt.value} checked={status === opt.value} onChange={() => setStatus(opt.value)} className="accent-violet-500" />
              <span className={`text-sm font-medium ${opt.color}`}>{opt.label}</span>
            </label>
          ))}
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional) — this may be sent to the user" rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-violet-500/60 mb-5" />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-white/8 hover:bg-white/12 text-white/80 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={() => onConfirm({ status, reason })} disabled={!status || loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
            Update Status
          </button>
        </div>
      </div>
    </div>
  );
}

function UserRowMenu({ user, onStatusChange, onToggleVerify, onDelete, actionLoading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isLoading = actionLoading === user._id;
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={isLoading} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors disabled:opacity-40">
        {isLoading
          ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
        }
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-52 bg-[#1a2035] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          <button onClick={() => { setOpen(false); onStatusChange(user); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/8 hover:text-white transition-colors">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Change Status
          </button>
          <button onClick={() => { setOpen(false); onToggleVerify(user._id); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/8 hover:text-white transition-colors">
            <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
            {user.isVerified ? "Remove Verified" : "Mark Verified"}
          </button>
          <div className="border-t border-white/8 my-1" />
          <button onClick={() => { setOpen(false); onDelete(user); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Delete Account
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-white/8 rounded-full animate-pulse" style={{ width: `${60 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function UsersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const users         = useSelector(selectUsers);
  const loading       = useSelector(selectUsersLoading);
  const error         = useSelector(selectUsersError);
  const actionLoading = useSelector(selectActionLoading);
  const actionError   = useSelector(selectActionError);
  const { totalUsers, totalPages, currentPage } = useSelector(selectUsersPagination);
  const filters = useSelector(selectUsersFilters);

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 450);

  const [statusModal, setStatusModal] = useState({ open: false, user: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    dispatch(fetchUsers({
      search:    filters.search,
      role:      filters.role      || undefined,
      status:    filters.status    || undefined,
      verified:  filters.verified  || undefined,
      sortBy:    filters.sortBy,
      sortOrder: filters.sortOrder,
      page:      filters.page,
      limit:     filters.limit,
    }));
  }, [dispatch, filters]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      dispatch(setFilters({ search: debouncedSearch, page: 1 }));
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (actionError) { showToast(actionError, "error"); dispatch(clearErrors()); }
  }, [actionError]);

  const handleFilterChange = (key, value) => dispatch(setFilters({ [key]: value, page: 1 }));

  const handleSort = (col) => {
    if (filters.sortBy === col) {
      dispatch(setFilters({ sortOrder: filters.sortOrder === "asc" ? "desc" : "asc" }));
    } else {
      dispatch(setFilters({ sortBy: col, sortOrder: "desc" }));
    }
  };

  const handleStatusConfirm = async ({ status, reason }) => {
    const result = await dispatch(updateUserStatus({ userId: statusModal.user._id, status, reason }));
    if (!result.error) { showToast(`@${statusModal.user.username} status updated to ${status}`); setStatusModal({ open: false, user: null }); }
  };

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true);
    const result = await dispatch(deleteUser(deleteModal.user._id));
    setDeleteLoading(false);
    if (!result.error) { showToast(`@${deleteModal.user.username} deleted`); setDeleteModal({ open: false, user: null }); }
  };

  const handleToggleVerify = async (userId) => {
    const result = await dispatch(toggleVerifiedBadge(userId));
    if (!result.error) {
      const u = users.find((x) => x._id === userId);
      showToast(`@${u?.username} ${u?.isVerified ? "unverified" : "verified"}`);
    }
  };

  const SortIcon = ({ col }) => {
    if (filters.sortBy !== col) return <span className="opacity-20">↕</span>;
    return <span className="text-violet-400">{filters.sortOrder === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <>
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-md ${toast.type === "error" ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"}`}>
          {toast.message}
        </div>
      )}

      <StatusModal isOpen={statusModal.open} user={statusModal.user} onClose={() => setStatusModal({ open: false, user: null })} onConfirm={handleStatusConfirm} loading={actionLoading === statusModal.user?._id} />
      <ConfirmModal isOpen={deleteModal.open} onClose={() => setDeleteModal({ open: false, user: null })} onConfirm={handleDeleteConfirm} title="Delete Account" message={`Permanently delete @${deleteModal.user?.username}? This cannot be undone.`} confirmLabel="Delete" danger loading={deleteLoading} />

      <div className="min-h-screen bg-[#0d1117] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
              <p className="text-sm text-white/50 mt-1">{loading ? "Loading..." : `${totalUsers.toLocaleString()} total users`}</p>
            </div>
            <button onClick={() => { dispatch(resetFilters()); setSearchInput(""); }} className="text-xs text-white/40 hover:text-white/70 transition-colors underline underline-offset-2">
              Reset filters
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search name, username, email…" className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 transition-colors" />
              {searchInput && (
                <button onClick={() => { setSearchInput(""); dispatch(setFilters({ search: "", page: 1 })); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">×</button>
              )}
            </div>

            <CustomSelect
              value={filters.role}
              onChange={(val) => handleFilterChange("role", val)}
              options={[{ value: "", label: "All Roles" }, { value: "user", label: "User" }, { value: "moderator", label: "Moderator" }]}
            />
            <CustomSelect
              value={filters.status}
              onChange={(val) => handleFilterChange("status", val)}
              options={[{ value: "", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }, { value: "banned", label: "Banned" }]}
            />
            <CustomSelect
              value={filters.verified}
              onChange={(val) => handleFilterChange("verified", val)}
              options={[{ value: "", label: "All" }, { value: "true", label: "Verified ✓" }, { value: "false", label: "Unverified" }]}
            />
            <CustomSelect
              value={String(filters.limit)}
              onChange={(val) => handleFilterChange("limit", Number(val))}
              options={[{ value: "12", label: "12 / page" }, { value: "24", label: "24 / page" }, { value: "50", label: "50 / page" }]}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-sm text-red-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => dispatch(fetchUsers({ ...filters }))} className="text-xs underline hover:text-red-200">Retry</button>
            </div>
          )}

          {/* Table */}
          <div className="bg-[#111827] border border-white/8 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {[
                      { label: "User",      col: "fullName"       },
                      { label: "Role",      col: null             },
                      { label: "Status",    col: "status"         },
                      { label: "Posts",     col: "postsCount"     },
                      { label: "Followers", col: "followersCount" },
                      { label: "Joined",    col: "createdAt"      },
                      { label: "",          col: null             },
                    ].map(({ label, col }) => (
                      <th key={label} onClick={col ? () => handleSort(col) : undefined} className={`px-4 py-3.5 text-left text-xs font-semibold text-white/40 uppercase tracking-wider ${col ? "cursor-pointer hover:text-white/70 select-none" : ""}`}>
                        <span className="inline-flex items-center gap-1">{label}{col && <SortIcon col={col} />}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
                    : users.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center text-white/30 text-sm">
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            No users found
                          </div>
                        </td>
                      </tr>
                    )
                    : users.map((user) => (
                      <tr key={user._id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar user={user} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-white truncate">{user.fullName || user.username}</span>
                                {user.isVerified && (
                                  <svg className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                )}
                              </div>
                              <p className="text-xs text-white/40 truncate">@{user.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><RoleBadge role={user.role} /></td>
                        <td className="px-4 py-3.5"><StatusBadge status={user.status} /></td>
                        <td className="px-4 py-3.5 text-sm text-white/60 tabular-nums">{(user.postsCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-sm text-white/60 tabular-nums">{(user.followersCount ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-sm text-white/50">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => navigate(`/users/${user._id}`)} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/14 text-white/70 hover:text-white transition-colors">View</button>
                            <UserRowMenu user={user} onStatusChange={(u) => setStatusModal({ open: true, user: u })} onToggleVerify={handleToggleVerify} onDelete={(u) => setDeleteModal({ open: true, user: u })} actionLoading={actionLoading} />
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3.5 border-t border-white/8">
                <p className="text-xs text-white/40">Page {currentPage} of {totalPages}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => dispatch(setPage(currentPage - 1))} disabled={currentPage <= 1} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">← Prev</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page;
                    if (totalPages <= 7) { page = i + 1; }
                    else if (currentPage <= 4) { page = i + 1; if (i === 6) page = totalPages; }
                    else if (currentPage >= totalPages - 3) { page = totalPages - 6 + i; if (i === 0) page = 1; }
                    else { const pages = [1, currentPage - 1, currentPage, currentPage + 1, totalPages]; page = pages[Math.min(i, 4)]; }
                    return (
                      <button key={i} onClick={() => dispatch(setPage(page))} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === currentPage ? "bg-violet-600 text-white" : "bg-white/5 hover:bg-white/10 text-white/60"}`}>{page}</button>
                    );
                  })}
                  <button onClick={() => dispatch(setPage(currentPage + 1))} disabled={currentPage >= totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}