// Implementação adaptada do Streamgraph Transitions (ObservableHQ) para Vanilla JS

// --- Funções Matemáticas Geradoras de Dados (Bumps) ---
function bump(a, n) {
    const x = 1 / (0.1 + Math.random());
    const y = 2 * Math.random() - 0.5;
    const z = 10 / (0.1 + Math.random());
    for (let i = 0; i < n; ++i) {
        const w = (i / n - y) * z;
        a[i] += x * Math.exp(-w * w);
    }
}

function bumps(n, m) {
    const a = [];
    for (let i = 0; i < n; ++i) a[i] = 0;
    for (let i = 0; i < m; ++i) bump(a, n);
    return a;
}

function randomizeData(numLayers, samplesPerLayer) {
    return Array.from({length: numLayers}, () => bumps(samplesPerLayer, 10));
}

// --- Configuração D3 ---
let svg, x, y, area;
const m = 200; 
let currentData = [];
let currentPalette = [];
let isLooping = false;

function initD3() {
    const container = document.getElementById("d3-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    x = d3.scaleLinear([0, m - 1], [0, width]);
    y = d3.scaleLinear([0, 1], [height, 0]);

    area = d3.area()
        .x((d, i) => x(i))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    svg = d3.select("#d3-container").append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);
        
    if (!isLooping) {
        isLooping = true;
        autoTransitionLoop();
    }
}

window.renderStreamgraph = function(hexPalette) {
    if (!svg) initD3();
    currentPalette = hexPalette;
    const n = hexPalette.length; // Dinâmico: número de cores selecionadas
    
    currentData = randomizeData(n, m);
    const stack = d3.stack().keys(d3.range(n)).offset(d3.stackOffsetWiggle);
    const layers = stack(d3.transpose(currentData));

    y.domain([d3.min(layers, l => d3.min(l, d => d[0])), d3.max(layers, l => d3.max(l, d => d[1]))]);

    const colorScale = d3.scaleOrdinal().domain(d3.range(n)).range(currentPalette);

    // O .join cuida de adicionar ou remover camadas conforme o N muda
    svg.selectAll("path")
        .data(layers)
        .join(
            enter => enter.append("path")
                .attr("d", area)
                .attr("fill", (d, i) => colorScale(i))
                .style("opacity", 0)
                .call(e => e.transition().duration(750).style("opacity", 1)),
            update => update.transition().duration(1000)
                .attr("d", area)
                .attr("fill", (d, i) => colorScale(i)),
            exit => exit.transition().duration(500).style("opacity", 0).remove()
        );
};

// --- Loop Automático Infinito ---
async function autoTransitionLoop() {
    while (true) {
        // Aguarda 1 segundo antes de preparar a próxima transição
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Só avança se o gráfico já tiver sido inicializado e possuir uma paleta
        if (currentPalette.length > 0 && svg) {
            const n = currentPalette.length;
            currentData = randomizeData(n, m);
            
            const stack = d3.stack()
                .keys(d3.range(n))
                .offset(d3.stackOffsetWiggle)
                .order(d3.stackOrderNone);
                
            const layers = stack(d3.transpose(currentData));

            // Atualiza dinamicamente o domínio Y para enquadrar os novos picos
            y.domain([
                d3.min(layers, l => d3.min(l, d => d[0])),
                d3.max(layers, l => d3.max(l, d => d[1]))
            ]);

            try {
                // A instrução .end() resolve a Promise quando a animação de 1500ms termina.
                // Se for interrompida por um renderStreamgraph manual, gera um erro que é apanhado abaixo.
                await svg.selectAll("path")
                    .data(layers)
                    .transition()
                    .duration(1500)
                    .attr("d", area)
                    .end();
            } catch (error) {
                // Animação foi interrompida de propósito (o utilizador alterou os parâmetros).
                // Ignoramos a falha e permitimos que o while(true) continue o seu ciclo limpo.
            }
        }
    }
}