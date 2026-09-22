export default function OpsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="floor-os">
      <div className="fp-skel h-7 w-48" />
      <div className="fp-skel mt-3 h-4 w-64" />
      <div className="mt-6 grid grid-cols-2 border-y border-[var(--fp-line)] sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="fp-skel m-3 h-12" />)}
      </div>
      <div className="fp-skel mt-6 h-16" />
      <div className="fp-skel mt-2 h-16" />
    </div>
  );
}
