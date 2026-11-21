const STORE_KEY = 'spacexpad';

chrome.runtime.onInstalled.addListener(() => {
  void ensureOffscreen();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureOffscreen();
});

chrome.alarms.onAlarm.addListener(() => {
  void ensureOffscreen();
});

void chrome.alarms.create('spacexpad-offscreen', { periodInMinutes: 1 });

chrome.runtime.onMessage.addListener((message: { type?: string; store?: unknown }, _sender, sendResponse) => {
  if (message?.type === 'STORE_GET') {
    void (async () => {
      const data = await chrome.storage.local.get(STORE_KEY);
      sendResponse(data[STORE_KEY] ?? null);
    })();
    return true;
  }
  if (message?.type === 'STORE_SET') {
    void (async () => {
      await chrome.storage.local.set({ [STORE_KEY]: message.store });
      sendResponse(true);
    })();
    return true;
  }
  return undefined;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORE_KEY]) return;
  chrome.runtime.sendMessage({ type: 'STORE_CHANGED', store: changes[STORE_KEY].newValue }, () => {
    void chrome.runtime.lastError;
  });
});

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.LOCAL_STORAGE],
    justification:
      'Restore the Privy session from extension local storage and keep the agent bridge available while the popup is closed.',
  });
}
