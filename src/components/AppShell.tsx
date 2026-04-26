import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-base" style={{ background: "var(--gradient-hero)" }}>🥤</div>
            <span className="font-extrabold">Pesa<span className="text-primary">Cups</span></span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/dashboard"><Button variant="ghost" size="sm">Home</Button></Link>
            <Link to="/game"><Button variant="ghost" size="sm">Play</Button></Link>
            <Link to="/wallet"><Button variant="ghost" size="sm">Wallet</Button></Link>
            <Link to="/admin"><Button variant="ghost" size="sm">Admin</Button></Link>
            <Button variant="outline" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>Sign out</Button>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
