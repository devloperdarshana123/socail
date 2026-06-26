

import { useEffect, useCallback, useMemo, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

import { getAdminSocket, onAdminSocketReady } from "../lib/adminSocket";
import {
  Users, Heart, MessageCircle, Eye,
  TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  UserPlus, Activity, LayoutGrid,
} from "lucide-react";
import {
  fetchAllDashboardData,
  fetchUserGrowth,
  fetchPostGrowth,
  fetchEngagementTrend,
  setUserGrowthPeriod,
  setPostGrowthPeriod,
  setEngagementPeriod,
  selectDashboardStats,
  selectUserGrowth,
  selectPostGrowth,
  selectEngagementTrend,
  selectTopPosts,
  selectHourlyActivity,
  selectLastRefreshed,
  selectGlobalLoading,
} from "../lib/redux/dashboardSlice";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981"];
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const TYPE_BADGE = {
  photo: { label: "Photo", cls: "bg-indigo-100 text-indigo-700" },
  reel:  { label: "Reel",  cls: "bg-amber-100 text-amber-700"  },
  text:  { label: "Text",  cls: "bg-emerald-100 text-emerald-700" },
};

const PERIOD_OPTS_6 = [
  { label: "6M",  value: "6months"  },
  { label: "12M", value: "12months" },
  { label: "30D", value: "30days"   },
];

const ENGAGEMENT_OPTS = [
  { label: "7D",  value: "7days"  },
  { label: "14D", value: "14days" },
  { label: "30D", value: "30days" },
];

const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeTime(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SkeletonBox = memo(function SkeletonBox({ className = "" }) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-xl ${className}`}
      style={{ backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
  );
});

const KPICard = memo(function KPICard({ icon: Icon, label, value, sub, change, accent, loading, index }) {
  const isPositive = change >= 0;
  return (
    <motion.div
      custom={index}
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative overflow-hidden rounded-2xl border shadow-sm p-5 flex items-start gap-4 cursor-default"
      style={{ backgroundColor: accent.bgHex, borderColor: accent.borderHex }}
    >
      {/* Top accent bar with shimmer */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent.bar}`} />

      {/* Decorative background circle */}
      <div
        className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10"
        style={{ backgroundColor: accent.iconBgHex }}
      />

      <motion.div
        whileHover={{ rotate: 10, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400 }}
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 z-10"
        style={{ backgroundColor: accent.iconBgHex }}
      >
        <Icon size={22} className={accent.icon} />
      </motion.div>

      <div className="flex-1 min-w-0 z-10">
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider truncate">{label}</p>
        {loading ? (
          <SkeletonBox className="h-8 w-24 mt-1" />
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none mt-1"
          >
            {fmt(value)}
          </motion.p>
        )}
        {sub && !loading && (
          <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>
        )}
      </div>

      {change != null && !loading && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className={`flex items-center gap-1 text-xs font-bold shrink-0 mt-1 px-2 py-1 rounded-lg z-10
            ${isPositive ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change)}%
        </motion.div>
      )}
    </motion.div>
  );
});

const SectionHeader = memo(function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
        <span className="w-1.5 h-4 rounded-full bg-indigo-400 inline-block" />
        {title}
      </h2>
      {children}
    </div>
  );
});

const PeriodTabs = memo(function PeriodTabs({ value, options, onChange }) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative px-3 py-1 rounded-md text-xs font-semibold transition-all
            ${value === opt.value ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
        >
          {value === opt.value && (
            <motion.span
              layoutId="period-pill"
              className="absolute inset-0 bg-white rounded-md shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{opt.label}</span>
        </button>
      ))}
    </div>
  );
});

const ChartCard = memo(function ChartCard({
  title, loading, error, periodValue, periodOptions, onPeriodChange, height = 220, children, index = 0,
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300"
    >
      <SectionHeader title={title}>
        {periodOptions && (
          <PeriodTabs value={periodValue} options={periodOptions} onChange={onPeriodChange} />
        )}
      </SectionHeader>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" variants={fadeIn} initial="hidden" animate="visible" exit="hidden">
            <SkeletonBox style={{ height }} />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            variants={fadeIn} initial="hidden" animate="visible"
            className="flex items-center justify-center gap-2 text-red-400 text-sm"
            style={{ height }}
          >
            <AlertTriangle size={16} /> Failed to load
          </motion.div>
        ) : (
          <motion.div
            key="chart"
            variants={fadeIn} initial="hidden" animate="visible"
            style={{ height }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {children}
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const CustomTooltip = memo(function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-xs"
    >
      <p className="font-bold text-slate-700 mb-1.5 border-b border-slate-100 pb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 mt-1" style={{ color: p.color }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <b className="text-slate-800">{fmt(p.value)}</b>
        </p>
      ))}
    </motion.div>
  );
});

function buildKpiCards(s) {
  return [
    {
      icon: Users,         label: "Total Users",     value: s?.totalUsers,
      sub: `${fmt(s?.activeToday)} active today`,    change: null,
      accent: { bar: "bg-indigo-400", icon: "text-indigo-500", bgHex: "#fafaff", borderHex: "#e0e0fa", iconBgHex: "#ebebfd" },
    },
    {
      icon: LayoutGrid,    label: "Total Posts",     value: s?.totalPosts,
      sub: null,                                      change: s?.postsChange,
      accent: { bar: "bg-amber-400",  icon: "text-amber-500",  bgHex: "#fffefc", borderHex: "#faefd0", iconBgHex: "#fef5d8" },
    },
    {
      icon: Heart,         label: "Total Likes",     value: s?.totalLikes,
      sub: null,                                      change: null,
      accent: { bar: "bg-rose-400",   icon: "text-rose-500",   bgHex: "#fffafa", borderHex: "#fad8d8", iconBgHex: "#fee2e2" },
    },
    {
      icon: Eye,           label: "Total Views",     value: s?.totalViews,
      sub: null,                                      change: null,
      accent: { bar: "bg-sky-400",    icon: "text-sky-500",    bgHex: "#f8fcff", borderHex: "#d0eefa", iconBgHex: "#ddf2fd" },
    },
    {
      icon: MessageCircle, label: "Total Comments",  value: s?.totalComments,
      sub: null,                                      change: null,
      accent: { bar: "bg-emerald-400",icon: "text-emerald-500",bgHex: "#f7fefb", borderHex: "#c6f0da", iconBgHex: "#d4f7e5" },
    },
    {
      icon: Activity,      label: "Active Today",    value: s?.activeToday,
      sub: null,                                      change: null,
      accent: { bar: "bg-violet-400", icon: "text-violet-500", bgHex: "#fcfaff", borderHex: "#e4d9fc", iconBgHex: "#ede5fd" },
    },
    {
      icon: UserPlus,      label: "New Signups",     value: s?.newSignups,
      sub: "this month",                             change: s?.newSignupsChange,
      accent: { bar: "bg-teal-400",   icon: "text-teal-500",   bgHex: "#f7fefe", borderHex: "#c0f0e8", iconBgHex: "#d0f7f0" },
    },
    {
      icon: AlertTriangle, label: "Pending Reports", value: s?.pendingReports,
      sub: null,                                      change: null,
      accent: { bar: "bg-red-400",    icon: "text-red-500",    bgHex: "#fffcfc", borderHex: "#facaca", iconBgHex: "#fee0e0" },
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const dispatch = useDispatch();

  const stats       = useSelector(selectDashboardStats);
  const userGrowth  = useSelector(selectUserGrowth);
  const postGrowth  = useSelector(selectPostGrowth);
  const engagement  = useSelector(selectEngagementTrend);
  const topPosts    = useSelector(selectTopPosts);
  const hourly      = useSelector(selectHourlyActivity);
  const lastRefresh = useSelector(selectLastRefreshed);
  const globalLoad  = useSelector(selectGlobalLoading);

  const s = stats.data;

  useEffect(() => {
    dispatch(fetchAllDashboardData());
    const id = setInterval(() => dispatch(fetchAllDashboardData()), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  useEffect(() => {
    const handler = (payload) => {
      if (payload.type !== "admin_new_comment") return;
      dispatch(fetchAllDashboardData());
    };
    const sock = getAdminSocket();
    if (sock?.connected) {
      sock.on("admin:notification", handler);
      return () => sock.off("admin:notification", handler);
    }
    const unsubscribe = onAdminSocketReady((readySocket) => {
      readySocket.on("admin:notification", handler);
    });
    return () => {
      unsubscribe();
      getAdminSocket()?.off("admin:notification", handler);
    };
  }, [dispatch]);

  const handleUserPeriod = useCallback((p) => {
    dispatch(setUserGrowthPeriod(p));
    dispatch(fetchUserGrowth({ period: p }));
  }, [dispatch]);

  const handlePostPeriod = useCallback((p) => {
    dispatch(setPostGrowthPeriod(p));
    dispatch(fetchPostGrowth({ period: p }));
  }, [dispatch]);

  const handleEngagementPeriod = useCallback((p) => {
    dispatch(setEngagementPeriod(p));
    dispatch(fetchEngagementTrend({ period: p }));
  }, [dispatch]);

  const postTypeDonut = useMemo(() => {
    const totals = { photo: 0, reel: 0, text: 0 };
    postGrowth.data.forEach((d) => {
      totals.photo += d.photo ?? 0;
      totals.reel  += d.reel  ?? 0;
      totals.text  += d.text  ?? 0;
    });
    return [
      { name: "Photos", value: totals.photo },
      { name: "Reels",  value: totals.reel  },
      { name: "Text",   value: totals.text  },
    ];
  }, [postGrowth.data]);

  const kpiCards = useMemo(() => buildKpiCards(s), [s]);

  const lastRefreshedLabel = useMemo(
    () => (lastRefresh ? `Last updated ${relativeTime(lastRefresh)}` : "Loading data…"),
    [lastRefresh],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-50">

      {/* Subtle background grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

        {/* ── Header ── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight"
            >
              Dashboard
              <span className="ml-2 text-indigo-400">✦</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {lastRefreshedLabel}
            </motion.p>
          </div>

          <motion.button
            type="button"
            onClick={() => dispatch(fetchAllDashboardData())}
            disabled={globalLoad}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-semibold shadow-md shadow-indigo-200 transition-colors
              disabled:opacity-60 self-start sm:self-auto"
          >
            <RefreshCw size={15} className={globalLoad ? "animate-spin" : ""} />
            Refresh
          </motion.button>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <KPICard key={card.label} {...card} index={i} loading={stats.loading || !s} />
          ))}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="User Growth"
            loading={userGrowth.loading}
            error={userGrowth.error}
            periodValue={userGrowth.period}
            periodOptions={PERIOD_OPTS_6}
            onPeriodChange={handleUserPeriod}
            height={220}
            index={0}
          >
            <AreaChart data={userGrowth.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="totalUsers" name="Total Users" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradTotal)" dot={false} activeDot={{ r: 5, fill: "#6366f1" }} />
              <Area type="monotone" dataKey="newUsers"   name="New Users"   stroke="#10b981" strokeWidth={2.5} fill="url(#gradNew)"   dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
            </AreaChart>
          </ChartCard>

          <ChartCard
            title="Post Type Distribution"
            loading={postGrowth.loading}
            error={postGrowth.error}
            height={220}
            index={1}
          >
            <PieChart>
              <Pie
                data={postTypeDonut}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                animationBegin={200}
                animationDuration={800}
              >
                {postTypeDonut.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend
                formatter={(val, entry) => (
                  <span className="text-xs text-slate-600">{val} ({fmt(entry.payload.value)})</span>
                )}
              />
            </PieChart>
          </ChartCard>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Post Growth (by Type)"
            loading={postGrowth.loading}
            error={postGrowth.error}
            periodValue={postGrowth.period}
            periodOptions={PERIOD_OPTS_6}
            onPeriodChange={handlePostPeriod}
            height={220}
            index={0}
          >
            <BarChart data={postGrowth.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="photo" name="Photos" stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
              <Bar dataKey="reel"  name="Reels"  stackId="a" fill="#f59e0b" />
              <Bar dataKey="text"  name="Text"   stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ChartCard>

          <ChartCard
            title="Engagement Trend"
            loading={engagement.loading}
            error={engagement.error}
            periodValue={engagement.period}
            periodOptions={ENGAGEMENT_OPTS}
            onPeriodChange={handleEngagementPeriod}
            height={220}
            index={1}
          >
            <LineChart data={engagement.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="likes"    name="Likes"    stroke="#f43f5e" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="comments" name="Comments" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="views"    name="Views"    stroke="#0ea5e9" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartCard>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <ChartCard
              title="Hourly Active Users (24h)"
              loading={hourly.loading}
              error={hourly.error}
              height={180}
              index={0}
            >
              <AreaChart data={hourly.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHourly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="users" name="Active Users" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gradHourly)" dot={false} activeDot={{ r: 5, fill: "#f59e0b" }} />
              </AreaChart>
            </ChartCard>
          </div>

          {/* Top Posts Table */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
            className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300"
          >
            <SectionHeader title="Top Posts" />
            {topPosts.loading ? (
              <div className="space-y-3">
                {SKELETON_ROWS.map((i) => <SkeletonBox key={i} className="h-10 w-full" />)}
              </div>
            ) : topPosts.error ? (
              <p className="text-sm text-red-400 flex gap-2 items-center">
                <AlertTriangle size={14} /> Failed to load
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="pb-2 font-semibold">Post</th>
                      <th className="pb-2 font-semibold hidden sm:table-cell">Author</th>
                      <th className="pb-2 font-semibold text-right"><Eye size={12} className="inline" /></th>
                      <th className="pb-2 font-semibold text-right"><Heart size={12} className="inline" /></th>
                      <th className="pb-2 font-semibold text-right hidden sm:table-cell">
                        <MessageCircle size={12} className="inline" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {topPosts.data.map((post, i) => {
                      const badge = TYPE_BADGE[post.type] ?? TYPE_BADGE.text;
                      return (
                        <motion.tr
                          key={post._id}
                          custom={i}
                          variants={fadeUp}
                          initial="hidden"
                          animate="visible"
                          whileHover={{ backgroundColor: "#f8fafc" }}
                          className="transition-colors cursor-default"
                        >
                          <td className="py-2.5 pr-3 max-w-40">
                            <p className="font-medium text-slate-700 truncate">{post.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 hidden sm:table-cell text-slate-400 text-xs">
                            @{post.author}
                          </td>
                          <td className="py-2.5 text-right text-slate-600 font-semibold">{fmt(post.views)}</td>
                          <td className="py-2.5 text-right text-slate-600 font-semibold">{fmt(post.likes)}</td>
                          <td className="py-2.5 text-right text-slate-600 font-semibold hidden sm:table-cell">
                            {fmt(post.comments)}
                          </td>
                        </motion.tr>
                      );
                    })}
                    {topPosts.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-300 text-sm">
                          No posts yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}