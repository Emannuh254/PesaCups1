import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminResolveWithdrawal } from "@/server/wallet.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKES } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: () => <AppShell><Admin /></AppShell>,
  head: () => ({ meta: [{ title: "Admin — Pesa Cups" }] }),
});

type WD = { id: string; user_id: string; amount: number; phone: string; status: string; created_at: string };

function Admin() {
  const { user } = useAuth();
  const resolve = useServerFn(adminResolveWithdrawal);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<WD[]>([]);
  const [stats, setStats] = useState<{ users: number; games: number; pendingWD: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    const { data: wd } = await supabase.from("withdrawals").select("*").eq("status", "pending").order("created_at", { ascending: false });
    setPending((wd ?? []) as WD[]);
    const [{ count: users }, { count: games }, { count: pendingWD }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("games").select("*", { count: "exact", head: true }),
      supabase.from("withdrawals").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setStats({ users: users ?? 0, games: games ?? 0, pendingWD: pendingWD ?? 0 });
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const act = async (id: string, approve: boolean) => {
    try { await resolve({ data: { id, approve } }); toast.success(approve ? "Approved" : "Rejected & refunded"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  if (isAdmin === null) return <p className="text-muted-foreground">Checking access…</p>;
  if (!isAdmin) return (
    <Card className="p-8 text-center">
      <h1 className="text-xl font-bold">Admin only</h1>
      <p className="text-muted-foreground mt-2">Your account doesn't have admin access.</p>
      <p className="text-xs text-muted-foreground mt-4 font-mono break-all">Your user id: {user?.id}</p>
      <p className="text-xs text-muted-foreground mt-2">Run this SQL once to grant yourself admin:<br /><code className="text-primary">insert into user_roles(user_id, role) values ('{user?.id}', 'admin');</code></p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {stats && [
          { l: "Total users", v: stats.users },
          { l: "Games played", v: stats.games },
          { l: "Pending withdrawals", v: stats.pendingWD },
        ].map(s => (
          <Card key={s.l} className="p-5">
            <p className="text-sm text-muted-foreground">{s.l}</p>
            <p className="text-3xl font-black mt-1">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="font-bold mb-4">Pending withdrawals</h2>
        {pending.length === 0 ? <p className="text-muted-foreground text-sm">Nothing pending.</p> : (
          <div className="divide-y divide-border">
            {pending.map((w) => (
              <div key={w.id} className="py-4 flex items-center justify-between gap-4">
                <div className="text-sm">
                  <p className="font-bold">{formatKES(w.amount)} → {w.phone}</p>
                  <p className="text-xs text-muted-foreground font-mono">user {w.user_id.slice(0, 8)}… · {new Date(w.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => act(w.id, true)}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => act(w.id, false)}>Reject & refund</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
