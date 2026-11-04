// Wraps every dashboard page so it eases in when opened (a template re-mounts
// on each navigation, unlike a layout).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
