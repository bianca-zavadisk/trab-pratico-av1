const sleep = ms => new Promise(r => setTimeout(r, ms));

// Conversão de espaço RGB -> LAB
function rgbToLab(r, g, b) {
    let r_ = r/255, g_ = g/255, b_ = b/255;

    r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055)/1.055, 2.4) : r_/12.92;
    g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055)/1.055, 2.4) : g_/12.92;
    b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055)/1.055, 2.4) : b_/12.92;

    let x = (r_*0.4124 + g_*0.3576 + b_*0.1805)*100, y = (r_*0.2126 + g_*0.7152 + b_*0.0722)*100, z = (r_*0.0193 + g_*0.1192 + b_*0.9505)*100;

    x /= 95.047; y /= 100.000; z /= 108.883;
    x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787*x) + (16/116);
    y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787*y) + (16/116);
    z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787*z) + (16/116);

    let l = (116*y) - 16, a = 500*(x - y), b_l = 200*(y - z);
    let h = Math.atan2(b_l, a) * (180/Math.PI);

    return { l, a, b: b_l, hue: h < 0 ? h + 360 : h };
}

function ciede2000(lab1, lab2) {
    const rad2deg = r => r * 180 / Math.PI, deg2rad = d => d * Math.PI / 180;
    const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b, L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;
    const C1 = Math.sqrt(a1*a1 + b1*b1), C2 = Math.sqrt(a2*a2 + b2*b2), Cbar = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
    const a1P = a1 * (1 + G), a2P = a2 * (1 + G);
    const C1P = Math.sqrt(a1P*a1P + b1*b1), C2P = Math.sqrt(a2P*a2P + b2*b2), CbarP = (C1P + C2P) / 2;
    let h1P = rad2deg(Math.atan2(b1, a1P)); if (h1P < 0) h1P += 360;
    let h2P = rad2deg(Math.atan2(b2, a2P)); if (h2P < 0) h2P += 360;
    let dhP = (C1P * C2P === 0) ? 0 : (Math.abs(h2P - h1P) <= 180 ? h2P - h1P : (h2P > h1P ? h2P - h1P - 360 : h2P - h1P + 360));
    const dH = 2 * Math.sqrt(C1P * C2P) * Math.sin(deg2rad(dhP) / 2);
    
    const T = 1 - 0.17 * Math.cos(deg2rad(h1P+h2P-60)/2) + 0.24 * Math.cos(deg2rad(h1P+h2P)/2) + 0.32 * Math.cos(deg2rad(3*(h1P+h2P)/2+6)) - 0.20 * Math.cos(deg2rad(2*(h1P+h2P)-126)/2); 
    const dTh = 30 * Math.exp(-Math.pow(((h1P+h2P)/2 - 275) / 25, 2));
    const RC = 2 * Math.sqrt(Math.pow(CbarP, 7) / (Math.pow(CbarP, 7) + Math.pow(25, 7)));
    const SL = 1 + (0.015 * Math.pow((L1+L2)/2 - 50, 2)) / Math.sqrt(20 + Math.pow((L1+L2)/2 - 50, 2));
    const SC = 1 + 0.045 * CbarP, SH = 1 + 0.015 * CbarP * T, RT = -Math.sin(deg2rad(2 * dTh)) * RC;
    
    return Math.sqrt(Math.pow((L2-L1)/SL, 2) + Math.pow((C2P-C1P)/SC, 2) + Math.pow(dH/SH, 2) + RT * ((C2P-C1P)/SC) * (dH/SH));
}

// --- HEURÍSTICAS DO COLORGORICAL ---
function getCoolness(hue) {
    let d = Math.abs(hue - 27); 
    return ((d > 180 ? 360 - d : d) / 180) * 20;
}

function getTau(lab) {
    if (lab.hue > 115 && lab.hue < 138 && lab.l <= 45) return 0.75;
    if (lab.hue >= 70 && lab.hue <= 115 && lab.l > 45 && lab.l <= 75) return 0.8;
    if (lab.hue >= 70 && lab.hue <= 115 && lab.l > 75) return 0.85;
    return 1.0;
}

function removeIndiscriminable(space, picked) {
    return space.filter(c => {
        const dL = Math.abs(c.lab.l - picked.l);
        const da = Math.abs(c.lab.a - picked.a);
        const db = Math.abs(c.lab.b - picked.b);
        return (dL >= 22.747 || da >= 31.427 || db >= 44.757);
    });
}

function evaluate(cand, palette, wDist, wPref) {
    let minDist = Infinity, minPref = Infinity;
    for (const p of palette) {
        const dE = ciede2000(cand.lab, p.lab);
        
        let dH = Math.abs(cand.lab.hue - p.lab.hue);
        if (dH > 180) dH = 360 - dH;
        
        const pref = (75.15 * (getCoolness(cand.lab.hue) + getCoolness(p.lab.hue))) 
                   + (47.61 * Math.abs(cand.lab.l - p.lab.l)) 
                   - (46.42 * dH);
                   
        if (dE < minDist) minDist = dE;
        if (pref < minPref) minPref = pref;
    }
    
    const tau = getTau(cand.lab);
    const rawScore = (wDist * minDist) + (wPref * minPref);
    const finalScore = tau * rawScore;
    
    return { s: finalScore, tau, minDist, minPref, rawScore };
}

// --- PIPELINE DE AMOSTRAGEM E UI ---
async function run() {
    const logEl = document.getElementById('log');
    const btn = document.getElementById('runBtn');
    logEl.innerHTML = ''; btn.disabled = true;

    const N = parseInt(document.getElementById('n').value);
    const wD = parseInt(document.getElementById('wDist').value) / 100;
    const wP = parseInt(document.getElementById('wPref').value) / 100;

    let space = [];
    for(let r=0; r<=255; r+=22) for(let g=0; g<=255; g+=22) for(let b=0; b<=255; b+=22) {
        const lab = rgbToLab(r,g,b);
        if (lab.l >= 25 && lab.l <= 85) space.push({r,g,b,lab});
    }

    const palette = [];
    const canvasS = document.getElementById('spaceCanvas');
    const ctxS = canvasS.getContext('2d');
    const canvasP = document.getElementById('paletteCanvas');
    const ctxP = canvasP.getContext('2d');

    const updateUI = () => {
        // Pinta o fundo do canvas de preto sólido a cada frame
        ctxS.fillStyle = '#333';
        ctxS.fillRect(0,0,600,350);
        
        space.forEach(c => {
            const x = ((c.lab.a + 128)/256)*600, y = 350 - ((c.lab.b + 128)/256)*350;
            // No fundo preto, uma opacidade maior (0.25) com rgb dá um efeito luminoso bonito
            ctxS.fillStyle = `rgba(${c.r},${c.g},${c.b},0.25)`;
            ctxS.fillRect(x,y,2,2);
        });
        
        if(palette.length > 0) {
            // Linhas brancas/cinza claro para contraste com o fundo preto
            ctxS.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctxS.lineWidth = 1.5;
            ctxS.beginPath();
            palette.forEach((c, i) => {
                const x = ((c.lab.a + 128)/256)*600, y = 350 - ((c.lab.b + 128)/256)*350;
                if(i === 0) ctxS.moveTo(x, y);
                else ctxS.lineTo(x, y);
            });
            ctxS.stroke();
            
            palette.forEach((c, i) => {
                const x = ((c.lab.a + 128)/256)*600, y = 350 - ((c.lab.b + 128)/256)*350;
                
                ctxS.fillStyle = `rgb(${c.r},${c.g},${c.b})`; 
                ctxS.strokeStyle = "#ffffff"; // Contorno branco nos círculos
                ctxS.lineWidth = 1.5;
                ctxS.beginPath(); 
                ctxS.arc(x, y, 7, 0, 2 * Math.PI);
                ctxS.fill(); 
                ctxS.stroke();
                
                ctxS.fillStyle = c.lab.l > 50 ? "#333" : "#ffffff";
                ctxS.font = "bold 10px sans-serif";
                ctxS.textAlign = "center";
                ctxS.textBaseline = "middle";
                ctxS.fillText((i + 1).toString(), x, y);
            });
        }
        
        ctxP.clearRect(0,0,600,80);
        if(palette.length > 0) {
            const pw = 600 / palette.length;
            palette.forEach((c, i) => {
                ctxP.fillStyle = `rgb(${c.r},${c.g},${c.b})`; 
                ctxP.fillRect(i*pw, 0, pw, 80);
                
                ctxP.fillStyle = c.lab.l > 50 ? "#000" : "#fff";
                ctxP.font = "bold 13px monospace";
                ctxP.textAlign = "center";
                
                const hex = '#' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('');
                ctxP.fillText("C" + (i+1), (i*pw) + (pw/2), 35);
                ctxP.font = "11px monospace";
                ctxP.fillText(hex.toUpperCase(), (i*pw) + (pw/2), 55);
            });
        }
    };

    const seedIdx = Math.floor(Math.random() * space.length);
    const seed = space[seedIdx];
    palette.push(seed);
    space.splice(seedIdx, 1);
    space = removeIndiscriminable(space, seed.lab);

    updateUI();
    logEl.innerHTML += `<div class="log-item">
        <span class="log-hl">Step 2: Start Palette</span><br>
        Cor semente (C1) escolhida aleatoriamente.<br>
        Espaço CIELAB filtrado p/ ${space.length} cores distinguíveis restantes.
    </div>`;
    await sleep(600);

    while (palette.length < N && space.length > 0) {
        
        let candidates = space.map((c, idx) => {
            const evalResult = evaluate(c, palette, wD, wP);
            return { c, idx, s: evalResult.s, evalData: evalResult };
        });
        candidates.sort((a,b) => b.s - a.s);
        
        const maxS = candidates[0].s;
        const scores = candidates.map(x => x.s);
        const avg = scores.reduce((a,b) => a+b) / scores.length;
        const sd = Math.sqrt(scores.map(x => Math.pow(x-avg,2)).reduce((a,b) => a+b) / scores.length);
        const thresh = maxS - 0.75 * sd;
        
        const pool = candidates.filter(x => x.s >= thresh);
        const winner = pool[Math.floor(Math.random() * pool.length)];

        palette.push(winner.c);
        space.splice(winner.idx, 1); 
        space = removeIndiscriminable(space, winner.c.lab); 

        updateUI();

        const item = document.createElement('div');
        item.className = 'log-item';
        item.innerHTML = `
            <span class="log-hl">Step 3: Cor C${palette.length}</span><br>
            Sorteada de um pool de ${pool.length} candidatos.<br>
            ↳ <i>Threshold:</i> ${thresh.toFixed(2)} (Max Score era ${maxS.toFixed(2)})<br>
            ↳ <i>Métricas (Mínimos):</i> $\\Psi_{dist}$ = ${winner.evalData.minDist.toFixed(1)} | $\\Psi_{pref}$ = ${winner.evalData.minPref.toFixed(1)}<br>
            ↳ <i>Penalidade ($\\tau$):</i> ${winner.evalData.tau.toFixed(2)}<br>
            ↳ <b>Score Aplicado:</b> ${winner.s.toFixed(2)}<br>
            ↳ <i>Espaço Restante:</i> ${space.length} cores.
        `;

        logEl.appendChild(item);

        // Forçamos o KaTeX a renderizar apenas este novo elemento
        if (window.renderMathInElement) {
            renderMathInElement(item, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ]
            });
        }

        logEl.scrollTop = logEl.scrollHeight;
        
        await sleep(800);
    }

    if(palette.length < N) {
        logEl.innerHTML += `<div class="log-item" style="color:#ef4444; font-weight:bold;">Aviso: Espaço de cores esgotado antes do alvo.</div>`;
    }
    
    btn.disabled = false;
}

// --- EVENT LISTENERS ---
document.getElementById('n').addEventListener('input', e => document.getElementById('vN').innerText = e.target.value);
document.getElementById('wDist').addEventListener('input', e => document.getElementById('vD').innerText = e.target.value);
document.getElementById('wPref').addEventListener('input', e => document.getElementById('vP').innerText = e.target.value);
document.getElementById('runBtn').addEventListener('click', run);