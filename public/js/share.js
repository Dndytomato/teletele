(function () {
  async function shareLink({ title, text, url }) {
    const absoluteUrl = new URL(url, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return { method: 'share' };
      } catch (e) {
        // user cancelled the share sheet, or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      return { method: 'clipboard', url: absoluteUrl };
    } catch (e) {
      return { method: 'manual', url: absoluteUrl };
    }
  }

  window.ShareUtil = { shareLink };
})();
