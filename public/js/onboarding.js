(function () {
  async function ensureUsername() {
    const me = await window.Device.apiFetch('/devices/me');
    if (me.data && me.data.username) {
      return me.data.username;
    }
    return showUsernameModal();
  }

  function showUsernameModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box">
          <h2>닉네임을 정해주세요</h2>
          <p class="modal-sub">이 기기에서 계속 사용할 닉네임이에요.</p>
          <input type="text" id="onboarding-username" maxlength="20" placeholder="닉네임 입력" autofocus />
          <p class="modal-error" id="onboarding-error" hidden></p>
          <button id="onboarding-submit" class="btn btn-primary">시작하기</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#onboarding-username');
      const errorEl = overlay.querySelector('#onboarding-error');
      const submitBtn = overlay.querySelector('#onboarding-submit');

      async function submit() {
        const username = input.value.trim();
        if (!username) {
          errorEl.textContent = '닉네임을 입력해주세요.';
          errorEl.hidden = false;
          return;
        }
        submitBtn.disabled = true;
        const res = await window.Device.apiFetch('/devices/username', {
          method: 'POST',
          body: { username },
        });
        if (!res.ok) {
          errorEl.textContent = '닉네임을 다시 확인해주세요 (최대 20자).';
          errorEl.hidden = false;
          submitBtn.disabled = false;
          return;
        }
        overlay.remove();
        resolve(res.data.username);
      }

      submitBtn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
    });
  }

  window.Onboarding = { ensureUsername };
})();
