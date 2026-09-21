/* Remounts on every ops navigation so the route-enter transition plays.
   Server component — adds zero client JS. */

export default function OpsTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
