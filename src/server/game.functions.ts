import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { randomInt } from "crypto";

const PlaySchema = z.object({
  bet: z.number().positive().max(100000),
  cups: z.number().int().min(3).max(9),
  picked: z.number().int().min(1).max(9),
});

export const playGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlaySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.picked > data.cups) throw new Error("Invalid cup pick");

    // Atomic-ish: read wallet, validate, then RPC-style update via admin
    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets").select("balance").eq("user_id", userId).single();
    if (wErr || !wallet) throw new Error("Wallet not found");
    if (Number(wallet.balance) < data.bet) throw new Error("Insufficient balance");

    // Server-side RNG
    const winningCup = randomInt(1, data.cups + 1);
    const won = winningCup === data.picked;
    const multiplier = data.cups * 0.9; // disclosed 10% house edge
    const payout = won ? +(data.bet * multiplier).toFixed(2) : 0;
    const newBalance = +(Number(wallet.balance) - data.bet + payout).toFixed(2);

    const { error: updErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (updErr) throw new Error("Wallet update failed");

    await supabaseAdmin.from("transactions").insert([
      { user_id: userId, type: "bet", amount: -data.bet, status: "completed" },
      ...(won ? [{ user_id: userId, type: "win" as const, amount: payout, status: "completed" as const }] : []),
    ]);

    await supabaseAdmin.from("games").insert({
      user_id: userId, bet_amount: data.bet, cups: data.cups,
      picked_cup: data.picked, winning_cup: winningCup,
      won, payout, multiplier,
    });

    return { won, winningCup, payout, multiplier, newBalance };
  });
