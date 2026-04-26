import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Pesa Cups — Pick. Win. Cash out." },
      { name: "description", content: "Pesa Cups is a fast, transparent cup-pick game. Choose your cups, place a bet, and win up to 8.1× your stake." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-xl"
               style={{ background: "var(--gradient-hero)" }}>🥤</div>
          <span className="text-xl font-extrabold tracking-tight">Pesa<span className="text-primary">Cups</span></span>
        </Link>
        <div className="flex gap-2">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started</Button></Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-12 pb-24">
        <section className="text-center max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-semibold mb-6 uppercase tracking-wider">
            Demo / Play money — no real cash
          </span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            Pick the cup.<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>
              Take the pesa.
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Choose 3 to 9 cups. Place your bet. Pick one. If you guess right, win up to <b className="text-primary">8.1×</b> your stake.
            Provably fair RNG. 10% house edge — disclosed and audited.
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Link to="/auth"><Button size="lg" className="text-base h-12 px-8" style={{ boxShadow: "var(--shadow-glow)" }}>Play now</Button></Link>
            <Link to="/game"><Button size="lg" variant="outline" className="text-base h-12 px-8">How it works</Button></Link>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-5">
          {[
            { t: "Sign up free", d: "Get KES 1,000 demo balance the moment you join." },
            { t: "Pick your cups", d: "More cups = bigger payout, smaller odds. You choose the risk." },
            { t: "Cash out fast", d: "Winnings hit your wallet instantly. Withdraw to M-Pesa anytime." },
          ].map((f) => (
            <div key={f.t} className="p-6 rounded-2xl border" style={{ background: "var(--gradient-card)", boxShadow: "var(--shadow-card)" }}>
              <h3 className="text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Pesa Cups — Demo build. 18+. Play responsibly.
      </footer>
    </div>
  );
}
