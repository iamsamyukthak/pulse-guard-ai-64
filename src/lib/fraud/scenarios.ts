/**
 * Deterministic attack scenarios. Each builds real transaction specs that are
 * pushed through the same ingestion pipeline as organic traffic — the engine,
 * not the scenario, decides the outcome.
 */
import type { TxnSpec } from "../fraud.server";

export const ACCOUNTS = {
  amara: "22222222-2222-4222-8222-000000000001",
  diego: "22222222-2222-4222-8222-000000000002",
  priya: "22222222-2222-4222-8222-000000000003",
  tomas: "22222222-2222-4222-8222-000000000004",
  lena: "22222222-2222-4222-8222-000000000005",
  marcus: "22222222-2222-4222-8222-000000000006",
} as const;

export const DEVICES = {
  trustedIos: "33333333-3333-4333-8333-000000000001",
  trustedAndroid: "33333333-3333-4333-8333-000000000002",
  knownMac: "33333333-3333-4333-8333-000000000003",
  emulator: "33333333-3333-4333-8333-000000000004",
  burner: "33333333-3333-4333-8333-000000000005",
  ringNode: "33333333-3333-4333-8333-000000000006",
} as const;

export const MERCHANTS = {
  coffee: "44444444-4444-4444-8444-000000000001",
  grocery: "44444444-4444-4444-8444-000000000002",
  jewelry: "44444444-4444-4444-8444-000000000003",
  crypto: "44444444-4444-4444-8444-000000000004",
  giftcards: "44444444-4444-4444-8444-000000000005",
  electronics: "44444444-4444-4444-8444-000000000006",
} as const;

export const IPS = {
  newYork: "55555555-5555-4555-8555-000000000001",
  austin: "55555555-5555-4555-8555-000000000002",
  bengaluru: "55555555-5555-4555-8555-000000000003",
  tor: "55555555-5555-4555-8555-000000000004",
  lagos: "55555555-5555-4555-8555-000000000005",
  moscow: "55555555-5555-4555-8555-000000000006",
} as const;

/** Mulberry32 — deterministic PRNG so demo runs are reproducible. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ScenarioKey =
  | "impossible_travel"
  | "high_velocity"
  | "account_takeover"
  | "card_testing"
  | "fraud_ring"
  | "organic";

interface ScenarioDef {
  key: ScenarioKey;
  name: string;
  description: string;
  expected: string;
  delayMs: number;
  build: () => TxnSpec[];
}

const money = (n: number) => Math.round(n * 100) / 100;

export const SCENARIOS: Record<ScenarioKey, ScenarioDef> = {
  impossible_travel: {
    key: "impossible_travel",
    name: "Impossible Travel",
    description:
      "A legitimate New York purchase followed minutes later by a Moscow card-present payment.",
    expected: "BLOCK",
    delayMs: 250,
    build: () => [
      {
        accountId: ACCOUNTS.amara,
        merchantId: MERCHANTS.coffee,
        deviceId: DEVICES.trustedIos,
        ipId: IPS.newYork,
        amount: money(7.4),
        channel: "card_present",
        scenarioTag: "impossible_travel",
      },
      {
        accountId: ACCOUNTS.amara,
        merchantId: MERCHANTS.electronics,
        deviceId: DEVICES.burner,
        ipId: IPS.moscow,
        amount: money(1890),
        channel: "card_present",
        scenarioTag: "impossible_travel",
      },
    ],
  },

  high_velocity: {
    key: "high_velocity",
    name: "High Velocity Attack",
    description: "Eight payments fired at one account inside a few seconds.",
    expected: "BLOCK",
    delayMs: 120,
    build: () => {
      const rnd = seeded(4242);
      const merchants = [
        MERCHANTS.electronics,
        MERCHANTS.jewelry,
        MERCHANTS.giftcards,
        MERCHANTS.grocery,
      ];
      return Array.from({ length: 8 }, (_, i) => ({
        accountId: ACCOUNTS.diego,
        merchantId: merchants[i % merchants.length]!,
        deviceId: DEVICES.burner,
        ipId: IPS.lagos,
        amount: money(180 + rnd() * 620),
        channel: "ecommerce",
        scenarioTag: "high_velocity",
      }));
    },
  },

  account_takeover: {
    key: "account_takeover",
    name: "Account Takeover",
    description:
      "An emulated device on a Tor exit node drains the account into crypto cash-out.",
    expected: "BLOCK",
    delayMs: 300,
    build: () => [
      {
        accountId: ACCOUNTS.lena,
        merchantId: MERCHANTS.electronics,
        deviceId: DEVICES.emulator,
        ipId: IPS.tor,
        amount: money(320),
        channel: "ecommerce",
        scenarioTag: "account_takeover",
      },
      {
        accountId: ACCOUNTS.lena,
        merchantId: MERCHANTS.crypto,
        deviceId: DEVICES.emulator,
        ipId: IPS.tor,
        amount: money(4800),
        channel: "ecommerce",
        scenarioTag: "account_takeover",
      },
      {
        accountId: ACCOUNTS.lena,
        merchantId: MERCHANTS.crypto,
        deviceId: DEVICES.emulator,
        ipId: IPS.tor,
        amount: money(6200),
        channel: "ecommerce",
        scenarioTag: "account_takeover",
      },
    ],
  },

  card_testing: {
    key: "card_testing",
    name: "Card Testing",
    description: "Ten sub-$5 authorisations probing for live cards.",
    expected: "BLOCK",
    delayMs: 100,
    build: () => {
      const rnd = seeded(9001);
      return Array.from({ length: 10 }, () => ({
        accountId: ACCOUNTS.marcus,
        merchantId: MERCHANTS.giftcards,
        deviceId: DEVICES.emulator,
        ipId: IPS.moscow,
        amount: money(0.5 + rnd() * 3.5),
        channel: "ecommerce",
        scenarioTag: "card_testing",
      }));
    },
  },

  fraud_ring: {
    key: "fraud_ring",
    name: "Fraud Ring",
    description:
      "Five unrelated accounts cashing out through one shared device and IP.",
    expected: "BLOCK",
    delayMs: 200,
    build: () => {
      const rnd = seeded(777);
      const accts = [
        ACCOUNTS.amara,
        ACCOUNTS.diego,
        ACCOUNTS.priya,
        ACCOUNTS.tomas,
        ACCOUNTS.marcus,
      ];
      return accts.map((accountId) => ({
        accountId,
        merchantId: MERCHANTS.giftcards,
        deviceId: DEVICES.ringNode,
        ipId: IPS.tor,
        amount: money(400 + rnd() * 900),
        channel: "ecommerce",
        scenarioTag: "fraud_ring",
      }));
    },
  },

  organic: {
    key: "organic",
    name: "Organic Traffic",
    description: "Normal, low-risk customer activity.",
    expected: "APPROVE",
    delayMs: 60,
    build: () => {
      const rnd = seeded(Math.floor(Date.now() / 1000));
      const combos = [
        { a: ACCOUNTS.amara, d: DEVICES.trustedIos, i: IPS.newYork },
        { a: ACCOUNTS.diego, d: DEVICES.trustedAndroid, i: IPS.austin },
        { a: ACCOUNTS.priya, d: DEVICES.knownMac, i: IPS.bengaluru },
      ];
      const merchants = [MERCHANTS.coffee, MERCHANTS.grocery, MERCHANTS.electronics];
      const c = combos[Math.floor(rnd() * combos.length)]!;
      return [
        {
          accountId: c.a,
          merchantId: merchants[Math.floor(rnd() * merchants.length)]!,
          deviceId: c.d,
          ipId: c.i,
          amount: money(6 + rnd() * 120),
          channel: "card_present",
          scenarioTag: "organic",
        },
      ];
    },
  },
};

export const SCENARIO_LIST = [
  SCENARIOS.impossible_travel,
  SCENARIOS.high_velocity,
  SCENARIOS.account_takeover,
  SCENARIOS.card_testing,
  SCENARIOS.fraud_ring,
];
