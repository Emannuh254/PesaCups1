import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// MOCK MegaPay deposit — auto-credits wallet. Replace with real STK Push later.
export const mockDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ amount: z.number().positive().max(100000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).single();
    const newBalance = Number(w?.balance ?? 0) + data.amount;
    await supabaseAdmin.from("wallets").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("user_id", userId);
    await supabaseAdmin.from("transactions").insert({
      user_id: userId, type: "deposit", amount: data.amount, status: "completed",
      reference: `MOCK-${Date.now()}`, metadata: { provider: "megapay-mock" },
    });
    return { newBalance };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    amount: z.number().positive().max(100000),
    phone: z.string().min(9).max(15).regex(/^[+0-9]+$/),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", userId).single();
    if (!w || Number(w.balance) < data.amount) throw new Error("Insufficient balance");
    // Hold funds: deduct now, refund on rejection
    await supabaseAdmin.from("wallets").update({
      balance: Number(w.balance) - data.amount, updated_at: new Date().toISOString()
    }).eq("user_id", userId);
    const { data: wd, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId, amount: data.amount, phone: data.phone, status: "pending",
    }).select().single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("transactions").insert({
      user_id: userId, type: "withdrawal", amount: -data.amount, status: "pending",
      reference: wd.id,
    });
    return { id: wd.id };
  });

export const adminResolveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(), approve: z.boolean(), note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden");

    const { data: wd } = await supabaseAdmin.from("withdrawals").select("*").eq("id", data.id).single();
    if (!wd || wd.status !== "pending") throw new Error("Already resolved");

    if (data.approve) {
      await supabaseAdmin.from("withdrawals").update({
        status: "completed", admin_note: data.note ?? null, resolved_at: new Date().toISOString(),
      }).eq("id", data.id);
      await supabaseAdmin.from("transactions").update({ status: "completed" }).eq("reference", data.id);
    } else {
      // refund
      const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", wd.user_id).single();
      await supabaseAdmin.from("wallets").update({
        balance: Number(w?.balance ?? 0) + Number(wd.amount), updated_at: new Date().toISOString(),
      }).eq("user_id", wd.user_id);
      await supabaseAdmin.from("withdrawals").update({
        status: "rejected", admin_note: data.note ?? null, resolved_at: new Date().toISOString(),
      }).eq("id", data.id);
      await supabaseAdmin.from("transactions").update({ status: "rejected" }).eq("reference", data.id);
    }
    return { ok: true };
  });
