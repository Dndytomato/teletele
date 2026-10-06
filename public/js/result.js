(async function () {
  const app = document.getElementById('app');
  const gameId = window.location.pathname.split('/result/')[1];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderInProgress(data) {
    app.innerHTML = `
      <h1>아직 진행 중이에요</h1>
      <p class="subtitle">${data.submittedCount} / ${data.totalCount}명이 제출했어요. 모두 끝나면 결과를 볼 수 있어요.</p>
      <a href="/" class="btn btn-secondary">홈으로</a>
    `;
  }

  function renderTurnCard(t) {
    const body =
      t.type === 'word'
        ? `<div class="prompt-word">${t.content ? escapeHtml(t.content) : '(응답 없음)'}</div>`
        : t.content
        ? `<img class="prompt-image" src="${t.content}" alt="턴 ${t.turnIndex} 그림" />`
        : `<p class="hint">(응답 없음)</p>`;
    return `
      <div class="carousel-card">
        <div class="turn-label">${t.turnIndex}번째 턴 · ${t.type === 'word' ? '제시어' : '그림'}</div>
        ${body}
        <div class="author">${escapeHtml(t.username)}</div>
      </div>
    `;
  }

  // Turn parity always alternates word/drawing, so grouping two consecutive turns
  // per page naturally pairs each prompt with the drawing made for it. With an odd
  // total turn count, the very last turn (the final guess) is left alone on its own page.
  function renderCompleted(turns) {
    const pages = [];
    for (let i = 0; i < turns.length; i += 2) {
      pages.push(turns.slice(i, i + 2));
    }
    const pagesHtml = pages
      .map((pair) => `<div class="carousel-page">${pair.map(renderTurnCard).join('')}</div>`)
      .join('');

    app.innerHTML = `
      <h1>🎉 완성된 릴레이</h1>
      <p class="subtitle">위아래로 넘기면서 전체 릴레이를 확인해보세요.</p>
      <div class="carousel-vertical" id="carousel">${pagesHtml}</div>
      <div class="carousel-nav">
        <button id="prev-btn">↑ 이전</button>
        <button id="next-btn">↓ 다음</button>
      </div>
      <a href="/" class="btn btn-secondary" style="margin-top: 16px">새 게임 만들기</a>
    `;

    const carousel = document.getElementById('carousel');
    const pageHeight = () => carousel.querySelector('.carousel-page').offsetHeight;
    document.getElementById('prev-btn').addEventListener('click', () => {
      carousel.scrollBy({ top: -pageHeight(), behavior: 'smooth' });
    });
    document.getElementById('next-btn').addEventListener('click', () => {
      carousel.scrollBy({ top: pageHeight(), behavior: 'smooth' });
    });
  }

  async function main() {
    const res = await window.Device.apiFetch(`/games/${gameId}/result`);
    if (res.status === 404) {
      app.innerHTML = `<h1>게임을 찾을 수 없어요</h1><a href="/" class="btn btn-secondary">홈으로</a>`;
      return;
    }
    if (res.status === 409) {
      renderInProgress(res.data);
      return;
    }
    if (!res.ok) {
      app.innerHTML = `<h1>오류가 발생했어요</h1><a href="/" class="btn btn-secondary">홈으로</a>`;
      return;
    }
    renderCompleted(res.data.turns);
  }

  main();
})();
