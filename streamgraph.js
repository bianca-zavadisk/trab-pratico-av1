// Implementação adaptada do Streamgraph Transitions (ObservableHQ)

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

// Retorna uma matriz de dados onde cada array é uma camada (layer)
function randomizeData(numLayers, samplesPerLayer) {
    return Array.from({length: numLayers}, () => bumps(samplesPerLayer, 10));
}

// --- Configuração D3 ---
let svg, path, x, y, area;
const m = 200; // Resolução horizontal (pontos por camada)
let currentData = [];
let currentPalette = [];

function initD3() {
    const container = document.getElementById("d3-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Escalas base
    x = d3.scaleLinear([0, m - 1], [0, width]);
    y = d3.scaleLinear([0, 1], [height, 0]); // O domínio y é atualizado dinamicamente

    // Gerador de área com curva suavizada
    area = d3.area()
        .x((d, i) => x(i))
        .y0(d => y(d[0]))
        .y1(d => y(d[1]))
        .curve(d3.curveBasis);

    svg = d3.select("#d3-container").append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto; display: block;");
        
    // Botão para forçar uma transição manual das formas mantendo a paleta atual
    document.getElementById('transitionDataBtn').addEventListener('click', () => {
        if(currentPalette.length > 0) {
            transitionShapes();
        }
    });
}

// Função chamada pelo Colorgorical quando a paleta está pronta
window.renderStreamgraph = function(hexPalette) {
    if (!svg) initD3();
    
    currentPalette = hexPalette;
    const n = hexPalette.length; // Quantidade de camadas igual ao número de cores geradas
    
    // Gerar nova matriz de dados com base na quantidade de cores
    currentData = randomizeData(n, m);
    
    // Criar a pilha de camadas (Stack) usando offset "wiggle" para o formato Streamgraph
    const stack = d3.stack()
        .keys(d3.range(n))
        .offset(d3.stackOffsetWiggle)
        .order(d3.stackOrderNone);
        
    const layers = stack(d3.transpose(currentData));

    // Atualizar o domínio Y para enquadrar os novos picos
    y.domain([
        d3.min(layers, l => d3.min(l, d => d[0])),
        d3.max(layers, l => d3.max(l, d => d[1]))
    ]);

    // Escala de cores atrelada à nossa nova paleta gerada
    const colorScale = d3.scaleOrdinal()
        .domain(d3.range(n))
        .range(currentPalette);

    // Selecionar caminhos existentes (paths)
    path = svg.selectAll("path")
        .data(layers);

    // Join (Enter + Update + Exit)
    path.join(
        enter => enter.append("path")
            .attr("d", area)
            .attr("fill", (d, i) => colorScale(i))
            .style("opacity", 0) // Fade in para novas camadas
            .call(enter => enter.transition().duration(750).style("opacity", 1)),
        update => update
            .call(update => update.transition().duration(1500)
                .attr("d", area)
                .attr("fill", (d, i) => colorScale(i))),
        exit => exit
            .call(exit => exit.transition().duration(750)
                .style("opacity", 0).remove())
    );
};

// Anima os dados mantendo as cores atuais
function transitionShapes() {
    const n = currentPalette.length;
    currentData = randomizeData(n, m);
    
    const stack = d3.stack()
        .keys(d3.range(n))
        .offset(d3.stackOffsetWiggle)
        .order(d3.stackOrderNone);
        
    const layers = stack(d3.transpose(currentData));

    y.domain([
        d3.min(layers, l => d3.min(l, d => d[0])),
        d3.max(layers, l => d3.max(l, d => d[1]))
    ]);

    svg.selectAll("path")
        .data(layers)
        .transition()
        .duration(1500)
        .attr("d", area);
}