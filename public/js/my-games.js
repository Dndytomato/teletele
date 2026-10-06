(async function () {
  const app = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') === 'completed' ? 'completed' : 'in_progress';

  function formatDate(sqliteDatetime) {
    const d = new Date(sqliteDatetime.replace(' ', 'T') + 'Z');
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  function renderEmpty(label) {
    app.innerHTML = `
      <h1>${label}</h1>
      <p class="subtitle">아직 ${label === '완료된 게임' ? '완료한' : '진행 중인'} 게임이 없어요.</p>
      <a href="/" class="btn btn-secondary">홈으로</a>
    `;
  }

  function renderCompletedList(games) {
    const items = games
      .map(
        (g) => `
      <a href="/result/${g.gameId}" class="game-list-item">
        <div>
          <div class="game-list-title">참여자 ${g.participantCount}명 게임</div>
          <div class="game-list-sub">${formatDate(g.createdAt)} 완료</div>
        </div>
        <span class="game-list-arrow">→</span>
      </a>
    `
      )
      .join('');
    app.innerHTML = `
      <h1>완료된 게임</h1>
      <p class="subtitle">내가 참여했던 완성된 릴레이를 다시 볼 수 있어요.</p>
      <div class="game-list">${items}</div>
      <a href="/" class="btn btn-secondary" style="margin-top: 16px">홈으로</a>
    `;
  }

  function renderInProgressList(games) {
    const items = games
      .map((g) => {
        const href = g.myLastTurnToken ? `/turn/${g.myLastTurnToken}` : '#';
        return `
      <a href="${href}" class="game-list-item">
        <div>
          <div class="game-list-title">참여자 ${g.participantCount}명 게임</div>
          <div class="game-list-sub">${g.submittedCount} / ${g.participantCount}명 제출 · ${formatDate(g.createdAt)} 시작</div>
        </div>
        <span class="game-list-arrow">→</span>
      </a>
    `;
      })
      .join('');
    app.innerHTML = `
      <h1>진행중 게임</h1>
      <p class="subtitle">내가 참여한 게임의 진행 상태예요. 눌러서 내 턴으로 돌아갈 수 있어요.</p>
      <div class="game-list">${items}</div>
      <a href="/" class="btn btn-secondary" style="margin-top: 16px">홈으로</a>
    `;
  }

  async function main() {
    await window.Onboarding.ensureUsername();
    const res = await window.Device.apiFetch(`/devices/me/games?status=${status}`);
    if (!res.ok) {
      app.innerHTML = `<h1>오류가 발생했어요</h1><a href="/" class="btn btn-secondary">홈으로</a>`;
      return;
    }
    const games = res.data.games;
    if (games.length === 0) {
      renderEmpty(status === 'completed' ? '완료된 게임' : '진행중 게임');
      return;
    }
    if (status === 'completed') {
      renderCompletedList(games);
    } else {
      renderInProgressList(games);
    }
  }

  main();
})();
