/* Remounts on every admin navigation so the route-enter transition plays.
   Server component — adds zero client JS. */

export default function AdminTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
