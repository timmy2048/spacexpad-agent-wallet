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
