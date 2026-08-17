/**
 * Provider-agnostic Fraud Copilot.
 *
 * Hard contract: the LLM NEVER computes, alters or invents a risk score.
 * It receives a read-only evidence packet produced by the authoritative engine
 * and may only summarise, explain, answer grounded questions and suggest steps.
 * If no provider is reachable, a deterministic local reasoner answers instead,
 * so the demo never depends on a paid API.
 */

export interface EvidencePacket {
  transaction: {
    id: string;
    amount: number;
    currency: string;
    channel: string;
    createdAt: string;
    riskScore: number;
    decision: string;
    ruleScore: number;
    anomalyScore: number;
    graphScore: number;
    explanation: string;
  };
  customer: string;
  merchant: string;
  device: string;
  ip: string;
  location: string;
  signals: { code: string; category: string; label: string; weight: number; detail: string }[];
  relatedAccounts: number;
  caseStatus: string;
}

const SYSTEM = `You are the TrustPulse Fraud Copilot, assisting a payment-fraud investigator.
STRICT RULES:
- The risk score and decision are produced by the authoritative backend risk engine. Never recompute, estimate, dispute numerically, or invent a score.
- Only use facts present in the EVIDENCE block. If something is not in evidence, say it is not in the evidence.
- Be concise (max ~140 words), factual, and operational. Use short paragraphs or bullets.
- End with a "Suggested next step" line when the question is investigative.`;

export function localAnswer(ev: EvidencePacket, question: string): string {
  const q = question.toLowerCase();
  const top = ev.signals.slice(0, 3);
  const bullets = top.map((s) => `• ${s.label} (+${s.weight}) — ${s.detail}`).join("\n");

  if (q.includes("why") || q.includes("explain") || q.includes("reason")) {
    return `The engine scored this ${ev.transaction.riskScore}/100 → ${ev.transaction.decision}.\n${bullets}\nRule ${ev.transaction.ruleScore} · anomaly ${ev.transaction.anomalyScore} · graph ${ev.transaction.graphScore}.\nSuggested next step: verify the customer through an out-of-band channel before releasing.`;
  }
  if (q.includes("related") || q.includes("ring") || q.includes("link") || q.includes("graph")) {
    return `${ev.relatedAccounts} account(s) are linked to this device or IP. Device ${ev.device}, IP ${ev.ip} (${ev.location}).\nSuggested next step: pivot into the relationship graph and check whether the linked accounts also cashed out at ${ev.merchant}.`;
  }
  if (q.includes("false positive") || q.includes("legit")) {
    return `Evidence weighing against a false positive: ${top.map((s) => s.label.toLowerCase()).join(", ")}. Nothing in the evidence shows prior legitimate use of device ${ev.device}.\nSuggested next step: contact the customer to confirm device ownership before marking false positive.`;
  }
  return `Transaction ${ev.transaction.id.slice(0, 8)} · $${ev.transaction.amount.toFixed(2)} at ${ev.merchant} · ${ev.transaction.decision} at ${ev.transaction.riskScore}/100.\n${bullets || "• No signals fired."}\nSuggested next step: review the full signal list and record a disposition.`;
}

export async function askCopilot(
  ev: EvidencePacket,
  question: string,
): Promise<{ answer: string; provider: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { answer: localAnswer(ev, question), provider: "local-reasoner" };

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `EVIDENCE (authoritative, read-only):\n${JSON.stringify(ev, null, 2)}\n\nINVESTIGATOR QUESTION: ${question}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = json.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("empty completion");
    return { answer, provider: "lovable-ai-gateway" };
  } catch {
    return { answer: localAnswer(ev, question), provider: "local-reasoner (fallback)" };
  }
}
