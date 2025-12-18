-- 清空所有 CSV 匯入的資料
-- 注意：此操作無法復原，請謹慎執行

-- 清空對帳記錄
DELETE FROM reconciliation_records;

-- 清空銀行交易資料
DELETE FROM bank_transactions;

-- 清空平台交易資料
DELETE FROM platform_transactions;

-- 清空匯入批次記錄（如果存在）
DELETE FROM bank_import_batches;
DELETE FROM platform_import_batches;

-- 清空房源資料
DELETE FROM properties;

-- 清空平台資料
DELETE FROM platforms;

-- 清空銀行資料
DELETE FROM banks;

-- 確認清空完成
SELECT 'All CSV data has been cleared.' as status;
