(async function () {
  const app = document.getElementById('app');
  const token = window.location.pathname.split('/turn/')[1];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  async function fetchTurn() {
    return window.Device.apiFetch(`/turns/${token}`);
  }

  function renderNotFound() {
    app.innerHTML = `
      <h1>링크를 찾을 수 없어요</h1>
      <p class="subtitle">유효하지 않은 링크입니다. 링크를 다시 확인해주세요.</p>
    `;
  }

  function renderAlreadyParticipated() {
    app.innerHTML = `
      <h1>이미 참여하셨어요</h1>
      <p class="subtitle">이 게임에는 이미 참여하셨기 때문에 이 턴에는 참여할 수 없어요.</p>
      <a href="/" class="btn btn-secondary">홈으로</a>
    `;
  }

  function renderClaimedByOther() {
    app.innerHTML = `
      <h1>이미 다른 사람이 참여했어요</h1>
      <p class="subtitle">이 링크는 이미 다른 사람이 시작한 턴이에요.</p>
      <a href="/" class="btn btn-secondary">홈으로</a>
    `;
  }

  function renderParticipantList(priorParticipants, currentTurnIndex) {
    if (!priorParticipants || priorParticipants.length === 0) return '';
    const items = priorParticipants
      .map((p) => {
        const isImmediatelyPrevious = p.turnIndex === currentTurnIndex - 1;
        const actionLabel = p.type === 'word' ? '제시어 작성' : '그림 그리기';
        return `<li class="${isImmediatelyPrevious ? 'highlight' : ''}">
          <span>${p.turnIndex}번 · ${escapeHtml(p.username || '익명')}</span>
          <span>${actionLabel}</span>
        </li>`;
      })
      .join('');
    return `<ul class="participant-list">${items}</ul>`;
  }

  function renderPending(data) {
    const isDrawTurn = data.type === 'drawing';
    const instruction = isDrawTurn
      ? '바로 앞 사람이 적은 제시어를 보고, 그림으로 표현해주세요.'
      : '바로 앞 사람이 그린 그림을 보고, 무엇인지 맞혀주세요.';
    app.innerHTML = `
      <h1>${data.turnIndex}번째 참여자예요</h1>
      <p class="subtitle">${instruction}</p>
      <div class="card">
        <h2>지금까지 참여한 사람</h2>
        ${renderParticipantList(data.priorParticipants, data.turnIndex)}
        <p class="hint">시작을 누르면 30초의 시간이 주어져요. 준비되었을 때 눌러주세요.</p>
        <button id="start-btn" class="btn btn-primary">시작</button>
      </div>
    `;
    document.getElementById('start-btn').addEventListener('click', onStartClick);
  }

  async function onStartClick() {
    const btn = document.getElementById('start-btn');
    btn.disabled = true;
    const res = await window.Device.apiFetch(`/turns/${token}/claim`, { method: 'POST' });
    if (!res.ok) {
      if (res.data && res.data.error === 'already_participated') {
        renderAlreadyParticipated();
      } else {
        renderClaimedByOther();
      }
      return;
    }
    renderActiveTurn(res.data);
  }

  let autosaveInFlight = false;
  async function sendAutosave(content) {
    if (autosaveInFlight) return;
    autosaveInFlight = true;
    try {
      await window.Device.apiFetch(`/turns/${token}/autosave`, {
        method: 'POST',
        body: { content },
      });
    } finally {
      autosaveInFlight = false;
    }
  }

  function renderActiveTurn({ type, previousContent, deadlineAt }) {
    const promptHtml =
      previousContent && previousContent.type === 'word'
        ? `<div class="prompt-word">${escapeHtml(previousContent.value)}</div>`
        : previousContent && previousContent.type === 'drawing'
        ? `<img class="prompt-image" src="${previousContent.value}" alt="이전 그림" />`
        : `<p class="hint">(이전 내용 없음)</p>`;

    app.innerHTML = `
      <h1>${type === 'drawing' ? '그려주세요!' : '맞혀주세요!'}</h1>
      <div class="timer" id="timer">30</div>
      <div class="card">
        ${promptHtml}
        <div id="input-area" style="margin-top: 16px"></div>
        <button id="submit-btn" class="btn btn-primary" style="margin-top: 16px">제출</button>
      </div>
    `;

    const inputArea = document.getElementById('input-area');
    let getContent;

    if (type === 'drawing') {
      const canvasApi = window.DrawingCanvas.mountDrawingCanvas(inputArea, {
        onChange: debounce(() => sendAutosave(canvasApi.getDataUrl()), 500),
      });
      getContent = () => canvasApi.getDataUrl();
    } else {
      inputArea.innerHTML = `<input type="text" id="word-input" maxlength="40" placeholder="정답을 입력하세요" autocomplete="off" />`;
      const wordInput = document.getElementById('word-input');
      wordInput.focus();
      const debouncedSave = debounce(() => sendAutosave(wordInput.value), 600);
      wordInput.addEventListener('input', debouncedSave);
      getContent = () => wordInput.value.trim();
    }

    const submitBtn = document.getElementById('submit-btn');
    const timerEl = document.getElementById('timer');
    let finished = false;

    async function finishTurn(autoTriggered) {
      if (finished) return;
      finished = true;
      clearInterval(tickHandle);
      submitBtn.disabled = true;
      submitBtn.textContent = autoTriggered ? '시간 종료, 제출 중...' : '제출 중...';

      const content = getContent();
      if (content && content.length > 0) {
        await window.Device.apiFetch(`/turns/${token}/submit`, {
          method: 'POST',
          body: { content },
        });
      }
      await waitForFinalizeAndRender();
    }

    submitBtn.addEventListener('click', () => finishTurn(false));

    const tickHandle = setInterval(() => {
      const remaining = Math.max(0, deadlineAt - Date.now());
      const seconds = Math.ceil(remaining / 1000);
      timerEl.textContent = String(seconds);
      timerEl.classList.toggle('low', seconds <= 10);
      if (remaining <= 0) {
        finishTurn(true);
      }
    }, 200);
  }

  async function waitForFinalizeAndRender(attempt = 0) {
    const res = await fetchTurn();
    if (!res.ok) {
      renderNotFound();
      return;
    }
    const data = res.data;
    if (data.status === 'claimed' && data.isMine && attempt < 15) {
      setTimeout(() => waitForFinalizeAndRender(attempt + 1), 500);
      return;
    }
    renderFromData(data);
  }

  function renderSubmittedMine(data) {
    if (data.gameStatus === 'completed') {
      app.innerHTML = `
        <h1>🎉 게임 완성!</h1>
        <p class="subtitle">모든 참여자가 제출을 마쳤어요. 결과를 확인해보세요.</p>
        <a href="/result/${data.gameId}" class="btn btn-primary">결과 보러가기</a>
      `;
      return;
    }

    app.innerHTML = `
      <h1>이 그림/제시어를 누구에게 전달할까요?</h1>
      <p class="subtitle">공유 버튼을 누르면 카카오톡, 인스타그램 등에서 친구를 골라 보낼 수 있어요.<br />*마지막 타자가 제시어를 입력 완료한 후에 게임 결과를 볼 수 있어요!</p>
      <div class="card">
        <button id="next-btn" class="btn btn-primary">다음 참여자 지정</button>
        <div id="link-box" class="share-url-box" hidden></div>
      </div>
    `;

    document.getElementById('next-btn').addEventListener('click', async () => {
      const btn = document.getElementById('next-btn');
      btn.disabled = true;
      let nextUrl = data.nextTurn && data.nextTurn.url;
      if (!nextUrl) {
        const res = await window.Device.apiFetch(`/turns/${token}/next`, { method: 'POST' });
        if (!res.ok) {
          btn.disabled = false;
          return;
        }
        nextUrl = res.data.nextUrl;
      }
      const result = await window.ShareUtil.shareLink({
        title: '직장인 텔레스트레이션',
        text: '내 차례가 끝났어요! 다음 사람이 되어주세요.',
        url: nextUrl,
      });
      btn.disabled = false;
      if (result.method === 'clipboard' || result.method === 'manual') {
        const box = document.getElementById('link-box');
        box.hidden = false;
        box.textContent = (result.url || nextUrl) + ' (채팅방에 복사해서 붙여넣어 주세요)';
      }
    });
  }

  function renderSubmittedOther(data) {
    app.innerHTML = `
      <h1>이미 제출되었어요</h1>
      <p class="subtitle">이 턴은 이미 다른 사람이 완료했어요.</p>
      ${
        data.gameStatus === 'completed'
          ? `<a href="/result/${data.gameId}" class="btn btn-primary">결과 보러가기</a>`
          : ''
      }
      <a href="/" class="btn btn-secondary" style="margin-top: 8px">홈으로</a>
    `;
  }

  function renderFromData(data) {
    if (data.status === 'pending') {
      if (data.alreadyParticipated) {
        renderAlreadyParticipated();
      } else {
        renderPending(data);
      }
      return;
    }
    if (data.status === 'claimed') {
      if (data.isMine) {
        renderActiveTurn({
          type: data.type,
          previousContent: data.previousContent,
          deadlineAt: data.deadlineAt,
        });
      } else {
        renderClaimedByOther();
      }
      return;
    }
    if (data.status === 'submitted') {
      if (data.isMine) {
        renderSubmittedMine(data);
      } else {
        renderSubmittedOther(data);
      }
      return;
    }
    renderNotFound();
  }

  async function main() {
    await window.Onboarding.ensureUsername();
    const res = await fetchTurn();
    if (!res.ok) {
      renderNotFound();
      return;
    }
    renderFromData(res.data);
  }

  main();
})();
