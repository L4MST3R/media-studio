import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Images" },
  { to: "/video", label: "Video" },
  { to: "/speech", label: "Speech" },
  { to: "/templates", label: "Templates" },
  { to: "/library", label: "Library" },
] as const;

/** The app's pages, in the AppShell bar. */
export function AppNav() {
  return (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.to === "/", includeSearch: false }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "text-foreground font-medium" }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
