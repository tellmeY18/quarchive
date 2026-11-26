// QR codes (for paying from a desktop). The generator loads on demand, so it never slows the first paint.
let loading = null;
const load = () => (window.qrcode ? Promise.resolve() : loading ||= new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = './vendor/qrcode.js'; script.onload = resolve; script.onerror = () => { loading = null; reject(new Error('QR unavailable')); };
  document.head.append(script);
}));

export function drawQR(container, text, label) {
  container.replaceChildren();
  load().then(() => {
    container.replaceChildren();
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    const count = qr.getModuleCount(), cell = 4, margin = 4;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = (count + margin * 2) * cell;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', label);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    container.append(canvas);
  }).catch(() => { container.textContent = 'QR unavailable. Copy the UPI ID instead.'; });
}
