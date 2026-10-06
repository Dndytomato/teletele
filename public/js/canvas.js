(function () {
  const PEN_WIDTH = 6;
  const COLORS = ['#222222', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#9c36b5'];

  function mountDrawingCanvas(container, { onChange } = {}) {
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'canvas-wrap';

    const palette = document.createElement('div');
    palette.className = 'canvas-palette';

    const canvas = document.createElement('canvas');
    canvas.className = 'drawing-canvas';

    wrap.appendChild(palette);
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const size = Math.min(window.innerWidth * 0.92, 480);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = PEN_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    let currentColor = COLORS[0];
    let hasDrawn = false;

    COLORS.forEach((color, i) => {
      const swatch = document.createElement('button');
      swatch.className = 'color-swatch' + (i === 0 ? ' selected' : '');
      swatch.style.backgroundColor = color;
      swatch.type = 'button';
      swatch.addEventListener('click', () => {
        currentColor = color;
        palette.querySelectorAll('.color-swatch').forEach((el) => el.classList.remove('selected'));
        swatch.classList.add('selected');
      });
      palette.appendChild(swatch);
    });

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e) {
      drawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
      canvas.setPointerCapture(e.pointerId);
    }

    function move(e) {
      if (!drawing) return;
      const pos = getPos(e);
      ctx.strokeStyle = currentColor;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
    }

    function end() {
      if (!drawing) return;
      drawing = false;
      if (onChange) onChange();
    }

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    return {
      getDataUrl() {
        return canvas.toDataURL('image/png');
      },
      hasDrawn() {
        return hasDrawn;
      },
    };
  }

  window.DrawingCanvas = { mountDrawingCanvas };
})();
