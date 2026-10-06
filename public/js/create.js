(async function () {
  await window.Onboarding.ensureUsername();

  const wordInput = document.getElementById('word');
  const countInput = document.getElementById('count');
  const countHint = document.getElementById('count-hint');
  const submitBtn = document.getElementById('submit-btn');
  const errorEl = document.getElementById('error');

  function isValidCount(n) {
    return Number.isInteger(n) && n >= 3 && n <= 21 && n % 2 === 1;
  }

  function validate() {
    const n = parseInt(countInput.value, 10);
    const valid = isValidCount(n) && wordInput.value.trim().length > 0;
    submitBtn.disabled = !valid;
    countHint.textContent = isValidCount(n)
      ? `참여자 ${n}명 (1번: 나, ${n}번: 마지막 참여자)`
      : '참가자 수는 홀수여야 해요 (최소 3명, 최대 21명).';
    return valid;
  }

  wordInput.addEventListener('input', validate);
  countInput.addEventListener('input', validate);
  validate();

  submitBtn.addEventListener('click', async () => {
    errorEl.hidden = true;
    const n = parseInt(countInput.value, 10);
    if (!validate()) return;
    submitBtn.disabled = true;
    const res = await window.Device.apiFetch('/games', {
      method: 'POST',
      body: { startingWord: wordInput.value.trim(), participantCount: n },
    });
    if (!res.ok) {
      errorEl.textContent = '게임을 만들지 못했어요. 입력값을 확인해주세요.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      return;
    }
    window.location.href = `/turn/${res.data.turn1Token}`;
  });
})();
