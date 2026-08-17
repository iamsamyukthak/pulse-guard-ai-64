import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TxnRow = {
  id: string;
  amount: number;
  currency: string;
  channel: string;
  status: string;
  risk_score: number;
  decision: string;
  rule_score: number;
  anomaly_score: number;
  graph_score: number;
  explanation: string;
  scenario_tag: string | null;
  created_at: string;
  device_id: string | null;
  ip_id: string | null;
  merchant_id: string | null;
  account_id: string;
  merchants: { name: string; category: string } | null;
  devices: { fingerprint: string; is_emulator: boolean } | null;
  ip_addresses: { ip: string; city: string; country: string; is_tor: boolean } | null;
  accounts: { account_number: string; users: { full_name: string } } | null;
};

const TXN_SELECT =
  "*, merchants(name, category), devices(fingerprint, is_emulator), ip_addresses(ip, city, country, is_tor), accounts(account_number, users(full_name))";

export function useTransactions(limit = 60) {
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(TXN_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as TxnRow[];
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(TXN_SELECT)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as TxnRow;
    },
  });
}

export type AlertRow = {
  id: string;
  transaction_id: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

export function useAlerts(limit = 30) {
  return useQuery({
    queryKey: ["alerts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
  });
}

export type CaseRow = {
  id: string;
  transaction_id: string;
  alert_id: string | null;
  title: string;
  status: string;
  priority: string;
  assigned_to: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  transactions: { amount: number; risk_score: number; decision: string; scenario_tag: string | null } | null;
};

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investigation_cases")
        .select("*, transactions(amount, risk_score, decision, scenario_tag)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as CaseRow[];
    },
  });
}

export function useCase(id: string) {
  return useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investigation_cases")
        .select("*, transactions(amount, risk_score, decision, scenario_tag)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as CaseRow;
    },
  });
}

export function useRiskEvents(transactionId: string | undefined) {
  return useQuery({
    enabled: !!transactionId,
    queryKey: ["risk_events", transactionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_events")
        .select("*")
        .eq("transaction_id", transactionId!)
        .order("weight", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useNotes(caseId: string | undefined) {
  return useQuery({
    enabled: !!caseId,
    queryKey: ["notes", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investigation_notes")
        .select("*")
        .eq("case_id", caseId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRelationships() {
  return useQuery({
    queryKey: ["relationships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_relationships")
        .select("*")
        .order("weight", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFeedback() {
  return useQuery({
    queryKey: ["feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyst_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist_entities").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ["system_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Live subscription: invalidates the affected query caches on any change. */
export function useLiveFraudFeed() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("trustpulse-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["transactions"] });
        qc.invalidateQueries({ queryKey: ["transaction"] });
        qc.invalidateQueries({ queryKey: ["relationships"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fraud_alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["alerts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "investigation_cases" }, () => {
        qc.invalidateQueries({ queryKey: ["cases"] });
        qc.invalidateQueries({ queryKey: ["case"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "investigation_notes" }, () => {
        qc.invalidateQueries({ queryKey: ["notes"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "analyst_feedback" }, () => {
        qc.invalidateQueries({ queryKey: ["feedback"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
