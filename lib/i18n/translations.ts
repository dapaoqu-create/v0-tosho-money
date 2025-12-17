export const translations = {
  ja: {
    // Common
    login: "ログイン",
    logout: "ログアウト",
    loginToSystem: "登入系統",

    // Home page
    heroSubtitle: "不動産賃貸事業向け財務管理",
    heroTitle1: "賃貸収入を",
    heroTitle2: "スマートに管理",
    heroDescription:
      "Airbnb、楽天銀行などの複数プラットフォームからのCSVを統合し、自動対帳機能で入金確認を効率化。日本の確定申告に対応したレポート出力も可能です。",
    getStarted: "今すぐ始める",

    // Features
    csvImport: "CSV自動取込",
    csvImportDesc: "銀行・プラットフォームのCSVを自動認識し、新しい形式にも対応",
    autoReconciliation: "自動対帳",
    autoReconciliationDesc: "銀行入金とプラットフォーム売上を自動マッチングし、未入金を検出",
    statsReports: "統計・レポート",
    statsReportsDesc: "月次・年次の収支レポートを自動生成、確定申告用フォーマットで出力",
    userManagement: "ユーザー管理",
    userManagementDesc: "複数ユーザーでの利用に対応、権限管理で安全に運用",

    // Login page
    loginTitle: "ログイン",
    loginDescription: "アカウント情報を入力してください",
    username: "ユーザー名",
    password: "パスワード",
    usernamePlaceholder: "ユーザー名を入力",
    passwordPlaceholder: "パスワードを入力",
    loggingIn: "ログイン中...",
    loginError: "ログインに失敗しました",
    errorOccurred: "エラーが発生しました",
    defaultCredentials: "デフォルト: superjimmy / good2025",

    // Footer
    copyright: "© 2025 TOSHO Money. All rights reserved.",
  },
  "zh-TW": {
    // Common
    login: "登入",
    logout: "登出",
    loginToSystem: "登入系統",

    // Home page
    heroSubtitle: "不動產租賃事業專用財務管理",
    heroTitle1: "智慧管理",
    heroTitle2: "租賃收入",
    heroDescription:
      "整合 Airbnb、樂天銀行等多平台 CSV，自動對帳功能讓入帳確認更有效率。支援日本確定申告格式報表輸出。",
    getStarted: "立即開始",

    // Features
    csvImport: "CSV 自動匯入",
    csvImportDesc: "自動識別銀行及平台的 CSV 格式，支援新格式擴充",
    autoReconciliation: "自動對帳",
    autoReconciliationDesc: "自動配對銀行入金與平台收入，偵測未入帳款項",
    statsReports: "統計報表",
    statsReportsDesc: "自動生成月度、年度收支報表，支援確定申告格式輸出",
    userManagement: "用戶管理",
    userManagementDesc: "支援多用戶使用，權限管理確保安全營運",

    // Login page
    loginTitle: "登入",
    loginDescription: "請輸入您的帳號資訊",
    username: "用戶名",
    password: "密碼",
    usernamePlaceholder: "請輸入用戶名",
    passwordPlaceholder: "請輸入密碼",
    loggingIn: "登入中...",
    loginError: "登入失敗",
    errorOccurred: "發生錯誤",
    defaultCredentials: "預設帳號: superjimmy / good2025",

    // Footer
    copyright: "© 2025 TOSHO Money. 保留所有權利。",
  },
  en: {
    // Common
    login: "Login",
    logout: "Logout",
    loginToSystem: "Login",

    // Home page
    heroSubtitle: "Financial Management for Rental Properties",
    heroTitle1: "Manage Rental Income",
    heroTitle2: "Smartly",
    heroDescription:
      "Integrate CSVs from Airbnb, Rakuten Bank and other platforms. Automate reconciliation for efficient payment tracking. Export reports compatible with Japanese tax filing.",
    getStarted: "Get Started",

    // Features
    csvImport: "Auto CSV Import",
    csvImportDesc: "Automatically recognize bank and platform CSV formats, adaptable to new formats",
    autoReconciliation: "Auto Reconciliation",
    autoReconciliationDesc: "Automatically match bank deposits with platform payouts, detect missing payments",
    statsReports: "Statistics & Reports",
    statsReportsDesc: "Auto-generate monthly and annual income reports, export in tax filing format",
    userManagement: "User Management",
    userManagementDesc: "Multi-user support with role-based access control for secure operations",

    // Login page
    loginTitle: "Login",
    loginDescription: "Enter your account credentials",
    username: "Username",
    password: "Password",
    usernamePlaceholder: "Enter username",
    passwordPlaceholder: "Enter password",
    loggingIn: "Logging in...",
    loginError: "Login failed",
    errorOccurred: "An error occurred",
    defaultCredentials: "Default: superjimmy / good2025",

    // Footer
    copyright: "© 2025 TOSHO Money. All rights reserved.",
  },
}

export type Locale = keyof typeof translations
export type TranslationKey = keyof typeof translations.ja
