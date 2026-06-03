document.getElementById('open-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('app/app.html') });
  window.close();
});
