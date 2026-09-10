// Problems that happen away from any extension page (context menu, shortcuts,
// form filling) show a badge on the toolbar icon; the popup displays the message.

export async function notify(message) {
  await chrome.storage.session.set({ notice: message });
  await chrome.action.setBadgeBackgroundColor({ color: '#D1007B' });
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setTitle({ title: `QuickRoute: ${message}` });
}

export async function clearNotice() {
  await chrome.storage.session.remove('notice');
  await chrome.action.setBadgeText({ text: '' });
  await chrome.action.setTitle({ title: 'QuickRoute' });
}
