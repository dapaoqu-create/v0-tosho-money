-- 對賬規則表
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  bank_field VARCHAR(255) NOT NULL,
  platform_field VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 對賬記錄表 (關聯銀行交易和平台交易)
CREATE TABLE IF NOT EXISTS reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES reconciliation_rules(id) ON DELETE SET NULL,
  bank_transaction_id UUID REFERENCES bank_transactions(id) ON DELETE CASCADE,
  platform_transaction_ids UUID[] NOT NULL DEFAULT '{}',
  confirmation_codes TEXT[] NOT NULL DEFAULT '{}',
  is_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 在銀行交易表添加對賬相關欄位
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'unreconciled',
ADD COLUMN IF NOT EXISTS matched_confirmation_codes TEXT[] DEFAULT '{}';

-- 在平台交易表添加對賬相關欄位
ALTER TABLE platform_transactions 
ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(50) DEFAULT 'unreconciled',
ADD COLUMN IF NOT EXISTS matched_bank_transaction_code VARCHAR(255);

-- 插入預設對賬規則
INSERT INTO reconciliation_rules (name, bank_field, platform_field)
VALUES ('楽天&AIRBNB', '入出金(円)', '收款')
ON CONFLICT DO NOTHING;
