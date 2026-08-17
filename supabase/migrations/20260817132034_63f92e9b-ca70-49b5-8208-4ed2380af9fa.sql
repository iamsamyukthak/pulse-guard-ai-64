
-- ============ CORE ENTITIES ============
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  home_city text NOT NULL DEFAULT 'New York',
  home_lat double precision NOT NULL DEFAULT 40.71,
  home_lon double precision NOT NULL DEFAULT -74.0,
  risk_tier text NOT NULL DEFAULT 'low',
  signup_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_number text NOT NULL,
  account_type text NOT NULL DEFAULT 'checking',
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  avg_txn_amount numeric(12,2) NOT NULL DEFAULT 80,
  stddev_txn_amount numeric(12,2) NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  os text NOT NULL DEFAULT 'iOS',
  browser text NOT NULL DEFAULT 'Safari',
  is_emulator boolean NOT NULL DEFAULT false,
  trust_score int NOT NULL DEFAULT 70,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  mcc text NOT NULL DEFAULT '5999',
  country text NOT NULL DEFAULT 'US',
  risk_rating int NOT NULL DEFAULT 20
);

CREATE TABLE public.ip_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'US',
  city text NOT NULL DEFAULT 'New York',
  lat double precision NOT NULL DEFAULT 40.71,
  lon double precision NOT NULL DEFAULT -74.0,
  asn text NOT NULL DEFAULT 'AS7922',
  is_proxy boolean NOT NULL DEFAULT false,
  is_tor boolean NOT NULL DEFAULT false,
  reputation int NOT NULL DEFAULT 80
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  ip_id uuid REFERENCES public.ip_addresses(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  channel text NOT NULL DEFAULT 'card_present',
  status text NOT NULL DEFAULT 'pending',
  risk_score int NOT NULL DEFAULT 0,
  decision text NOT NULL DEFAULT 'APPROVE',
  rule_score int NOT NULL DEFAULT 0,
  anomaly_score int NOT NULL DEFAULT 0,
  graph_score int NOT NULL DEFAULT 0,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  scenario_tag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_created ON public.transactions(created_at DESC);
CREATE INDEX idx_txn_account ON public.transactions(account_id, created_at DESC);

CREATE TABLE public.risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  weight int NOT NULL DEFAULT 0,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_events_txn ON public.risk_events(transaction_id);

CREATE TABLE public.fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_created ON public.fraud_alerts(created_at DESC);

CREATE TABLE public.investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES public.fraud_alerts(id) ON DELETE SET NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'high',
  assigned_to text NOT NULL DEFAULT 'Unassigned',
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.investigation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Analyst',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.analyst_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.investigation_cases(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  label text NOT NULL,
  rationale text NOT NULL DEFAULT '',
  analyst text NOT NULL DEFAULT 'Analyst',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fraud_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  source_label text NOT NULL DEFAULT '',
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  target_label text NOT NULL DEFAULT '',
  relation text NOT NULL,
  weight int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rel_source ON public.fraud_relationships(source_id);
CREATE INDEX idx_rel_target ON public.fraud_relationships(target_id);

CREATE TABLE public.watchlist_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_value text NOT NULL,
  reason text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'high',
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attack_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  expected_decision text NOT NULL,
  txn_count int NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  metric_value numeric NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ GRANTS + RLS (read-only demo console; writes are server-side only) ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','accounts','devices','merchants','ip_addresses','transactions',
    'risk_events','fraud_alerts','investigation_cases','investigation_notes','analyst_feedback',
    'fraud_relationships','watchlist_entities','attack_scenarios','system_metrics']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY "Public read %1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true);', t);
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
  END LOOP;
END $$;

-- ============ SEED ============
INSERT INTO public.users (id, full_name, email, country, home_city, home_lat, home_lon, risk_tier) VALUES
 ('11111111-1111-4111-8111-000000000001','Amara Chen','amara.chen@example.com','US','New York',40.7128,-74.0060,'low'),
 ('11111111-1111-4111-8111-000000000002','Diego Martins','diego.martins@example.com','US','Austin',30.2672,-97.7431,'low'),
 ('11111111-1111-4111-8111-000000000003','Priya Nair','priya.nair@example.com','IN','Bengaluru',12.9716,77.5946,'medium'),
 ('11111111-1111-4111-8111-000000000004','Tomas Novak','tomas.novak@example.com','CZ','Prague',50.0755,14.4378,'medium'),
 ('11111111-1111-4111-8111-000000000005','Lena Fischer','lena.fischer@example.com','DE','Berlin',52.52,13.405,'low'),
 ('11111111-1111-4111-8111-000000000006','Marcus Webb','marcus.webb@example.com','US','Miami',25.7617,-80.1918,'high');

INSERT INTO public.accounts (id, user_id, account_number, account_type, balance, avg_txn_amount, stddev_txn_amount) VALUES
 ('22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001','ACC-4417-0091','checking',18420.55,86,42),
 ('22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000002','ACC-4417-0092','credit',6120.10,124,60),
 ('22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000003','ACC-4417-0093','checking',2310.00,54,25),
 ('22222222-2222-4222-8222-000000000004','11111111-1111-4111-8111-000000000004','ACC-4417-0094','credit',9800.00,140,70),
 ('22222222-2222-4222-8222-000000000005','11111111-1111-4111-8111-000000000005','ACC-4417-0095','checking',15230.75,95,38),
 ('22222222-2222-4222-8222-000000000006','11111111-1111-4111-8111-000000000006','ACC-4417-0096','credit',430.20,210,110);

INSERT INTO public.devices (id, fingerprint, os, browser, is_emulator, trust_score) VALUES
 ('33333333-3333-4333-8333-000000000001','DVC-A1F0-TRUSTED','iOS','Safari',false,92),
 ('33333333-3333-4333-8333-000000000002','DVC-B7C2-TRUSTED','Android','Chrome',false,88),
 ('33333333-3333-4333-8333-000000000003','DVC-C9E4-KNOWN','macOS','Chrome',false,74),
 ('33333333-3333-4333-8333-000000000004','DVC-D3A8-EMULATOR','Android','Headless',true,12),
 ('33333333-3333-4333-8333-000000000005','DVC-E5B1-BURNER','Windows','Chrome',false,28),
 ('33333333-3333-4333-8333-000000000006','DVC-F2D7-RINGNODE','Linux','Headless',true,8);

INSERT INTO public.merchants (id, name, category, mcc, country, risk_rating) VALUES
 ('44444444-4444-4444-8444-000000000001','Blue Bottle Coffee','food',5814,'US',8),
 ('44444444-4444-4444-8444-000000000002','Northwind Grocers','grocery',5411,'US',10),
 ('44444444-4444-4444-8444-000000000003','LuxeGold Jewelers','luxury',5944,'US',62),
 ('44444444-4444-4444-8444-000000000004','CryptoSwap Exchange','crypto',6051,'MT',88),
 ('44444444-4444-4444-8444-000000000005','GiftCardHub','giftcards',5815,'PA',80),
 ('44444444-4444-4444-8444-000000000006','SkyHigh Electronics','electronics',5732,'US',45);

INSERT INTO public.ip_addresses (id, ip, country, city, lat, lon, asn, is_proxy, is_tor, reputation) VALUES
 ('55555555-5555-4555-8555-000000000001','73.42.118.9','US','New York',40.7128,-74.0060,'AS7922',false,false,92),
 ('55555555-5555-4555-8555-000000000002','24.19.77.203','US','Austin',30.2672,-97.7431,'AS7018',false,false,88),
 ('55555555-5555-4555-8555-000000000003','103.21.244.17','IN','Bengaluru',12.9716,77.5946,'AS9498',false,false,70),
 ('55555555-5555-4555-8555-000000000004','185.220.101.44','RO','Bucharest',44.4268,26.1025,'AS9009',true,true,4),
 ('55555555-5555-4555-8555-000000000005','45.132.192.8','NG','Lagos',6.5244,3.3792,'AS37340',true,false,15),
 ('55555555-5555-4555-8555-000000000006','91.219.238.12','RU','Moscow',55.7558,37.6173,'AS49505',true,false,9);

INSERT INTO public.watchlist_entities (entity_type, entity_value, reason, severity) VALUES
 ('ip','185.220.101.44','Tor exit node linked to prior ATO ring','critical'),
 ('ip','91.219.238.12','Bulletproof hosting, carding activity','high'),
 ('device','DVC-F2D7-RINGNODE','Device reused across 5 unrelated accounts','critical'),
 ('merchant','GiftCardHub','High cash-out fraud rate','high'),
 ('merchant','CryptoSwap Exchange','Irreversible cash-out channel','high');

INSERT INTO public.attack_scenarios (key, name, description, expected_decision, txn_count, sort_order) VALUES
 ('impossible_travel','Impossible Travel','Two card-present payments from cities that cannot be reached in the elapsed time.','BLOCK',2,1),
 ('high_velocity','High Velocity Attack','A burst of rapid payments on one account within seconds.','BLOCK',8,2),
 ('account_takeover','Account Takeover','New emulator device + Tor IP draining funds to crypto cash-out.','BLOCK',3,3),
 ('card_testing','Card Testing','Many micro-authorisations probing for live cards.','BLOCK',10,4),
 ('fraud_ring','Fraud Ring','Multiple accounts sharing one device and IP, cashing out via gift cards.','BLOCK',5,5);
