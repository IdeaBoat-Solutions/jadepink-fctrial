/* Shown instantly while an admin route loads. */

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="staff-page">
      <div>
        <div className="skeleton-soft h-4 w-40 rounded-md" />
        <div className="skeleton-soft mt-2 h-8 w-56 rounded-xl" />
        <div className="skeleton-soft mt-2 h-4 w-80 max-w-full rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border bg-card p-4">
            <div className="skeleton-soft h-3.5 w-24 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
            <div className="skeleton-soft mt-2 h-7 w-20 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-4">
          <div className="skeleton-soft h-5 w-36 rounded-md" />
          <div className="skeleton-soft mt-3 h-[240px] rounded-xl" />
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="skeleton-soft h-5 w-28 rounded-md" />
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-soft h-[52px] rounded-xl" style={{ animationDelay: `${i * 130}ms` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
