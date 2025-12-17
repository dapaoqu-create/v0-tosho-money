export interface Bank {
  id: string
  name: string
  created_at: string
}

export interface Platform {
  id: string
  name: string
  account_name: string
  created_at: string
}

export interface Property {
  id: string
  platform_id: string
  name: string
  created_at: string
}

export interface BankTransaction {
  id: string
  bank_id: string
  transaction_date: string
  amount: number
  balance: number
  description: string
  is_income: boolean
  reconciled: boolean
  reconciled_with: string | null
  raw_data: Record<string, unknown>
  created_at: string
  bank?: Bank
}

export interface PlatformTransaction {
  id: string
  platform_id: string
  property_id: string
  transaction_date: string
  payout_date: string
  type: string
  confirmation_code: string
  booking_date: string
  check_in_date: string
  check_out_date: string
  nights: number
  guest_name: string
  currency: string
  amount: number
  payout_amount: number
  service_fee: number
  fast_pay_fee: number
  cleaning_fee: number
  linen_fee: number
  total_revenue: number
  accommodation_tax: number
  revenue_year: number
  details: string
  referral_code: string
  reconciled: boolean
  reconciled_with: string | null
  raw_data: Record<string, unknown>
  created_at: string
  platform?: Platform
  property?: Property
}

export interface CSVTemplate {
  id: string
  name: string
  source_type: "bank" | "platform"
  column_mapping: Record<string, string>
  created_at: string
}

export interface ImportHistory {
  id: string
  source_type: string
  source_id: string
  file_name: string
  records_imported: number
  imported_by: string
  created_at: string
}

export interface DashboardStats {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  pendingReconciliation: number
  totalBookings: number
  averageNightlyRate: number
}

export interface MonthlyData {
  month: string
  revenue: number
  expenses: number
}

export interface DailyData {
  date: string
  revenue: number
}
