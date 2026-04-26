import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: () => <AppShell><Dashboard /></AppShell>,
  head: () => ({ meta: [{ title: "Dashboard — Pesa Cups" }] }),
});

function Dashboard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; bet_amount: number; cups: number; won: boolean; payout: number; created_at: string }>>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("wallets").select("balance").eq("user_id", user.id).single()
      .then(({ data }) => setBalance(data ? Number(data.balance) : 0));
    supabase.from("games").select("id,bet_amount,cups,won,payout,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setRecent(data ?? []));
  }, [user]);

  return (
    <div className="space-y-6">
      <Card className="p-8" style={{ background: "var(--gradient-hero)" }}>
        <p className="text-sm font-medium text-primary-foreground/80">Wallet balance</p>
        <p className="text-5xl font-black mt-2 text-primary-foreground">
          {balance === null ? "…" : formatKES(balance)}
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/game"><Button size="lg" variant="secondary">Play now</Button></Link>
          <Link to="/wallet"><Button size="lg" variant="outline" className="bg-background/10 border-background/30 text-primary-foreground hover:bg-background/20">Wallet</Button></Link>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-bold text-lg mb-4">Recent games</h2>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">No games yet — go win some pesa.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((g) => (
              <div key={g.id} className="py-3 flex items-center justify-between text-sm">
                <span>{g.cups} cups · bet {formatKES(g.bet_amount)}</span>
                <span className={g.won ? "text-success font-bold" : "text-destructive"}>
                  {g.won ? `+${formatKES(g.payout)}` : `-${formatKES(g.bet_amount)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
