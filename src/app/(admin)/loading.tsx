/* Shown instantly while an admin route loads — same skeleton system as the
   ops shell, so sidebar page switches never flash a blank content area. */

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="staff-page">
      <div>
        <div className="skeleton-soft h-4 w-32 rounded-md" />
        <div className="skeleton-soft mt-2 h-8 w-56 rounded-xl" />
        <div className="skeleton-soft mt-2 h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border bg-card px-4 py-3.5">
            <div className="skeleton-soft h-7 w-16 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
            <div className="skeleton-soft mt-2 h-3.5 w-24 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
          </div>
        ))}
      </div>
      <div className="skeleton-soft h-[280px] rounded-2xl" />
    </div>
  );
}
