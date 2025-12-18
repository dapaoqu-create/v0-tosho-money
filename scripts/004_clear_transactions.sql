-- 清空所有交易相關資料
-- Clear all transaction related data

-- 先刪除交易記錄（因為有外鍵關聯）
DELETE FROM bank_transactions;
DELETE FROM platform_transactions;

-- 刪除匯入批次記錄
DELETE FROM csv_import_batches;

-- 刪除匯入歷史
DELETE FROM import_history;

-- 刪除 CSV 模板
DELETE FROM csv_templates;

-- 刪除房源
DELETE FROM properties;

-- 刪除平台
DELETE FROM platforms;

-- 刪除銀行
DELETE FROM banks;

-- 確認清空結果
SELECT 'bank_transactions' as table_name, COUNT(*) as count FROM bank_transactions
UNION ALL
SELECT 'platform_transactions', COUNT(*) FROM platform_transactions
UNION ALL
SELECT 'csv_import_batches', COUNT(*) FROM csv_import_batches
UNION ALL
SELECT 'banks', COUNT(*) FROM banks
UNION ALL
SELECT 'platforms', COUNT(*) FROM platforms
UNION ALL
SELECT 'properties', COUNT(*) FROM properties;
