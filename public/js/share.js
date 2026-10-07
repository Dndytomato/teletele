(function () {
  let kakaoReadyPromise = null;

  // Resolves to true only if the Kakao SDK script loaded AND a JS key is configured
  // server-side AND Kakao.init() succeeds. Memoized so we only hit /api/config once.
  function ensureKakao() {
    if (kakaoReadyPromise) return kakaoReadyPromise;
    kakaoReadyPromise = (async () => {
      if (typeof Kakao === 'undefined') return false;
      try {
        if (Kakao.isInitialized && Kakao.isInitialized()) return true;
        const res = await window.Device.apiFetch('/config');
        const key = res.data && res.data.kakaoJsKey;
        if (!key) return false;
        Kakao.init(key);
        return Kakao.isInitialized();
      } catch (e) {
        return false;
      }
    })();
    return kakaoReadyPromise;
  }

  function shareViaKakao(absoluteUrl, title, text) {
    try {
      Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: title || '텔레스트레이션',
          description: text || '',
          imageUrl: new URL('/img/share-banner.png', window.location.origin).toString(),
          link: { mobileWebUrl: absoluteUrl, webUrl: absoluteUrl },
        },
        buttons: [
          {
            title: '참여하기',
            link: { mobileWebUrl: absoluteUrl, webUrl: absoluteUrl },
          },
        ],
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Share flow: native OS share sheet first; if that's unavailable (common inside
  // KakaoTalk's in-app browser, which doesn't implement navigator.share) or fails
  // for a reason other than the user deliberately cancelling, fall back to Kakao's
  // own SDK (works inside KakaoTalk's in-app browser too); last resort is clipboard.
  async function shareLink({ title, text, url }) {
    const absoluteUrl = new URL(url, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: absoluteUrl });
        return { method: 'share' };
      } catch (e) {
        if (e && e.name === 'AbortError') {
          return { method: 'cancelled' };
        }
        // fall through
      }
    }

    if (await ensureKakao()) {
      if (shareViaKakao(absoluteUrl, title, text)) {
        return { method: 'kakao' };
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
