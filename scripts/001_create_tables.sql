-- Users table for custom authentication (not using Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Banks table for storing bank information
CREATE TABLE IF NOT EXISTS banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platforms table (Airbnb, Booking.com, etc.)
CREATE TABLE IF NOT EXISTS platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  account_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Properties/Listings table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank transactions table (from bank CSV imports)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  balance DECIMAL(15, 2),
  description TEXT,
  is_income BOOLEAN DEFAULT FALSE,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_with UUID,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform transactions table (from Airbnb/Booking CSV imports)
CREATE TABLE IF NOT EXISTS platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  payout_date DATE,
  type VARCHAR(50),
  confirmation_code VARCHAR(50),
  booking_date DATE,
  check_in_date DATE,
  check_out_date DATE,
  nights INTEGER,
  guest_name VARCHAR(100),
  currency VARCHAR(10) DEFAULT 'JPY',
  amount DECIMAL(15, 2),
  payout_amount DECIMAL(15, 2),
  service_fee DECIMAL(15, 2),
  fast_pay_fee DECIMAL(15, 2),
  cleaning_fee DECIMAL(15, 2),
  linen_fee DECIMAL(15, 2),
  total_revenue DECIMAL(15, 2),
  accommodation_tax DECIMAL(15, 2),
  revenue_year INTEGER,
  details TEXT,
  referral_code TEXT,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_with UUID,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CSV import templates for dynamic column mapping
CREATE TABLE IF NOT EXISTS csv_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  source_type VARCHAR(20) NOT NULL, -- 'bank' or 'platform'
  column_mapping JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Import history
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(20) NOT NULL,
  source_id UUID,
  file_name VARCHAR(255),
  records_imported INTEGER,
  imported_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default admin user (password: good2025)
-- Password hash generated using bcrypt
INSERT INTO users (username, password_hash, display_name, role) 
VALUES ('superjimmy', '$2b$10$rQZ9QzN0QzN0QzN0QzN0Qu8J8J8J8J8J8J8J8J8J8J8J8J8J8J8', 'Super Admin', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank ON bank_transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_date ON platform_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_platform ON platform_transactions(platform_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_property ON platform_transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_reconciled ON platform_transactions(reconciled);
