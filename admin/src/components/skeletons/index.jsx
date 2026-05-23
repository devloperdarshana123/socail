// ── Base pulse block ──────────────────────────────────────────
function Pulse({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}

// ── UserDetail Page Skeleton ──────────────────────────────────
export function UserDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Pulse className="h-3 w-10 rounded-full" />
          <Pulse className="h-3 w-3 rounded-full" />
          <Pulse className="h-3 w-28 rounded-full" />
        </div>

        {/* Profile card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-5">
            <Pulse className="w-[72px] h-[72px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2.5">
              <div className="flex items-center gap-2">
                <Pulse className="h-5 w-36 rounded-full" />
                <Pulse className="h-5 w-16 rounded-full" />
                <Pulse className="h-5 w-12 rounded-full" />
              </div>
              <Pulse className="h-3.5 w-24 rounded-full" />
              <Pulse className="h-3.5 w-44 rounded-full" />
              <div className="flex gap-4">
                <Pulse className="h-3 w-28 rounded-full" />
                <Pulse className="h-3 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex flex-row sm:flex-col gap-2 shrink-0">
              <Pulse className="h-8 w-28 rounded-xl" />
              <Pulse className="h-8 w-28 rounded-xl" />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-100">
                <Pulse className="h-6 w-12 rounded-full mx-auto" />
                <Pulse className="h-3 w-16 rounded-full mx-auto mt-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Posts section */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="space-y-1.5">
              <Pulse className="h-4 w-12 rounded-full" />
              <Pulse className="h-3 w-32 rounded-full" />
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-slate-200 animate-pulse"
                  style={{ paddingBottom: "100%", height: 0 }} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── UsersPage Table Skeleton ──────────────────────────────────
export function UsersTableSkeleton() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {[...Array(8)].map((__, j) => (
            <td key={j} className="px-4 py-4">
              <Pulse className="h-4 rounded-full animate-pulse"
                style={{ width: `${60 + (j * 13) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Dashboard KPI Skeleton ────────────────────────────────────
export function DashboardKPISkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 flex items-start gap-4">
          <Pulse className="w-11 h-11 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-3 w-20 rounded-full" />
            <Pulse className="h-8 w-24 rounded-xl" />
            <Pulse className="h-2.5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Posts Grid Skeleton ───────────────────────────────────────
export function PostsGridSkeleton({ count = 18 }) {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
      {[...Array(count)].map((_, i) => (
        <div key={i}>
          <div className="aspect-square rounded-xl sm:rounded-2xl bg-slate-200 animate-pulse" />
          <Pulse className="mt-1.5 h-2.5 rounded-full w-3/4" />
        </div>
      ))}
    </div>
  );
}

// ── Generic Page Skeleton (fallback) ─────────────────────────
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-4">
      <Pulse className="h-8 w-48 rounded-xl" />
      <Pulse className="h-4 w-72 rounded-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {[...Array(4)].map((_, i) => <Pulse key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Pulse className="h-64 rounded-2xl mt-4" />
    </div>
  );
}