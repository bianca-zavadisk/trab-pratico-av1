let barSvg, bX, bY;
const bMargin = {top: 20, right: 20, bottom: 40, left: 40};
let currentBarPalette = [];
let isBarLooping = false;
let barContainerHeight = 0;

function initBar() {
    const container = document.getElementById("bar-container");
    const width = container.clientWidth;
    barContainerHeight = container.clientHeight;

    barSvg = d3.select("#bar-container")
        .append("svg")
        .attr("viewBox", [0, 0, width, barContainerHeight])
        .attr("width", width)
        .attr("height", barContainerHeight);

    // bX: Escala para as categorias (largura das barras)
    bX = d3.scaleBand().range([bMargin.left, width - bMargin.right]).padding(0.2);
    
    // bY: Escala para a altura (0 na base do gráfico, Max no topo)
    bY = d3.scaleLinear().range([barContainerHeight - bMargin.bottom, bMargin.top]);

    barSvg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${barContainerHeight - bMargin.bottom})`);
    barSvg.append("g").attr("class", "y-axis").attr("transform", `translate(${bMargin.left},0)`);

    if (!isBarLooping) {
        isBarLooping = true;
        autoTransitionBar();
    }
}

// Gera alturas aleatórias variadas
function getBarData(hexPalette) {
    return hexPalette.map((color, i) => ({
        category: `C${i + 1}`,
        value: 10 + Math.random() * 90, // Valores entre 10 e 100 para garantir variação
        color: color
    }));
}

window.renderBarplot = function(hexPalette) {
    if (!barSvg) initBar();
    
    currentBarPalette = hexPalette;
    const data = getBarData(hexPalette);

    // Atualiza domínios
    bX.domain(data.map(d => d.category));
    bY.domain([0, 110]); // Domínio fixo para que as barras variem proporcionalmente

    // Atualiza eixos
    barSvg.select(".x-axis").transition().duration(1000).call(d3.axisBottom(bX));
    barSvg.select(".y-axis").transition().duration(1000).call(d3.axisLeft(bY).ticks(5));

    // JOIN das barras
    barSvg.selectAll("rect.bar")
        .data(data, d => d.category)
        .join(
            enter => enter.append("rect")
                .attr("class", "bar")
                .attr("x", d => bX(d.category))
                .attr("width", bX.bandwidth())
                .attr("y", barContainerHeight - bMargin.bottom)
                .attr("height", 0)
                .attr("fill", d => d.color),
            update => update,
            exit => exit.transition().duration(500).attr("height", 0).attr("y", barContainerHeight - bMargin.bottom).remove()
        )
        .transition().duration(1000)
        .attr("x", d => bX(d.category))
        .attr("width", bX.bandwidth())
        .attr("y", d => bY(d.value)) // A posição Y é o topo da barra
        .attr("height", d => (barContainerHeight - bMargin.bottom) - bY(d.value)) // A altura é a distância da base até o Y
        .attr("fill", d => d.color);
};

async function autoTransitionBar() {
    while (true) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (currentBarPalette.length > 0 && barSvg) {
            const data = getBarData(currentBarPalette);
            try {
                await barSvg.selectAll("rect.bar")
                    .data(data, d => d.category)
                    .transition()
                    .duration(1500)
                    .attr("y", d => bY(d.value))
                    .attr("height", d => (barContainerHeight - bMargin.bottom) - bY(d.value))
                    .end();
            } catch (e) {}
        }
    }
}