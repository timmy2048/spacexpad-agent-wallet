import type { ChainId, Denial, Lang, NetworkId } from './types.ts';

const EN = {
  appName: 'SpaceXpad agent wallet',
  mark: 'SpaceXpad',
  signIn: 'Sign in',
  loginNote: 'Privy creates the vault and holds the keys. There is no seed phrase.',
  continueGmail: 'Continue with Gmail',
  email: 'Email',
  sendCode: 'Email me a code',
  code: 'Code',
  confirmCode: 'Confirm code',
  codeSent: 'Code sent.',
  working: 'Working…',
  setupTitle: 'Add a Privy App ID',
  setupBody:
    'This build does not include an App ID. Create a Privy app, enable email and Gmail login plus Ethereum and Solana embedded wallets, then paste the App ID here.',
  extensionId: 'Extension ID',
  redirectUrl: 'OAuth redirect',
  privyAppId: 'Privy App ID',
  privyClientId: 'Privy client ID',
  save: 'Save',
  settings: 'Settings',
  username: 'Username',
  usernameHint: 'A display name on this device. Other people can use the same one. Sign-in uses your Privy id, not this name.',
  language: 'Language',
  assets: 'Assets',
  mainnetHint: 'These balances are on mainnet. An agent uses mainnet too, unless you ask for a test network.',
  readingMainnet: 'Reading mainnet…',
  explicitNetwork: 'Shown because an agent asked for this network.',
  agents: 'Agents',
  bindTitle: 'Bind an agent',
  bindIntro: 'Copy a prompt for your agent. The connection runs on this computer. https://spacexpad.xyz/agent-wallet/ is reserved for this wallet and is not published yet. Paste the token your agent gives you. It lasts 10 minutes.',
  copyPrompt: 'Copy prompt',
  promptCopied: 'Prompt copied',
  showPrompt: 'Show prompt',
  hidePrompt: 'Hide prompt',
  tokenLabel: 'Binding token',
  bindAction: 'Bind',
  unbind: 'Remove',
  noAgents: 'No agents bound.',
  activity: 'Activity',
  noActivity: 'No activity yet.',
  pause: 'Pause all agents',
  resume: 'Resume',
  paused: 'Agents are paused.',
  risk: 'Risk policy',
  fullAccess: 'Full access',
  fullAccessHelp: 'Sign and send without a USD cap. The kill switch and whitelist still apply.',
  useLimits: 'Enforce USD limits',
  singleLimit: 'Single transaction limit, USD',
  dailyLimit: 'Daily limit, USD',
  whitelist: 'Audited-protocol whitelist',
  whitelistHelp:
    'When this is on, signing is allowed only if every destination is on this list. Native transfers match the recipient. Contract calls match the contract.',
  whitelistEmpty: 'No addresses yet. With the whitelist on, nothing can be signed.',
  add: 'Add',
  address: 'Address',
  label: 'Label',
  remove: 'Remove',
  bridge: 'Agent bridge',
  bridgeToken: 'Bridge token',
  bridgeHelp: 'From this repo run node --experimental-strip-types mcp/src/index.ts. Paste the bridge token from stderr. It is also in ~/.spacexpad-agent-wallet/bridge.json. Do not share it.',
  bridgeConnected: 'Bridge connected',
  bridgeDisconnected: 'Bridge not connected',
  bridgeRejected: 'Bridge token was rejected',
  logout: 'Log out',
  refresh: 'Refresh',
  copied: 'Copied',
  copyAddress: 'Copy address',
  couldNotCopy: 'Could not copy.',
  signedInClose: 'Signed in. You can close this window.',
  creatingVault: 'Creating the vault…',
  vaultError: 'The vault could not be created.',
  invalidUsername: 'Use 2–24 letters, numbers, or underscores.',
  invalidAddress: 'Enter a Solana address or a 0x address.',
  saved: 'Saved',
  awaitingBridge: 'The agent bridge is not running.',
  pairExpired: 'That pairing code expired. Copy a new prompt.',
  tokenRejected: 'That token was not recognized.',
  walletNotReady: 'Wallets are not ready yet.',
  optional: 'Optional',
  clientIdHint: 'From the Privy dashboard, if your app client requires one.',
  navWallet: 'Wallet',
  navAgent: 'Agent',
  navActivity: 'Activity',
  navSettings: 'Settings',
  primaryNav: 'Primary',
  mainnet: 'Mainnet',
  showAddresses: 'Wallet addresses',
  confirmTestnet: 'Confirm test network',
  rejectTestnet: 'Reject',
  pairExpiredHint: 'Pairing codes last 10 minutes and can be removed.',
  noAgentsBound: 'No agent is bound. Copy a prompt to start.',
  bridgeMissing: 'Not connected on this computer.',
  savedQuiet: 'Saved on this device.',
  methodBalance: 'Balance',
  methodSign: 'Sign',
  methodSend: 'Send',
} as const;

export type CopyKey = keyof typeof EN;

const ZH_CN: Record<CopyKey, string> = {
  appName: 'SpaceXpad agent wallet',
  mark: 'SpaceXpad',
  signIn: '登录',
  loginNote: 'Privy 会创建保险库并保管密钥。没有助记词。',
  continueGmail: '使用 Gmail 继续',
  email: '邮箱',
  sendCode: '把验证码发到邮箱',
  code: '验证码',
  confirmCode: '确认验证码',
  codeSent: '验证码已发送。',
  working: '处理中…',
  setupTitle: '填写 Privy App ID',
  setupBody:
    '这个安装包没有内置 App ID。请创建 Privy 应用，打开邮箱和 Gmail 登录，以及 Ethereum 与 Solana 嵌入式钱包，然后把 App ID 贴到这里。',
  extensionId: '扩展 ID',
  redirectUrl: 'OAuth 回调',
  privyAppId: 'Privy App ID',
  privyClientId: 'Privy client ID',
  save: '保存',
  settings: '设置',
  username: '用户名',
  usernameHint: '只显示在这台设备上。别人也可以用同样的名字。登录用的是 Privy 用户 ID，不是这个名字。',
  language: '语言',
  assets: '资产',
  mainnetHint: '这些是主网余额。除非你指定测试网，代理也使用主网。',
  readingMainnet: '正在读取主网…',
  explicitNetwork: '因为代理指定了这个网络，所以单独显示。',
  agents: '代理',
  bindTitle: '绑定代理',
  bindIntro: '把提示词交给代理。连接在这台电脑上。https://spacexpad.xyz/agent-wallet/ 预留给这个钱包，还没有发布。再贴回代理给出的绑定令牌。10 分钟内有效。',
  copyPrompt: '复制提示词',
  promptCopied: '提示词已复制',
  showPrompt: '查看提示词',
  hidePrompt: '收起提示词',
  tokenLabel: '绑定令牌',
  bindAction: '绑定',
  unbind: '移除',
  noAgents: '还没有绑定代理。',
  activity: '最近活动',
  noActivity: '还没有活动。',
  pause: '暂停全部代理',
  resume: '恢复',
  paused: '代理已暂停。',
  risk: '风险策略',
  fullAccess: '完全访问',
  fullAccessHelp: '签名和发送不受美元限额。总开关和白名单仍然有效。',
  useLimits: '启用美元限额',
  singleLimit: '单笔限额（美元）',
  dailyLimit: '每日限额（美元）',
  whitelist: '已审计协议白名单',
  whitelistHelp: '打开后，只有目标地址在名单里才允许签名。原生转账核对收款人，合约调用核对合约地址。',
  whitelistEmpty: '名单是空的。白名单打开时，不会签名。',
  add: '添加',
  address: '地址',
  label: '名称',
  remove: '移除',
  bridge: '代理桥',
  bridgeToken: '桥令牌',
  bridgeHelp: '在这个仓库运行 node --experimental-strip-types mcp/src/index.ts。把标准错误里的桥令牌贴过来。它也会写在 ~/.spacexpad-agent-wallet/bridge.json。不要分享。',
  bridgeConnected: '桥已连接',
  bridgeDisconnected: '桥未连接',
  bridgeRejected: '桥令牌被拒绝',
  logout: '退出',
  refresh: '刷新',
  copied: '已复制',
  copyAddress: '复制地址',
  couldNotCopy: '无法复制。',
  signedInClose: '已登录。可以关闭这个窗口。',
  creatingVault: '正在创建保险库…',
  vaultError: '保险库没有创建成功。',
  invalidUsername: '请使用 2–24 位字母、数字或下划线。',
  invalidAddress: '请输入 Solana 地址或 0x 地址。',
  saved: '已保存',
  awaitingBridge: '代理桥没有在运行。',
  pairExpired: '配对码已过期。请重新复制提示词。',
  tokenRejected: '无法识别这个令牌。',
  walletNotReady: '钱包还没准备好。',
  optional: '可选',
  clientIdHint: '如果 Privy 应用客户端要求，从控制台复制。',
  navWallet: '钱包',
  navAgent: '代理',
  navActivity: '活动',
  navSettings: '设置',
  primaryNav: '主导航',
  mainnet: '主网',
  showAddresses: '钱包地址',
  confirmTestnet: '确认测试网',
  rejectTestnet: '拒绝',
  pairExpiredHint: '配对码 10 分钟内有效，绑定后可以移除。',
  noAgentsBound: '还没有绑定代理。复制提示词开始。',
  bridgeMissing: '这台电脑还没接通。',
  savedQuiet: '已保存在这台设备上。',
  methodBalance: '余额',
  methodSign: '签名',
  methodSend: '发送',
};

const ZH_TW: Record<CopyKey, string> = {
  appName: 'SpaceXpad agent wallet',
  mark: 'SpaceXpad',
  signIn: '登入',
  loginNote: 'Privy 會建立金庫並保管金鑰。沒有助記詞。',
  continueGmail: '使用 Gmail 繼續',
  email: '電子郵件',
  sendCode: '把驗證碼寄到信箱',
  code: '驗證碼',
  confirmCode: '確認驗證碼',
  codeSent: '驗證碼已寄出。',
  working: '處理中…',
  setupTitle: '填入 Privy App ID',
  setupBody:
    '這個安裝包沒有內建 App ID。請建立 Privy 應用、開啟電子郵件與 Gmail 登入，以及 Ethereum 和 Solana 嵌入式錢包，然後把 App ID 貼在這裡。',
  extensionId: '擴充功能 ID',
  redirectUrl: 'OAuth 重新導向',
  privyAppId: 'Privy App ID',
  privyClientId: 'Privy client ID',
  save: '儲存',
  settings: '設定',
  username: '使用者名稱',
  usernameHint: '只顯示在這台裝置上。別人也可以用同樣的名稱。登入用的是 Privy 使用者 ID，不是這個名稱。',
  language: '語言',
  assets: '資產',
  mainnetHint: '這些是主網餘額。除非你指定測試網，代理也使用主網。',
  readingMainnet: '正在讀取主網…',
  explicitNetwork: '因為代理指定了這個網路，所以另外顯示。',
  agents: '代理',
  bindTitle: '綁定代理',
  bindIntro: '把提示詞交給代理。連線在這台電腦上。https://spacexpad.xyz/agent-wallet/ 預留給這個錢包，還沒有發布。再貼回代理回傳的綁定權杖。10 分鐘內有效。',
  copyPrompt: '複製提示詞',
  promptCopied: '提示詞已複製',
  showPrompt: '查看提示詞',
  hidePrompt: '收合提示詞',
  tokenLabel: '綁定權杖',
  bindAction: '綁定',
  unbind: '移除',
  noAgents: '尚未綁定代理。',
  activity: '最近活動',
  noActivity: '還沒有活動。',
  pause: '暫停全部代理',
  resume: '恢復',
  paused: '代理已暫停。',
  risk: '風險原則',
  fullAccess: '完整存取',
  fullAccessHelp: '簽名與送出不受美元上限。總開關與白名單仍然有效。',
  useLimits: '啟用美元上限',
  singleLimit: '單筆上限（美元）',
  dailyLimit: '每日上限（美元）',
  whitelist: '已審計協議白名單',
  whitelistHelp: '開啟後，只有目標位址在名單中才允許簽名。原生轉帳核對收款人，合約呼叫核對合約位址。',
  whitelistEmpty: '名單是空的。白名單開啟時不會簽名。',
  add: '新增',
  address: '位址',
  label: '名稱',
  remove: '移除',
  bridge: '代理橋',
  bridgeToken: '橋接權杖',
  bridgeHelp: '在這個儲存庫執行 node --experimental-strip-types mcp/src/index.ts。把標準錯誤裡的橋接權杖貼過來。它也會寫入 ~/.spacexpad-agent-wallet/bridge.json。不要分享。',
  bridgeConnected: '橋已連線',
  bridgeDisconnected: '橋未連線',
  bridgeRejected: '橋接權杖被拒絕',
  logout: '登出',
  refresh: '重新整理',
  copied: '已複製',
  copyAddress: '複製位址',
  couldNotCopy: '無法複製。',
  signedInClose: '已登入。可以關閉這個視窗。',
  creatingVault: '正在建立金庫…',
  vaultError: '金庫沒有建立成功。',
  invalidUsername: '請使用 2–24 個字母、數字或底線。',
  invalidAddress: '請輸入 Solana 位址或 0x 位址。',
  saved: '已儲存',
  awaitingBridge: '代理橋沒有在執行。',
  pairExpired: '配對碼已過期。請重新複製提示詞。',
  tokenRejected: '無法辨識這個權杖。',
  walletNotReady: '錢包還沒準備好。',
  optional: '選填',
  clientIdHint: '如果 Privy 應用用戶端需要，從控制台複製。',
  navWallet: '錢包',
  navAgent: '代理',
  navActivity: '活動',
  navSettings: '設定',
  primaryNav: '主要導覽',
  mainnet: '主網',
  showAddresses: '錢包位址',
  confirmTestnet: '確認測試網',
  rejectTestnet: '拒絕',
  pairExpiredHint: '配對碼 10 分鐘內有效，綁定後可以移除。',
  noAgentsBound: '尚未綁定代理。複製提示詞開始。',
  bridgeMissing: '這台電腦還沒接通。',
  savedQuiet: '已儲存在這台裝置上。',
  methodBalance: '餘額',
  methodSign: '簽名',
  methodSend: '送出',
};

const TABLES: Record<Lang, Record<CopyKey, string>> = {
  en: EN,
  'zh-CN': ZH_CN,
  'zh-TW': ZH_TW,
};

export function t(lang: Lang, key: CopyKey): string {
  return TABLES[lang][key];
}

export function copyKeys(): CopyKey[] {
  return Object.keys(EN) as CopyKey[];
}

export function chainName(lang: Lang, chain: ChainId): string {
  const names: Record<Lang, Record<ChainId, string>> = {
    en: { solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bnb: 'BNB Chain' },
    'zh-CN': { solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bnb: 'BNB Chain' },
    'zh-TW': { solana: 'Solana', ethereum: 'Ethereum', base: 'Base', bnb: 'BNB Chain' },
  };
  return names[lang][chain];
}

export function testnetConfirmCopy(
  lang: Lang,
  method: 'sign' | 'send',
  agent: string,
  chain: ChainId,
  network: NetworkId,
): string {
  const where = `${chainName(lang, chain)} ${clusterLabel(lang, chain, network)}`;
  if (lang === 'zh-CN') {
    const action = method === 'send' ? '发送' : '签名';
    return `${agent} 请求在 ${where} ${action}。这是测试网，确认后才会继续。`;
  }
  if (lang === 'zh-TW') {
    const action = method === 'send' ? '送出' : '簽名';
    return `${agent} 要求在 ${where} ${action}。這是測試網，確認後才會繼續。`;
  }
  const action = method === 'send' ? 'send' : 'sign';
  return `${agent} asked to ${action} on ${where}. This is a test network. Nothing is signed until you confirm.`;
}

export function clusterLabel(lang: Lang, chain: ChainId, network: NetworkId): string {
  if (chain === 'solana' && network === 'devnet') {
    return lang === 'en' ? 'Devnet' : lang === 'zh-CN' ? 'Devnet' : 'Devnet';
  }
  if (network === 'mainnet') return lang === 'en' ? 'Mainnet' : lang === 'zh-CN' ? '主网' : '主網';
  if (chain === 'ethereum') return 'Sepolia';
  if (chain === 'base') return 'Base Sepolia';
  return lang === 'en' ? 'BSC testnet' : lang === 'zh-CN' ? 'BSC 测试网' : 'BSC 測試網';
}

export function policyText(lang: Lang, denial: Denial): string {
  switch (denial.code) {
    case 'paused':
      return lang === 'zh-CN' ? '代理已暂停。' : lang === 'zh-TW' ? '代理已暫停。' : 'Agents are paused.';
    case 'whitelist-empty':
      return lang === 'zh-CN'
        ? '白名单是空的，所以没有签名。'
        : lang === 'zh-TW'
          ? '白名單是空的，所以沒有簽名。'
          : 'The whitelist is empty, so nothing was signed.';
    case 'whitelist-unknown':
      return lang === 'zh-CN'
        ? '读不出目标地址，白名单因此拦住了这笔请求。'
        : lang === 'zh-TW'
          ? '讀不出目標位址，白名單因此攔住了這筆請求。'
          : 'The destination could not be read, so the whitelist blocked this request.';
    case 'whitelist-miss':
      return lang === 'zh-CN'
        ? `${denial.address ?? ''} 不在白名单里。`
        : lang === 'zh-TW'
          ? `${denial.address ?? ''} 不在白名單裡。`
          : `${denial.address ?? ''} is not on the whitelist.`;
    case 'unpriced':
      return lang === 'zh-CN'
        ? '无法确定美元价值，限额策略拦住了这笔请求。'
        : lang === 'zh-TW'
          ? '無法確定美元價值，限額原則攔住了這筆請求。'
          : 'The USD value could not be priced, so the limit policy blocked this request.';
    case 'single-limit':
      return lang === 'zh-CN'
        ? `这笔约 $${denial.usd}，超过单笔限额 $${denial.limit}。`
        : lang === 'zh-TW'
          ? `這筆約 $${denial.usd}，超過單筆上限 $${denial.limit}。`
          : `This request is about $${denial.usd}, above the single-transaction limit of $${denial.limit}.`;
    case 'daily-limit':
      return lang === 'zh-CN'
        ? `今日已用 $${denial.spent}，这笔约 $${denial.usd}，超过每日限额 $${denial.limit}。`
        : lang === 'zh-TW'
          ? `今日已用 $${denial.spent}，這筆約 $${denial.usd}，超過每日上限 $${denial.limit}。`
          : `Spent $${denial.spent} today. This request is about $${denial.usd}, above the daily limit of $${denial.limit}.`;
    case 'limits-unset':
      return lang === 'zh-CN'
        ? '限额模式没有填写单笔或每日限额。'
        : lang === 'zh-TW'
          ? '限額模式沒有填寫單筆或每日上限。'
          : 'Limit mode is on, but neither a single-transaction nor a daily limit is set.';
    default:
      return lang === 'en' ? 'Blocked by policy.' : '已被策略拦住。';
  }
}
