import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { playGame } from "@/server/game.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKES, cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/game")({
  component: () => <AppShell><Game /></AppShell>,
  head: () => ({ meta: [{ title: "Play — Pesa Cups" }] }),
});

function Game() {
  const { user } = useAuth();
  const play = useServerFn(playGame);
  const [bet, setBet] = useState(50);
  const [cups, setCups] = useState(3);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [order, setOrder] = useState<number[]>([1, 2, 3]);
  const [reveal, setReveal] = useState<{ winning: number; won: boolean; payout: number } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).single();
    setBalance(data ? Number(data.balance) : 0);
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  // keep order array length in sync with cups
  useEffect(() => {
    setOrder(Array.from({ length: cups }, (_, i) => i + 1));
  }, [cups]);

  const multiplier = (cups * 0.9).toFixed(2);

  const shuffleOnce = (arr: number[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const handlePlay = async () => {
    if (!picked) { toast.error("Pick a cup first"); return; }
    if (bet <= 0) { toast.error("Enter a valid bet"); return; }
    setBusy(true); setReveal(null); setShuffling(true);

    // Animate shuffles for ~2.4s
    const shuffleInterval = setInterval(() => {
      setOrder((prev) => shuffleOnce(prev));
    }, 400);

    try {
      const res = await play({ data: { bet, cups, picked } });
      setTimeout(() => {
        clearInterval(shuffleInterval);
        // settle to natural order so the picked number aligns with reveal
        setOrder(Array.from({ length: cups }, (_, i) => i + 1));
        setShuffling(false);
        setReveal({ winning: res.winningCup, won: res.won, payout: res.payout });
        setBalance(res.newBalance);
        if (res.won) toast.success(`You won ${formatKES(res.payout)}! 🎉`);
        else toast.error(`The cup was #${res.winningCup}. Try again!`);
        setBusy(false);
      }, 2400);
    } catch (e) {
      clearInterval(shuffleInterval);
      setShuffling(false);
      toast.error(e instanceof Error ? e.message : "Play failed");
      setBusy(false);
    }
  };

  const reset = () => {
    setPicked(null);
    setReveal(null);
    setOrder(Array.from({ length: cups }, (_, i) => i + 1));
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <Card className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Pick the lucky cup</h1>
            <p className="text-sm text-muted-foreground">One cup hides the prize. Choose wisely.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="font-bold">{balance === null ? "…" : formatKES(balance)}</p>
          </div>
        </div>

        <div className={cn("grid gap-4 justify-center", cups <= 4 ? "grid-cols-3" : cups <= 6 ? "grid-cols-3 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4")}>
          {Array.from({ length: cups }, (_, i) => i + 1).map((n) => {
            const pos = order.indexOf(n);
            const isPicked = picked === n;
            const isWinning = reveal?.winning === n;
            const isLost = reveal && !reveal.won && isPicked;
            return (
              <button
                key={n}
                disabled={busy || !!reveal}
                onClick={() => setPicked(n)}
                style={{
                  order: pos,
                  transition: "transform 380ms cubic-bezier(.4,.2,.2,1), border-color 200ms, background 200ms",
                  ...(!reveal && !isPicked ? { background: "var(--gradient-card)" } : {}),
                }}
                className={cn(
                  "aspect-square rounded-3xl border-2 flex items-center justify-center text-5xl relative overflow-hidden",
                  "hover:scale-105 disabled:hover:scale-100",
                  isPicked && !reveal && !shuffling && "border-primary scale-105",
                  !isPicked && !reveal && "border-border hover:border-primary/50",
                  reveal && isWinning && "border-success bg-success/10",
                  isLost && "border-destructive bg-destructive/10",
                  reveal && !isWinning && !isLost && "opacity-30",
                )}
              >
                <span className={cn("transition-transform", shuffling && "animate-bounce")}>
                  {reveal && isWinning ? "💰" : "🥤"}
                </span>
                {!shuffling && (
                  <span className="absolute bottom-2 right-3 text-xs font-bold text-muted-foreground">#{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {shuffling && (
          <p className="mt-6 text-center text-sm text-muted-foreground animate-pulse">Shuffling cups… keep your eye on it 👀</p>
        )}

        {reveal && (
          <div className="mt-6 text-center">
            <p className={cn("text-2xl font-black", reveal.won ? "text-success" : "text-destructive")}>
              {reveal.won ? `🎉 You won ${formatKES(reveal.payout)}!` : `😢 Better luck next time`}
            </p>
            <Button onClick={reset} className="mt-4">Play again</Button>
          </div>
        )}
      </Card>

      <Card className="p-6 space-y-5 h-fit">
        <div>
          <Label>Bet amount (KES)</Label>
          <Input type="number" min={1} value={bet} onChange={(e) => setBet(Number(e.target.value))} disabled={busy || !!reveal} />
          <div className="flex gap-2 mt-2">
            {[10, 50, 100, 500].map((v) => (
              <Button key={v} variant="outline" size="sm" onClick={() => setBet(v)} disabled={busy || !!reveal}>{v}</Button>
            ))}
          </div>
        </div>

        <div>
          <Label>Number of cups</Label>
          <div className="grid grid-cols-7 gap-1.5 mt-2">
            {[3, 4, 5, 6, 7, 8, 9].map((n) => (
              <Button
                key={n}
                type="button"
                variant={cups === n ? "default" : "outline"}
                size="sm"
                onClick={() => { setCups(n); setPicked(null); }}
                disabled={busy || !!reveal}
                className="h-10 px-0"
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Multiplier</span><span className="font-bold">{multiplier}×</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Win chance</span><span className="font-bold">{(100 / cups).toFixed(1)}%</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-muted-foreground">Potential win</span><span className="font-bold text-primary">{formatKES(bet * Number(multiplier))}</span></div>
        </div>

        <Button onClick={handlePlay} disabled={busy || !!reveal || !picked} className="w-full h-12 text-base" style={{ boxShadow: "var(--shadow-glow)" }}>
          {busy ? "Revealing…" : reveal ? "Round done" : picked ? `Play KES ${bet}` : "Pick a cup"}
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">Provably fair · 10% house edge · Demo money</p>
      </Card>
    </div>
  );
}
