-- 為 csv_import_batches 表添加 csv_headers 欄位，用於保存原始 CSV 欄位順序
ALTER TABLE csv_import_batches ADD COLUMN IF NOT EXISTS csv_headers TEXT[];
