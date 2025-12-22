-- 為 csv_import_batches 表添加 completion_status 欄位
ALTER TABLE csv_import_batches ADD COLUMN IF NOT EXISTS completion_status VARCHAR(20) DEFAULT 'pending';

-- completion_status 可能的值: 'pending' (未完成), 'completed' (已完成)
