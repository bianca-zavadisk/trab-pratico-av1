const sleep = ms => new Promise(r => setTimeout(r, ms));

function rgbToLab(r, g, b) {
    let r_ = r/255, g_ = g/255, b_ = b/255;
    r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055)/1.055, 2.4) : r_/12.92;
    g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055)/1.055, 2.4) : g_/12.92;
    b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055)/1.055, 2.4) : b_/12.92;
    let x = (r_*0.4124 + g_*0.3576 + b_*0.1805)*100;
    let y = (r_*0.2126 + g_*0.7152 + b_*0.0722)*100;
    let z = (r_*0.0193 + g_*0.1192 + b_*0.9505)*100;
    x /= 95.047; y /= 100.000; z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787*x) + (16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787*y) + (16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787*z) + (16/116);
    
    let l = (116*y) - 16, a = 500*(x - y), b_lab = 200*(y - z);
    let hue = Math.atan2(b_lab, a) * (180/Math.PI);
    if (hue < 0) hue += 360;
    
    return { l, a, b: b_lab, hue };
}

function buildColorSpace() {
    const space = [];
    for (let r = 0; r <= 255; r += 24) {
        for (let g = 0; g <= 255; g += 24) {
            for (let b = 0; b <= 255; b += 24) {
                const lab = rgbToLab(r, g, b);
                if (lab.l < 25 || lab.l > 85) continue;
                if (lab.l >= 35 && lab.l <= 75 && lab.hue >= 85 && lab.hue <= 114) continue;
                space.push({ r, g, b, lab });
            }
        }
    }
    return space;
}

function calculateScores(cand, palette, wDist, wPref) {
    let minDist = Infinity, minPref = Infinity;
    for (const p of palette) {
        const dl = cand.lab.l - p.lab.l;
        const da = cand.lab.a - p.lab.a;
        const db = cand.lab.b - p.lab.b;
        const dist = Math.sqrt(dl*dl + da*da + db*db);

        let dhue = Math.abs(cand.lab.hue - p.lab.hue);
        if (dhue > 180) dhue = 360 - dhue;
        const pref = (47.61 * Math.abs(dl)) - (46.42 * dhue);

        if (dist < minDist) minDist = dist;
        if (pref < minPref) minPref = pref;
    }
    return { 
        finalScore: (wDist * minDist) + (wPref * minPref), 
        minDist, 
        minPref 
    };
}

function mapLabToCanvas(a, b, width, height) {
    const x = ((a + 128) / 256) * width;
    const y = height - (((b + 128) / 256) * height);
    return { x, y };
}

function drawSpaceBackground(ctx, width, height, space) {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width/2, 0); ctx.lineTo(width/2, height);
    ctx.moveTo(0, height/2); ctx.lineTo(width, height/2);
    ctx.stroke();
    space.forEach(c => {
        const pos = mapLabToCanvas(c.lab.a, c.lab.b, width, height);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.15)`;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2); ctx.fill();
    });
}

function drawWalk(ctx, width, height, palette) {
    if (palette.length === 0) return;
    ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i = 0; i < palette.length; i++) {
        const pos = mapLabToCanvas(palette[i].lab.a, palette[i].lab.b, width, height);
        if (i === 0) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y);
    }
    ctx.stroke();
    palette.forEach((c, i) => {
        const pos = mapLabToCanvas(c.lab.a, c.lab.b, width, height);
        ctx.fillStyle = `rgb(${c.r}, ${c.g}, ${c.b})`;
        ctx.strokeStyle = c.lab.l > 60 ? '#1f2937' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.lab.l > 60 ? '#000' : '#fff';
        ctx.font = "10px bold sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(i + 1, pos.x, pos.y);
    });
}

function drawPaletteRow(palette) {
    const canvas = document.getElementById('paletteCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const swatchWidth = canvas.width / palette.length;
    palette.forEach((color, i) => {
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(i * swatchWidth, 0, swatchWidth, canvas.height);
        ctx.fillStyle = color.lab.l > 60 ? '#000' : '#FFF';
        ctx.font = '14px system-ui'; ctx.textAlign = 'center';
        const hex = '#' + [color.r, color.g, color.b].map(x => x.toString(16).padStart(2, '0')).join('');
        ctx.fillText(hex.toUpperCase(), (i * swatchWidth) + (swatchWidth / 2), canvas.height - 20);
    });
}

function addLog(msg, highlight = false) {
    const log = document.getElementById('executionLog');
    const entry = document.createElement('div');
    entry.className = highlight ? 'log-entry highlight' : 'log-entry';
    entry.innerHTML = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

async function generateAnimatedPalette() {
    const btn = document.getElementById('generateBtn');
    btn.disabled = true;
    document.getElementById('executionLog').innerHTML = '';

    const numColors = parseInt(document.getElementById('numColors').value);
    const wDist = parseInt(document.getElementById('wDist').value) / 100;
    const wPref = parseInt(document.getElementById('wPref').value) / 100;
    const speed = parseInt(document.getElementById('animSpeed').value);
    
    const space = buildColorSpace();
    const palette = [];
    const spaceCanvas = document.getElementById('spaceCanvas');
    const spaceCtx = spaceCanvas.getContext('2d');
    
    drawSpaceBackground(spaceCtx, spaceCanvas.width, spaceCanvas.height, space);
    addLog(`Iniciando amostragem com ${space.length} cores candidatas no espaço L*a*b*.`);

    // Cor 1
    const startIdx = Math.floor(Math.random() * space.length);
    palette.push(space[startIdx]);
    const startColor = space.splice(startIdx, 1)[0];
    
    addLog(`<strong>Iteração 1:</strong> Cor semente aleatória escolhida. L=${startColor.lab.l.toFixed(1)}, a*=${startColor.lab.a.toFixed(1)}, b*=${startColor.lab.b.toFixed(1)}`, true);
    
    drawWalk(spaceCtx, spaceCanvas.width, spaceCanvas.height, palette);
    drawPaletteRow(palette);
    await sleep(speed);

    // Iterações subsequentes
    while (palette.length < numColors && space.length > 0) {
        let bestScore = -Infinity, bestIdx = -1, bestMetrics = null;

        for (let i = 0; i < space.length; i++) {
            const metrics = calculateScores(space[i], palette, wDist, wPref);
            if (metrics.finalScore > bestScore) {
                bestScore = metrics.finalScore;
                bestIdx = i;
                bestMetrics = metrics;
            }
        }

        const chosen = space[bestIdx];
        palette.push(chosen);
        space.splice(bestIdx, 1);
        
        addLog(`<strong>Iteração ${palette.length}:</strong> Analisando distâncias...<br>
                ↳ Score Máximo Encontrado: <strong>${bestScore.toFixed(2)}</strong><br>
                ↳ min(ΔE): ${bestMetrics.minDist.toFixed(2)} | min(Pref): ${bestMetrics.minPref.toFixed(2)}<br>
                ↳ Cor escolhida: L=${chosen.lab.l.toFixed(1)}, a*=${chosen.lab.a.toFixed(1)}, b*=${chosen.lab.b.toFixed(1)}`, true);
        
        drawSpaceBackground(spaceCtx, spaceCanvas.width, spaceCanvas.height, space);
        drawWalk(spaceCtx, spaceCanvas.width, spaceCanvas.height, palette);
        drawPaletteRow(palette);
        
        await sleep(speed);
    }
    
    addLog(`<strong>Concluído!</strong> Paleta gerada com sucesso.`);
    btn.disabled = false;
}

document.getElementById('numColors').addEventListener('input', e => document.getElementById('valColors').textContent = e.target.value);
document.getElementById('animSpeed').addEventListener('input', e => document.getElementById('valSpeed').textContent = e.target.value);
document.getElementById('wDist').addEventListener('input', e => document.getElementById('valDist').textContent = e.target.value);
document.getElementById('wPref').addEventListener('input', e => document.getElementById('valPref').textContent = e.target.value);
document.getElementById('generateBtn').addEventListener('click', generateAnimatedPalette);

generateAnimatedPalette();