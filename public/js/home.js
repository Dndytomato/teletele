(async function () {
  const username = await window.Onboarding.ensureUsername();
  const badge = document.getElementById('username-badge');
  badge.textContent = username;
  badge.addEventListener('click', async () => {
    const newName = await window.Onboarding.changeUsername(badge.textContent);
    badge.textContent = newName;
  });
})();
