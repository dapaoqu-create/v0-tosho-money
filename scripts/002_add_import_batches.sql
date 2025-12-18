-- CSV Import batches table for tracking each CSV upload
CREATE TABLE IF NOT EXISTS csv_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(20) NOT NULL, -- 'bank' or 'platform'
  file_name VARCHAR(255) NOT NULL,
  -- Bank specific fields
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  bank_code VARCHAR(50), -- 銀行辨識碼
  memo TEXT, -- 備注
  -- Platform specific fields  
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  platform_name VARCHAR(100),
  account_name VARCHAR(100),
  property_name VARCHAR(255),
  -- Stats
  records_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add batch_id and transaction_code to bank_transactions
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES csv_import_batches(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(50);

-- Add batch_id to platform_transactions
ALTER TABLE platform_transactions 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES csv_import_batches(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch ON bank_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_batch ON platform_transactions(batch_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_batches_type ON csv_import_batches(source_type);
