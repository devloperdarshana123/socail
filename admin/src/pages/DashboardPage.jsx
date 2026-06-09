
import { useEffect, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Users, FileImage, Film, FileText, Heart, MessageCircle,
  Eye, TrendingUp, TrendingDown, RefreshCw, AlertTriangle,
  UserPlus, Activity, LayoutGrid, Image, ChevronRight,
  Clock, Zap, BarChart2,
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

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981"];
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const TYPE_BADGE = {
  photo: { label: "Photo", cls: "bg-indigo-100 text-indigo-700" },
  reel:  { label: "Reel",  cls: "bg-amber-100 text-amber-700" },
  text:  { label: "Text",  cls: "bg-emerald-100 text-emerald-700" },
};

const fmt = (n) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const relativeTime = (iso) => {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

function SkeletonBox({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

function KPICard({ icon: Icon, label, value, sub, change, accent, loading }) {
  const isPositive = change >= 0;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border shadow-sm
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-5 flex items-start gap-4 "
      style={{ backgroundColor: accent.bgHex, borderColor: accent.borderHex }}
    >
      <div className={`absolute top-0 left-0 right-0 h-1 ${accent.bar}`} />
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent.iconBgHex }}>
        <Icon size={22} className={accent.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider truncate">{label}</p>
        {loading ? (
          <SkeletonBox className="h-8 w-24 mt-1" />
        ) : (
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-none mt-1">{fmt(value)}</p>
        )}
        {sub && !loading && (
          <p className="text-[11px] text-slate-500 mt-1 truncate">{sub}</p>
        )}
      </div>
      {change != null && !loading && (
        <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 mt-1
          ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
          {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function PeriodTabs({ value, options, onChange }) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all
            ${value === opt.value
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ChartCard({ title, loading, error, periodValue, periodOptions, onPeriodChange, height = 220, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <SectionHeader title={title}>
        {periodOptions && (
          <PeriodTabs value={periodValue} options={periodOptions} onChange={onPeriodChange} />
        )}
      </SectionHeader>
      {loading ? (
        <SkeletonBox style={{ height }} />
      ) : error ? (
        <div className="flex items-center justify-center gap-2 text-red-400 text-sm" style={{ height }}>
          <AlertTriangle size={16} /> Failed to load
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <b>{fmt(p.value)}</b>
        </p>
      ))}
    </div>
  );
};

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

  const postTypeDonut = (() => {
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
  })();

  // ── Lighter card backgrounds using inline hex colors ──
  // bgHex: very pale tint  |  borderHex: faint border  |  iconBgHex: slightly deeper tint for icon
  const kpiCards = [
    {
      icon: Users, label: "Total Users", value: s?.totalUsers,
      sub: `${fmt(s?.activeToday)} active today`, change: null,
      accent: { bar: "bg-indigo-400", icon: "text-indigo-500", bgHex: "#fafaff", borderHex: "#e0e0fa", iconBgHex: "#ebebfd" },
    },
    {
      icon: LayoutGrid, label: "Total Posts", value: s?.totalPosts,
      sub: null, change: s?.postsChange,
      accent: { bar: "bg-amber-400", icon: "text-amber-500", bgHex: "#fffefc", borderHex: "#faefd0", iconBgHex: "#fef5d8" },
    },
    {
      icon: Heart, label: "Total Likes", value: s?.totalLikes,
      sub: null, change: null,
      accent: { bar: "bg-rose-400", icon: "text-rose-500", bgHex: "#fffafa", borderHex: "#fad8d8", iconBgHex: "#fee2e2" },
    },
    {
      icon: Eye, label: "Total Views", value: s?.totalViews,
      sub: null, change: null,
      accent: { bar: "bg-sky-400", icon: "text-sky-500", bgHex: "#f8fcff", borderHex: "#d0eefa", iconBgHex: "#ddf2fd" },
    },
    {
      icon: MessageCircle, label: "Total Comments", value: s?.totalComments,
      sub: null, change: null,
      accent: { bar: "bg-emerald-400", icon: "text-emerald-500", bgHex: "#f7fefb", borderHex: "#c6f0da", iconBgHex: "#d4f7e5" },
    },
    {
      icon: Activity, label: "Active Today", value: s?.activeToday,
      sub: null, change: null,
      accent: { bar: "bg-violet-400", icon: "text-violet-500", bgHex: "#fcfaff", borderHex: "#e4d9fc", iconBgHex: "#ede5fd" },
    },
    {
      icon: UserPlus, label: "New Signups", value: s?.newSignups,
      sub: "this month", change: s?.newSignupsChange,
      accent: { bar: "bg-teal-400", icon: "text-teal-500", bgHex: "#f7fefe", borderHex: "#c0f0e8", iconBgHex: "#d0f7f0" },
    },
    {
      icon: AlertTriangle, label: "Pending Reports", value: s?.pendingReports,
      sub: null, change: null,
      accent: { bar: "bg-red-400", icon: "text-red-500", bgHex: "#fffcfc", borderHex: "#facaca", iconBgHex: "#fee0e0" },
    },
  ];

  const periodOpts6 = [
    { label: "6M",  value: "6months"  },
    { label: "12M", value: "12months" },
    { label: "30D", value: "30days"   },
  ];

  const engagementOpts = [
    { label: "7D",  value: "7days"  },
    { label: "14D", value: "14days" },
    { label: "30D", value: "30days" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-1 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {lastRefresh ? `Last updated ${relativeTime(lastRefresh)}` : "Loading data…"}
            </p>
          </div>
          <button
            onClick={() => dispatch(fetchAllDashboardData())}
            disabled={globalLoad}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700
              text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-60 self-start sm:self-auto"
          >
            <RefreshCw size={15} className={globalLoad ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map((card) => (
            <KPICard key={card.label} {...card} loading={stats.loading || !s} />
          ))}
        </div>

        {/* ── Charts Row 1 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="User Growth" loading={userGrowth.loading} error={userGrowth.error}
            periodValue={userGrowth.period} periodOptions={periodOpts6} onPeriodChange={handleUserPeriod} height={220}>
            <AreaChart data={userGrowth.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                </linearGradient>
                <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="totalUsers" name="Total Users" stroke="#6366f1" strokeWidth={2} fill="url(#gradTotal)" dot={false} />
              <Area type="monotone" dataKey="newUsers"   name="New Users"   stroke="#10b981" strokeWidth={2} fill="url(#gradNew)"   dot={false} />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Post Type Distribution" loading={postGrowth.loading} error={postGrowth.error} height={220}>
            <PieChart>
              <Pie data={postTypeDonut} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {postTypeDonut.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend formatter={(val, entry) => (
                <span className="text-xs text-slate-600">{val} ({fmt(entry.payload.value)})</span>
              )} />
            </PieChart>
          </ChartCard>
        </div>

        {/* ── Charts Row 2 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Post Growth (by Type)" loading={postGrowth.loading} error={postGrowth.error}
            periodValue={postGrowth.period} periodOptions={periodOpts6} onPeriodChange={handlePostPeriod} height={220}>
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

          <ChartCard title="Engagement Trend" loading={engagement.loading} error={engagement.error}
            periodValue={engagement.period} periodOptions={engagementOpts} onPeriodChange={handleEngagementPeriod} height={220}>
            <LineChart data={engagement.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="likes"    name="Likes"    stroke="#f43f5e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comments" name="Comments" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="views"    name="Views"    stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <ChartCard title="Hourly Active Users (24h)" loading={hourly.loading} error={hourly.error} height={180}>
              <AreaChart data={hourly.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradHourly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="users" name="Active Users" stroke="#f59e0b" strokeWidth={2} fill="url(#gradHourly)" dot={false} />
              </AreaChart>
            </ChartCard>
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <SectionHeader title="Top Posts" />
            {topPosts.loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <SkeletonBox key={i} className="h-10 w-full" />)}
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
                    {topPosts.data.map((post) => {
                      const badge = TYPE_BADGE[post.type] ?? TYPE_BADGE.text;
                      return (
                        <tr key={post._id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-3 max-w-40">
                            <p className="font-medium text-slate-700 truncate">{post.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 hidden sm:table-cell text-slate-500 text-xs">
                            @{post.author}
                          </td>
                          <td className="py-2.5 text-right text-slate-600 font-medium">{fmt(post.views)}</td>
                          <td className="py-2.5 text-right text-slate-600 font-medium">{fmt(post.likes)}</td>
                          <td className="py-2.5 text-right text-slate-600 font-medium hidden sm:table-cell">
                            {fmt(post.comments)}
                          </td>
                        </tr>
                      );
                    })}
                    {topPosts.data.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">No posts yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}