// Re-mounts on every navigation inside the console, giving each page a
// smooth entrance transition without touching any page logic.
export default function ConsoleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
