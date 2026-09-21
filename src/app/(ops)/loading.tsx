/* Shown instantly while an ops route loads — same skeleton system as the app. */

export default function OpsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="staff-page">
      <div>
        <div className="skeleton-soft h-4 w-32 rounded-md" />
        <div className="skeleton-soft mt-2 h-8 w-56 rounded-xl" />
        <div className="skeleton-soft mt-2 h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[#e8dfd6] bg-white px-4 py-3.5">
            <div className="skeleton-soft h-7 w-12 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
            <div className="skeleton-soft mt-2 h-3.5 w-24 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#e8dfd6] bg-white p-5">
        <div className="skeleton-soft h-5 w-44 rounded-md" />
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-soft h-[72px] rounded-2xl" style={{ animationDelay: `${i * 130}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
