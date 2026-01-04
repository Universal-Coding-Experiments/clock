const canvas = document.getElementById('clock');
const ctx = canvas.getContext('2d', { alpha: false });
const wrap = document.getElementById('wrap');
const snapBtn = document.getElementById('snapBtn');
const shareBtn = document.getElementById('shareBtn');
const configToggle = document.getElementById('configToggle');
const config = document.getElementById('config');
const closeConfig = document.getElementById('closeConfig');
const tzSelect = document.getElementById('tzSelect');
const fontScale = document.getElementById('fontScale');
const contrast = document.getElementById('contrast');
const showNumerals = document.getElementById('showNumerals');
const tickDensity = document.getElementById('tickDensity');
const timeLabel = document.getElementById('timeLabel');
const tooltip = document.getElementById('tooltip');

let DPR = Math.max(1, window.devicePixelRatio || 1);
let size = 600;
let radius = size / 2;
let center = { x: 0, y: 0 };
let running = true;
let offscreenFace = null;
let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let settings = {
    timezone: 'local',
    fontScale: 1,
    contrast: 1,
    showNumerals: true,
    tickDensity: 60
};

function dateInZone(zone) {
    if (!zone || zone === 'local') return new Date();

    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

    return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${now.getMilliseconds()}Z`);
}

function updateSize() {
    const rect = wrap.getBoundingClientRect();
    const cssSize = Math.min(rect.width, rect.height);
    size = Math.max(120, Math.round(cssSize));
    DPR = Math.max(1, window.devicePixelRatio || 1);

    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.round(size * DPR);
    canvas.height = Math.round(size * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    radius = size / 2;
    center.x = size / 2;
    center.y = size / 2;

    createFaceCache();
}

function createFaceCache() {
    const off = document.createElement('canvas');
    off.width = Math.round(size * DPR);
    off.height = Math.round(size * DPR);
    const octx = off.getContext('2d');
    octx.setTransform(DPR, 0, 0, DPR, 0, 0);

    octx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#0f1724';
    octx.fillRect(0, 0, size, size);

    octx.save();
    octx.beginPath();
    octx.arc(center.x, center.y, radius - 2, 0, Math.PI * 2);
    octx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#0f1724';
    octx.fill();

    const faceGrad = octx.createRadialGradient(center.x - radius * 0.18, center.y - radius * 0.18, 0, center.x, center.y, radius);
    faceGrad.addColorStop(0, 'rgba(255,255,255,0.02)');
    faceGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
    octx.fillStyle = faceGrad;
    octx.fill();
    octx.restore();

    const outer = radius * 0.92;
    const innerMin = radius * 0.82;
    const innerHour = radius * 0.72;
    const density = parseInt(settings.tickDensity, 10) || 60;
    for (let i = 0; i < density; i++) {
        const a = (i / density) * Math.PI * 2;
        const cos = Math.cos(a), sin = Math.sin(a);
        const x1 = center.x + cos * (density % 12 === 0 && i % (density / 12) === 0 ? innerHour : innerMin);
        const y1 = center.y + sin * (density % 12 === 0 && i % (density / 12) === 0 ? innerHour : innerMin);
        const x2 = center.x + cos * outer;
        const y2 = center.y + sin * outer;
        octx.beginPath();
        octx.moveTo(x1, y1);
        octx.lineTo(x2, y2);
        octx.lineWidth = (i % (density / 12) === 0) ? Math.max(2, radius * 0.012) : Math.max(1, radius * 0.005);
        octx.strokeStyle = 'rgba(255,255,255,0.10)';
        octx.lineCap = 'round';
        octx.stroke();
    }

    if (settings.showNumerals) {
        octx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--face-light').trim() || '#f7f7f9';
        const fontSize = Math.max(10, Math.round(radius * 0.12 * settings.fontScale));
        octx.font = `${fontSize}px Inter, system-ui, -apple-system`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        const numR = radius * 0.58;
        for (let h = 1; h <= 12; h++) {
            const a = ((h / 12) * Math.PI * 2) - Math.PI / 2;
            const nx = center.x + Math.cos(a) * numR;
            const ny = center.y + Math.sin(a) * numR;
            octx.fillText(String(h), nx, ny);
        }
    }

    octx.beginPath();
    octx.arc(center.x, center.y, Math.max(4, radius * 0.03), 0, Math.PI * 2);
    octx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
    octx.fill();

    offscreenFace = off;
}

function drawClock(now) {
    ctx.clearRect(0, 0, size, size);

    if (offscreenFace) ctx.drawImage(offscreenFace, 0, 0, size, size);

    const nowZone = (settings.timezone === 'local') ? new Date() : dateInZone(settings.timezone);
    const ms = nowZone.getMilliseconds();
    const s = nowZone.getSeconds() + ms / 1000;
    const m = nowZone.getMinutes() + s / 60;
    const h = (nowZone.getHours() % 12) + m / 60;

    const angleSec = (s / 60) * Math.PI * 2 - Math.PI / 2;
    const angleMin = (m / 60) * Math.PI * 2 - Math.PI / 2;
    const angleHour = (h / 12) * Math.PI * 2 - Math.PI / 2;

    const hourLen = radius * 0.45;
    const minLen = radius * 0.65;
    const secLen = radius * 0.82;
    const hourW = Math.max(4, radius * 0.04);
    const minW = Math.max(3, radius * 0.03);
    const secW = Math.max(1.5, radius * 0.012);

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angleHour);
    ctx.lineCap = 'round';
    ctx.lineWidth = hourW;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--face-light').trim() || '#f7f7f9';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = Math.max(2, radius * 0.02);
    ctx.beginPath();
    ctx.moveTo(-hourW * 0.4, 0);
    ctx.lineTo(hourLen, 0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angleMin);
    ctx.lineCap = 'round';
    ctx.lineWidth = minW;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--face-light').trim() || '#f7f7f9';
    ctx.shadowBlur = Math.max(1, radius * 0.015);
    ctx.beginPath();
    ctx.moveTo(-minW * 0.35, 0);
    ctx.lineTo(minLen, 0);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(angleSec);
    ctx.lineCap = 'round';
    ctx.lineWidth = secW;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(-secW * 0.6, 0);
    ctx.lineTo(secLen, 0);
    ctx.stroke();

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4ff';
    ctx.beginPath();
    ctx.arc(-radius * 0.12, 0, Math.max(3, radius * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const hh = String(nowZone.getHours()).padStart(2, '0');
    const mm = String(nowZone.getMinutes()).padStart(2, '0');
    const ss = String(nowZone.getSeconds()).padStart(2, '0');
    timeLabel.textContent = `${hh}:${mm}:${ss}`;

    if (Math.floor(s) === 0 && !prefersReducedMotion) {
        pulseCenterCap();
    }
}

function pulseCenterCap() {
    const el = canvas;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 420);
}

let rafId = null;
function loop() {
    const now = new Date();
    drawClock(now);
    rafId = requestAnimationFrame(loop);
}

snapBtn.addEventListener('click', () => {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `clock_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
});
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        snapBtn.click();
    }
});

shareBtn.addEventListener('click', async () => {
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'clock.png', { type: 'image/png' })] })) {
            await navigator.share({ files: [new File([blob], 'clock.png', { type: 'image/png' })], title: 'Clock snapshot' });
        } else {
            snapBtn.click();
        }
    } catch (err) {
        snapBtn.click();
    }
});

configToggle.addEventListener('click', () => {
    const open = config.classList.toggle('open');
    configToggle.setAttribute('aria-expanded', String(open));
    config.setAttribute('aria-hidden', String(!open));
});
closeConfig.addEventListener('click', () => {
    config.classList.remove('open');
    configToggle.setAttribute('aria-expanded', 'false');
    config.setAttribute('aria-hidden', 'true');
});

tzSelect.addEventListener('change', (e) => {
    settings.timezone = e.target.value;

    drawClock(new Date());
});
fontScale.addEventListener('input', (e) => {
    settings.fontScale = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--font-scale', settings.fontScale);
    createFaceCache();
    drawClock(new Date());
});
contrast.addEventListener('input', (e) => {
    settings.contrast = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--contrast', settings.contrast);
    canvas.style.filter = `contrast(${settings.contrast})`;
});
showNumerals.addEventListener('change', (e) => {
    settings.showNumerals = (e.target.value === 'true');
    createFaceCache();
    drawClock(new Date());
});
tickDensity.addEventListener('change', (e) => {
    settings.tickDensity = parseInt(e.target.value, 10);
    createFaceCache();
    drawClock(new Date());
});

wrap.addEventListener('pointermove', (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    const nowZone = (settings.timezone === 'local') ? new Date() : dateInZone(settings.timezone);
    const hh = String(nowZone.getHours()).padStart(2, '0');
    const mm = String(nowZone.getMinutes()).padStart(2, '0');
    const ss = String(nowZone.getSeconds()).padStart(2, '0');
    tooltip.textContent = `${hh}:${mm}:${ss} ${settings.timezone === 'local' ? '' : '(' + settings.timezone + ')'}`;
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
});
wrap.addEventListener('pointerleave', () => {
    tooltip.classList.remove('visible');
    tooltip.setAttribute('aria-hidden', 'true');
});

let lastDPR = DPR;
setInterval(() => {
    const currentDPR = Math.max(1, window.devicePixelRatio || 1);
    if (currentDPR !== lastDPR) {
        lastDPR = currentDPR;
        updateSize();
        drawClock(new Date());
    }
}, 500);

let resizeTimer = null;
window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        updateSize();
        drawClock(new Date());
    }, 120);
});

function dateInZone(zone) {
    if (!zone || zone === 'local') return new Date();
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${now.getMilliseconds()}Z`);
}

updateSize();
drawClock(new Date());
if (!prefersReducedMotion) loop();