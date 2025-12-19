-- 對賬日誌表
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES reconciliation_rules(id),
  rule_name VARCHAR(255),
  bank_batch_ids UUID[],
  platform_batch_ids UUID[],
  matched_count INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, cancelled
  matches JSONB, -- 儲存配對結果
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
