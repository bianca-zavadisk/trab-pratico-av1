let scatterSvg, scX, scY;
const scMargin = {top: 20, right: 20, bottom: 40, left: 40};
let currentScatterPalette = [];
let isScatterLooping = false;

function initScatter() {
    const container = document.getElementById("scatter-container");
    const width = container.clientWidth;
    const height = container.clientHeight;

    scatterSvg = d3.select("#scatter-container")
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height);

    scX = d3.scaleLinear().domain([0, 100]).range([scMargin.left, width - scMargin.right]);
    scY = d3.scaleLinear().domain([0, 100]).range([height - scMargin.bottom, scMargin.top]);

    // Eixos
    scatterSvg.append("g")
        .attr("transform", `translate(0,${height - scMargin.bottom})`)
        .call(d3.axisBottom(scX).ticks(5));

    scatterSvg.append("g")
        .attr("transform", `translate(${scMargin.left},0)`)
        .call(d3.axisLeft(scY).ticks(5));

    // Inicia o ciclo de animação automática
    if (!isScatterLooping) {
        isScatterLooping = true;
        autoTransitionScatter();
    }
}

// Gera a nuvem de pontos agrupados
function getScatterData(hexPalette) {
    const n = hexPalette.length;
    const pointsPerCluster = 50;
    const data = [];
    
    for (let i = 0; i < n; i++) {
        const centerX = 20 + Math.random() * 60;
        const centerY = 20 + Math.random() * 60;
        for (let j = 0; j < pointsPerCluster; j++) {
            data.push({
                x: centerX + d3.randomNormal(0, 8)(), 
                y: centerY + d3.randomNormal(0, 8)(),
                category: i,
                id: `${i}-${j}` // ID único para manter a consistência na animação
            });
        }
    }
    return data;
}

window.renderScatterplot = function(hexPalette) {
    if (!scatterSvg) initScatter();
    currentScatterPalette = hexPalette;
    const data = getScatterData(hexPalette);
    const colorScale = d3.scaleOrdinal().domain(d3.range(hexPalette.length)).range(hexPalette);

    scatterSvg.selectAll("circle.point")
        .data(data, d => d.id)
        .join(
            enter => enter.append("circle")
                .attr("class", "point")
                .attr("cx", d => scX(d.x))
                .attr("cy", d => scY(d.y))
                .attr("r", 0)
                .attr("fill", d => colorScale(d.category))
                .call(e => e.transition().duration(800).attr("r", 4)),
            update => update.transition().duration(1000)
                .attr("cx", d => scX(d.x))
                .attr("cy", d => scY(d.y))
                .attr("fill", d => colorScale(d.category)),
            exit => exit.transition().duration(500).attr("r", 0).remove()
        );
};

// --- Loop Infinito ---
async function autoTransitionScatter() {
    while (true) {
        // Pausa entre transições
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (currentScatterPalette.length > 0 && scatterSvg) {
            const data = getScatterData(currentScatterPalette);
            
            try {
                await scatterSvg.selectAll("circle.point")
                    .data(data)
                    .transition()
                    .duration(1500)
                    .attr("cx", d => scX(d.x)) // Move suavemente os pontos
                    .attr("cy", d => scY(d.y))
                    .end();
            } catch (error) {
                // Interrompido por atualização manual (renderScatterplot), ignora o erro
            }
        }
    }
}