-- 創建對賬邏輯備忘錄表
CREATE TABLE IF NOT EXISTS reconciliation_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('bank', 'platform')),
  bank_name VARCHAR(100),
  platform_name VARCHAR(100),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_reconciliation_memos_source_type ON reconciliation_memos(source_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_memos_bank_name ON reconciliation_memos(bank_name);
CREATE INDEX IF NOT EXISTS idx_reconciliation_memos_platform_name ON reconciliation_memos(platform_name);
