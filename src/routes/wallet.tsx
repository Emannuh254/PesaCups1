import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { mockDeposit, requestWithdrawal } from "@/server/wallet.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKES } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  component: () => <AppShell><Wallet /></AppShell>,
  head: () => ({ meta: [{ title: "Wallet — Pesa Cups" }] }),
});

type Tx = { id: string; type: string; amount: number; status: string; created_at: string };

function Wallet() {
  const { user } = useAuth();
  const deposit = useServerFn(mockDeposit);
  const withdraw = useServerFn(requestWithdrawal);
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [depAmt, setDepAmt] = useState(500);
  const [wAmt, setWAmt] = useState(100); const [wPhone, setWPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    setBalance(w ? Number(w.balance) : 0);
    const { data: t } = await supabase.from("transactions").select("id,type,amount,status,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setTxs((t ?? []) as Tx[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const onDeposit = async () => {
    setBusy(true);
    try { const r = await deposit({ data: { amount: depAmt } }); setBalance(r.newBalance); toast.success(`Deposited ${formatKES(depAmt)} (mock MegaPay)`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const onWithdraw = async () => {
    if (!wPhone) { toast.error("Enter phone number"); return; }
    setBusy(true);
    try { await withdraw({ data: { amount: wAmt, phone: wPhone } }); toast.success("Withdrawal requested — pending admin approval"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
      <div className="space-y-6">
        <Card className="p-6" style={{ background: "var(--gradient-hero)" }}>
          <p className="text-sm text-primary-foreground/80">Balance</p>
          <p className="text-4xl font-black text-primary-foreground">{balance === null ? "…" : formatKES(balance)}</p>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-bold">Deposit (MegaPay — mock)</h2>
          <p className="text-xs text-muted-foreground">Real MegaPay STK Push integration is scaffolded but not wired. This auto-credits for testing.</p>
          <Label>Amount (KES)</Label>
          <Input type="number" min={1} value={depAmt} onChange={(e) => setDepAmt(Number(e.target.value))} />
          <Button onClick={onDeposit} disabled={busy} className="w-full">Deposit</Button>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-bold">Withdraw</h2>
          <Label>Amount (KES)</Label>
          <Input type="number" min={1} value={wAmt} onChange={(e) => setWAmt(Number(e.target.value))} />
          <Label>M-Pesa phone</Label>
          <Input value={wPhone} onChange={(e) => setWPhone(e.target.value)} placeholder="2547XXXXXXXX" />
          <Button onClick={onWithdraw} disabled={busy} variant="outline" className="w-full">Request withdrawal</Button>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-bold mb-4">Transaction history</h2>
        {txs.length === 0 ? <p className="text-muted-foreground text-sm">No transactions yet.</p> : (
          <div className="divide-y divide-border">
            {txs.map((t) => (
              <div key={t.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium capitalize">{t.type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} · {t.status}</p>
                </div>
                <span className={Number(t.amount) >= 0 ? "text-success font-bold" : "text-destructive"}>
                  {Number(t.amount) >= 0 ? "+" : ""}{formatKES(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
