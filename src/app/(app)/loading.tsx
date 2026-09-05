export default function AppLoading() {
  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="flex justify-between items-end pb-2">
        <div className="space-y-2">
          <div className="h-3 w-28 bg-elevated rounded animate-pulse" />
          <div className="h-8 w-56 bg-elevated rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-elevated rounded-xl animate-pulse" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-elevated animate-pulse" />
            <div className="h-6 w-32 bg-elevated rounded animate-pulse" />
            <div className="h-3 w-20 bg-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="card p-6 space-y-4">
        <div className="h-5 w-44 bg-elevated rounded animate-pulse" />
        <div className="h-64 w-full bg-elevated/40 rounded-xl animate-pulse" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 card p-6 space-y-4">
          <div className="h-5 w-40 bg-elevated rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full bg-elevated/40 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 card p-6 space-y-4">
          <div className="h-5 w-32 bg-elevated rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 w-full bg-elevated/40 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
