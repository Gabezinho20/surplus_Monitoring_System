// ESTADO DA APLICAÇÃO
let lojasBase = [];
let supervisoesBase = [];
let todosExcedentesRecords = [];
let mostrarTodosRegistros = false;

let chartBar = null;
let chartPie = null;
let chartLine = null;

document.addEventListener("DOMContentLoaded", () => {
    carregarLojasEInicializar();
    carregarExcedentes();
    configurarFileUpload();
    configurarEventosComboboxGlobal();
    inicializarNavegacao();
});

// ==========================================
// 1. CARREGAR BASE DE LOJAS E SUPERVISÕES
// ==========================================
async function carregarLojasEInicializar() {
    try {
        const res = await fetch("/api/lojas");
        const data = await res.json();
        lojasBase = data.lojas || [];
        supervisoesBase = data.supervisoes || [];
        
        // Atualizar contador da sidebar
        document.getElementById("storeCountDisplay").innerHTML = `Total de Lojas: <strong>${lojasBase.length}</strong>`;
        
        // Renderizar combobox de supervisão e modal
        renderizarDropdownSupervisao();
        renderizarDropdownLojaModal();
    } catch (err) {
        console.error("Erro ao carregar lojas:", err);
        mostrarToast("Erro ao carregar lista de lojas do servidor.", "erro");
    }
}

// ==========================================
// 2. CARREGAR EXCEDENTES E ATUALIZAR CHARTS & TABELA
// ==========================================
async function carregarExcedentes() {
    const supervisao = document.getElementById("supervisaoFilterValue").value || "Todas";
    try {
        const res = await fetch(`/api/excedentes?supervisao=${encodeURIComponent(supervisao)}`);
        const data = await res.json();
        
        // Atualizar KPIs
        document.getElementById("kpiTotal").innerHTML = `${data.kpis.total_excedentes} <span class="card-unit">pessoas</span>`;
        document.getElementById("kpiLojas").innerHTML = `${data.kpis.lojas_afetadas} <span class="card-unit">unidades</span>`;
        document.getElementById("kpiMediaTempo").innerHTML = `${data.kpis.media_dias} <span class="card-unit">dias</span>`;
        document.getElementById("kpiSupervisoes").innerHTML = `${data.kpis.supervisoes_afetadas} <span class="card-unit">regionais</span>`;

        // Renderizar/Atualizar Gráficos ApexCharts
        renderizarChartBar(data.charts.bar);
        renderizarChartPie(data.charts.pie);
        renderizarChartLine(data.charts.line);

        // Guardar todos os registros e renderizar tabela com limite
        todosExcedentesRecords = data.records || [];
        renderizarTabela(todosExcedentesRecords);

    } catch (err) {
        console.error("Erro ao carregar excedentes:", err);
        mostrarToast("Erro ao atualizar os dados do painel.", "erro");
    }
}

// ==========================================
// 3. COMBOBOX PESQUISÁVEL: SELEÇÃO DE LOJA NO MODAL
// ==========================================
function abrirDropdownLojaModal() {
    const combobox = document.getElementById("comboboxLojaModal");
    const dropdown = document.getElementById("dropdownLojaModal");
    combobox.classList.add("open");
    dropdown.hidden = false;
    renderizarDropdownLojaModal();
}

function fecharDropdownLojaModal() {
    const combobox = document.getElementById("comboboxLojaModal");
    const dropdown = document.getElementById("dropdownLojaModal");
    combobox.classList.remove("open");
    dropdown.hidden = true;
}

function filtrarDropdownLojaModal() {
    abrirDropdownLojaModal();
}

function renderizarDropdownLojaModal() {
    const input = document.getElementById("inputLojaModal");
    const dropdown = document.getElementById("dropdownLojaModal");
    const termo = (input.value || "").trim().toLowerCase();
    const selecionada = document.getElementById("selectLojaModalValue").value;

    dropdown.innerHTML = "";

    const filtradas = lojasBase.filter(l => l.nome_loja.toLowerCase().includes(termo));

    if (filtradas.length === 0) {
        dropdown.innerHTML = `<div class="combobox-empty">Nenhuma loja encontrada</div>`;
        return;
    }

    filtradas.forEach(item => {
        const div = document.createElement("div");
        div.className = `combobox-item ${item.nome_loja === selecionada ? 'selected' : ''}`;
        
        let nomeHtml = escapeHtml(item.nome_loja);
        if (termo) {
            const regex = new RegExp(`(${escapeRegex(termo)})`, 'gi');
            nomeHtml = nomeHtml.replace(regex, `<span class="highlight-match">$1</span>`);
        }

        div.innerHTML = `
            <span>${nomeHtml}</span>
            <span class="combobox-item-sub">${escapeHtml(item.supervisao)}</span>
        `;

        div.addEventListener("click", () => {
            selecionarLojaModal(item.nome_loja, item.supervisao);
        });

        dropdown.appendChild(div);
    });
}

function selecionarLojaModal(nomeLoja, supervisao) {
    document.getElementById("inputLojaModal").value = nomeLoja;
    document.getElementById("selectLojaModalValue").value = nomeLoja;
    
    const displayNome = document.getElementById("modalSupervisaoNome");
    displayNome.textContent = supervisao;
    displayNome.style.color = "var(--accent-orange)";
    
    fecharDropdownLojaModal();
    validarFormularioModal();
}

function resetarLojaModal() {
    document.getElementById("inputLojaModal").value = "";
    document.getElementById("selectLojaModalValue").value = "";
    
    const displayNome = document.getElementById("modalSupervisaoNome");
    displayNome.textContent = "Selecione uma loja acima";
    displayNome.style.color = "var(--text-muted)";
    
    validarFormularioModal();
}

// ==========================================
// 4. COMBOBOX PESQUISÁVEL: FILTRO DE SUPERVISÃO (MÁXIMO 3 ITENS)
// ==========================================
function abrirDropdownSupervisao() {
    const combobox = document.getElementById("comboboxSupervisao");
    const dropdown = document.getElementById("dropdownSupervisao");
    combobox.classList.add("open");
    dropdown.hidden = false;
    renderizarDropdownSupervisao();
}

function fecharDropdownSupervisao() {
    const combobox = document.getElementById("comboboxSupervisao");
    const dropdown = document.getElementById("dropdownSupervisao");
    combobox.classList.remove("open");
    dropdown.hidden = true;
}

function filtrarDropdownSupervisao() {
    abrirDropdownSupervisao();
}

function renderizarDropdownSupervisao() {
    const input = document.getElementById("inputSupervisaoFilter");
    const dropdown = document.getElementById("dropdownSupervisao");
    const termo = (input.value || "").trim().toLowerCase();
    const selecionada = document.getElementById("supervisaoFilterValue").value || "Todas";

    dropdown.innerHTML = "";

    let listaOpcoes = [];

    // Opção Fixa "Todas as Supervisões"
    if (!termo || "todas as supervisões".includes(termo) || "todas".includes(termo)) {
        listaOpcoes.push({ valor: "Todas", rotulo: "Todas as Supervisões" });
    }

    supervisoesBase.forEach(sup => {
        if (!termo || sup.toLowerCase().includes(termo)) {
            listaOpcoes.push({ valor: sup, rotulo: sup });
        }
    });

    if (listaOpcoes.length === 0) {
        dropdown.innerHTML = `<div class="combobox-empty">Nenhuma supervisão encontrada</div>`;
        return;
    }

    // Limitar visualização a no máximo 3 itens para não bugar o CSS da sidebar
    const exibidas = listaOpcoes.slice(0, 3);

    exibidas.forEach(opt => {
        const div = document.createElement("div");
        div.className = `combobox-item ${opt.valor === selecionada ? 'selected' : ''}`;
        
        let rotuloHtml = escapeHtml(opt.rotulo);
        if (termo) {
            const regex = new RegExp(`(${escapeRegex(termo)})`, 'gi');
            rotuloHtml = rotuloHtml.replace(regex, `<span class="highlight-match">$1</span>`);
        }

        div.innerHTML = `<span>${rotuloHtml}</span>`;
        div.addEventListener("click", () => selecionarSupervisaoFilter(opt.valor, opt.rotulo));
        dropdown.appendChild(div);
    });
}

function selecionarSupervisaoFilter(valor, rotulo) {
    document.getElementById("supervisaoFilterValue").value = valor;
    document.getElementById("inputSupervisaoFilter").value = valor === "Todas" ? "" : rotulo;
    document.getElementById("inputSupervisaoFilter").placeholder = valor === "Todas" ? "Todas as Supervisões" : rotulo;
    fecharDropdownSupervisao();
    mostrarTodosRegistros = false; // reset ao trocar filtro
    carregarExcedentes();
}

// Fechar dropdowns ao clicar fora
function configurarEventosComboboxGlobal() {
    document.addEventListener("click", (e) => {
        const cbLoja = document.getElementById("comboboxLojaModal");
        if (cbLoja && !cbLoja.contains(e.target)) {
            fecharDropdownLojaModal();
        }

        const cbSup = document.getElementById("comboboxSupervisao");
        if (cbSup && !cbSup.contains(e.target)) {
            fecharDropdownSupervisao();
        }
    });

    const inputLoja = document.getElementById("inputLojaModal");
    if (inputLoja) {
        inputLoja.addEventListener("input", () => {
            const val = inputLoja.value.trim().toLowerCase();
            const match = lojasBase.find(l => l.nome_loja.toLowerCase() === val);
            if (match) {
                selecionarLojaModal(match.nome_loja, match.supervisao);
            } else {
                document.getElementById("selectLojaModalValue").value = "";
                document.getElementById("modalSupervisaoNome").textContent = "Selecione uma loja acima";
                document.getElementById("modalSupervisaoNome").style.color = "var(--text-muted)";
                validarFormularioModal();
            }
        });
    }
}

// ==========================================
// 5. RENDERIZAR GRÁFICOS (APEXCHARTS)
// ==========================================
function renderizarChartBar(chartData) {
    const options = {
        chart: {
            type: 'bar',
            height: 300,
            toolbar: { show: false },
            background: 'transparent'
        },
        theme: { mode: 'dark' },
        colors: ['#f97316'],
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: '42%',
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: true,
            offsetY: -20,
            style: { colors: ['#f8fafc'], fontSize: '11px', fontFamily: 'Plus Jakarta Sans', fontWeight: '600' }
        },
        series: [{
            name: 'Excedentes',
            data: chartData.series || []
        }],
        xaxis: {
            categories: chartData.categories || [],
            labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
            axisBorder: { color: '#232d3f' },
            axisTicks: { color: '#232d3f' }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } }
        },
        grid: {
            borderColor: '#232d3f',
            strokeDashArray: 4
        },
        tooltip: { theme: 'dark' }
    };

    if (chartBar) {
        chartBar.updateOptions(options);
    } else {
        chartBar = new ApexCharts(document.querySelector("#chartBarRanking"), options);
        chartBar.render();
    }
}

function renderizarChartPie(chartData) {
    const options = {
        chart: {
            type: 'donut',
            height: 300,
            background: 'transparent'
        },
        theme: { mode: 'dark' },
        labels: chartData.labels || [],
        series: chartData.series || [],
        colors: ['#f97316', '#fb923c', '#fdba74', '#ea580c', '#c2410c', '#9a3412'],
        stroke: { colors: ['#151c28'], width: 3 },
        plotOptions: {
            pie: {
                donut: {
                    size: '62%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total',
                            color: '#94a3b8',
                            formatter: function (w) {
                                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                            }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            labels: { colors: '#94a3b8' }
        },
        tooltip: { theme: 'dark' }
    };

    if (chartPie) {
        chartPie.updateOptions(options);
    } else {
        chartPie = new ApexCharts(document.querySelector("#chartPieSupervisao"), options);
        chartPie.render();
    }
}

function renderizarChartLine(chartData) {
    const options = {
        chart: {
            type: 'area',
            height: 280,
            toolbar: { show: false },
            background: 'transparent'
        },
        theme: { mode: 'dark' },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: ['#f97316']
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: "vertical",
                shadeIntensity: 1,
                gradientToColors: ['#f97316'],
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        markers: {
            size: 5,
            colors: ['#fb923c'],
            strokeColors: '#ffffff',
            strokeWidth: 2
        },
        series: [{
            name: 'Dias Decorridos',
            data: chartData.series || []
        }],
        xaxis: {
            categories: chartData.categories || [],
            labels: { style: { colors: '#94a3b8', fontSize: '11px' } },
            axisBorder: { color: '#232d3f' }
        },
        yaxis: {
            labels: { style: { colors: '#94a3b8' } },
            title: { text: 'Dias', style: { color: '#64748b' } }
        },
        grid: {
            borderColor: '#232d3f',
            strokeDashArray: 4
        },
        tooltip: { theme: 'dark' }
    };

    if (chartLine) {
        chartLine.updateOptions(options);
    } else {
        chartLine = new ApexCharts(document.querySelector("#chartLineTempo"), options);
        chartLine.render();
    }
}

// ==========================================
// 6. RENDERIZAR TABELA DE REGISTROS (MÁXIMO 4 POR PADRÃO + MOSTRAR MAIS)
// ==========================================
function renderizarTabela(records) {
    const tbody = document.getElementById("tabelaBody");
    const footerPagination = document.getElementById("tablePaginationFooter");
    const btnTexto = document.getElementById("btnMostrarMaisTexto");

    tbody.innerHTML = "";

    if (!records || records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">Nenhum excedente encontrado para a visão selecionada.</td></tr>`;
        footerPagination.hidden = true;
        return;
    }

    // Determinar registros visíveis (máximo 4 por padrão)
    let registrosExibidos = records;
    if (!mostrarTodosRegistros && records.length > 4) {
        registrosExibidos = records.slice(0, 4);
    }

    registrosExibidos.forEach(r => {
        const tr = document.createElement("tr");
        
        let statusBadge = `<span class="status-pill rec">Recente</span>`;
        if (r.badge_status === "atn") statusBadge = `<span class="status-pill atn">Atenção</span>`;
        if (r.badge_status === "crt") statusBadge = `<span class="status-pill crt">Crítico</span>`;

        tr.innerHTML = `
            <td>${statusBadge}</td>
            <td><strong>${escapeHtml(r.nome_loja)}</strong></td>
            <td><span style="color:var(--text-secondary)">${escapeHtml(r.supervisao)}</span></td>
            <td><strong style="color:var(--accent-orange); font-size:1.05rem;">${r.qtd_excedente}</strong></td>
            <td>${r.data_inicio}</td>
            <td><strong>${r.tempo_formatado}</strong></td>
            <td style="text-align: right;">
                <button class="btn-edit btn-sm" onclick="abrirModalEdicao(${r.id}, ${r.qtd_excedente}, '${escapeHtml(r.nome_loja).replace(/'/g, "\\'")}') " title="Editar excedente">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                </button>
                <button class="btn-secondary btn-sm" onclick="marcarComoResolvido(${r.id})" title="Marcar como resolvido">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Resolvido
                </button>
                <button class="btn-danger btn-sm" onclick="excluirRegistro(${r.id})" title="Excluir registro">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Controle do Botão Mostrar Mais
    if (records.length > 4) {
        footerPagination.hidden = false;
        if (mostrarTodosRegistros) {
            btnTexto.textContent = "Mostrar menos registros";
        } else {
            const restantes = records.length - 4;
            btnTexto.textContent = `Mostrar mais (${restantes} restante${restantes > 1 ? 's' : ''})`;
        }
    } else {
        footerPagination.hidden = true;
    }
}

function alternarMostrarTodosRegistros() {
    mostrarTodosRegistros = !mostrarTodosRegistros;
    renderizarTabela(todosExcedentesRecords);
}

// ==========================================
// 7. BUSCA RÁPIDA NA TABELA DE REGISTROS
// ==========================================
function filtrarTabelaPorBusca() {
    const term = document.getElementById("searchInput").value.toLowerCase();
    
    if (!term) {
        renderizarTabela(todosExcedentesRecords);
        return;
    }

    const filtrados = todosExcedentesRecords.filter(r => {
        return r.nome_loja.toLowerCase().includes(term) || 
               r.supervisao.toLowerCase().includes(term) ||
               r.tempo_formatado.toLowerCase().includes(term);
    });

    // Quando buscando, exibe todos os resultados correspondentes
    const tbody = document.getElementById("tabelaBody");
    const footerPagination = document.getElementById("tablePaginationFooter");
    tbody.innerHTML = "";
    footerPagination.hidden = true;

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:32px;">Nenhum registro encontrado para "${escapeHtml(term)}".</td></tr>`;
        return;
    }

    filtrados.forEach(r => {
        const tr = document.createElement("tr");
        let statusBadge = `<span class="status-pill rec">Recente</span>`;
        if (r.badge_status === "atn") statusBadge = `<span class="status-pill atn">Atenção</span>`;
        if (r.badge_status === "crt") statusBadge = `<span class="status-pill crt">Crítico</span>`;

        tr.innerHTML = `
            <td>${statusBadge}</td>
            <td><strong>${escapeHtml(r.nome_loja)}</strong></td>
            <td><span style="color:var(--text-secondary)">${escapeHtml(r.supervisao)}</span></td>
            <td><strong style="color:var(--accent-orange); font-size:1.05rem;">${r.qtd_excedente}</strong></td>
            <td>${r.data_inicio}</td>
            <td><strong>${r.tempo_formatado}</strong></td>
            <td style="text-align: right;">
                <button class="btn-edit btn-sm" onclick="abrirModalEdicao(${r.id}, ${r.qtd_excedente}, '${escapeHtml(r.nome_loja).replace(/'/g, "\\'")}') " title="Editar excedente">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                </button>
                <button class="btn-secondary btn-sm" onclick="marcarComoResolvido(${r.id})" title="Marcar como resolvido">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Resolvido
                </button>
                <button class="btn-danger btn-sm" onclick="excluirRegistro(${r.id})" title="Excluir registro">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 8. CONTROLES DO MODAL DE CADASTRO
// ==========================================
function abrirModalCadastro() {
    document.getElementById("modalCadastro").classList.add("active");
    resetarLojaModal();
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("inputDataInicio").value = today;
    validarFormularioModal();
}

function fecharModalCadastro() {
    document.getElementById("modalCadastro").classList.remove("active");
}

function validarFormularioModal() {
    const loja = document.getElementById("selectLojaModalValue").value;
    const qtd = document.getElementById("inputQtdExcedente").value;
    const data = document.getElementById("inputDataInicio").value;
    const btn = document.getElementById("btnConfirmarCadastro");

    btn.disabled = !(loja && parseInt(qtd) >= 1 && data);
}

async function submeterCadastroExcedente() {
    const nome_loja = document.getElementById("selectLojaModalValue").value;
    const qtd_excedente = parseInt(document.getElementById("inputQtdExcedente").value);
    const data_inicio = document.getElementById("inputDataInicio").value;

    if (!nome_loja) {
        mostrarToast("Selecione uma loja válida.", "erro");
        return;
    }

    try {
        const res = await fetch("/api/cadastrar-excedente", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome_loja, qtd_excedente, data_inicio })
        });
        const data = await res.json();

        if (data.success) {
            fecharModalCadastro();
            mostrarToast("Excedente cadastrado com sucesso!", "sucesso");
            carregarExcedentes();
        } else {
            mostrarToast(data.message || "Erro ao efetuar o cadastro.", "erro");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Erro de comunicação com o servidor.", "erro");
    }
}

// ==========================================
// 9. CONTROLES DO MODAL DE EDIÇÃO (ALTERAR APENAS QTD EXCEDENTE)
// ==========================================
function abrirModalEdicao(id, qtdAtual, nomeLoja) {
    document.getElementById("inputEditId").value = id;
    document.getElementById("modalEdicaoNomeLoja").textContent = nomeLoja;
    document.getElementById("inputEditQtdExcedente").value = qtdAtual;
    document.getElementById("modalEdicao").classList.add("active");
}

function fecharModalEdicao() {
    document.getElementById("modalEdicao").classList.remove("active");
}

async function submeterEdicaoExcedente() {
    const id = document.getElementById("inputEditId").value;
    const qtd_excedente = parseInt(document.getElementById("inputEditQtdExcedente").value);

    if (!id || isNaN(qtd_excedente) || qtd_excedente < 1) {
        mostrarToast("Informe uma quantidade válida de excedentes (mínimo 1).", "erro");
        return;
    }

    try {
        const res = await fetch(`/api/excedentes/${id}/editar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qtd_excedente })
        });
        const data = await res.json();

        if (data.success) {
            fecharModalEdicao();
            mostrarToast("Quantidade de excedentes atualizada!", "sucesso");
            carregarExcedentes();
        } else {
            mostrarToast(data.message || "Erro ao atualizar excedente.", "erro");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao comunicação com o servidor.", "erro");
    }
}

// ==========================================
// 10. RESOLVER E EXCLUIR REGISTROS
// ==========================================
async function marcarComoResolvido(id) {
    if (!confirm("Confirmar a resolução deste registro de excedente?")) return;
    try {
        const res = await fetch(`/api/excedentes/${id}/resolve`, { method: "POST" });
        const data = await res.json();
        if (data.success) {
            mostrarToast("Registro marcado como resolvido!", "sucesso");
            carregarExcedentes();
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao resolver o registro.", "erro");
    }
}

async function excluirRegistro(id) {
    if (!confirm("Deseja realmente remover permanentemente este registro?")) return;
    try {
        const res = await fetch(`/api/excedentes/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            mostrarToast("Registro excluído com sucesso.", "sucesso");
            carregarExcedentes();
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao excluir o registro.", "erro");
    }
}

// ==========================================
// 11. UPLOAD ASYNC DA BASE EXCEL
// ==========================================
function configurarFileUpload() {
    const input = document.getElementById("fileUploadInput");
    if (!input) return;
    input.addEventListener("change", async () => {
        if (!input.files || input.files.length === 0) return;
        const formData = new FormData();
        formData.append("file", input.files[0]);

        try {
            mostrarToast("Enviando e processando planilha...", "info");
            const res = await fetch("/api/upload-base", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                mostrarToast(data.message, "sucesso");
                carregarLojasEInicializar();
                carregarExcedentes();
            } else {
                mostrarToast("Erro: " + data.message, "erro");
            }
        } catch (err) {
            console.error(err);
            mostrarToast("Erro ao processar o arquivo enviado.", "erro");
        }
        input.value = "";
    });
}

// ==========================================
// 12. SISTEMA DE TOAST NOTIFICATIONS
// ==========================================
function mostrarToast(mensagem, tipo = 'sucesso') {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;

    let iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-green)" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    if (tipo === 'erro') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--status-red)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (tipo === 'info') {
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-orange)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-content">
            ${iconSvg}
            <span>${escapeHtml(mensagem)}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            setTimeout(() => toast.remove(), 200);
        }
    }, 3500);
}

// UTILS DE ESCAPING
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 13. EXPORTAR REGISTROS EXIBIDOS PARA EXCEL
// ==========================================
function exportarParaExcel() {
    const term = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
    let recordsToExport = todosExcedentesRecords || [];

    if (term) {
        recordsToExport = recordsToExport.filter(r => {
            return (r.nome_loja || "").toLowerCase().includes(term) ||
                   (r.supervisao || "").toLowerCase().includes(term) ||
                   (r.tempo_formatado || "").toLowerCase().includes(term);
        });
    }

    if (!recordsToExport || recordsToExport.length === 0) {
        mostrarToast("Nenhum registro para exportar.", "info");
        return;
    }

    // Se a biblioteca SheetJS (XLSX) estiver carregada, faz o download via frontend com formatação de colunas
    if (typeof XLSX !== 'undefined') {
        const excelData = recordsToExport.map(r => {
            let status = "Recente";
            if (r.badge_status === "atn") status = "Atenção";
            if (r.badge_status === "crt") status = "Crítico";

            return {
                "Status": status,
                "Loja": r.nome_loja,
                "Supervisão": r.supervisao,
                "Quantidade Excedente": r.qtd_excedente,
                "Data Inicial": r.data_inicio,
                "Tempo Decorrido": r.tempo_formatado,
                "Dias Decorridos": r.dias_decorridos
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Largura dinâmica das colunas
        const colWidths = Object.keys(excelData[0]).map(key => {
            const maxLen = Math.max(
                key.length,
                ...excelData.map(row => String(row[key] || '').length)
            );
            return { wch: Math.max(maxLen + 4, 12) };
        });
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Excedentes");

        const dataHoje = new Date().toISOString().split("T")[0];
        const supervisaoAtual = document.getElementById("supervisaoFilterValue")?.value || "Todas";
        const supSufixo = supervisaoAtual !== 'Todas' ? `_${supervisaoAtual.replace(/\s+/g, '_')}` : '';
        const nomeArquivo = `Relatorio_Excedentes${supSufixo}_${dataHoje}.xlsx`;

        XLSX.writeFile(workbook, nomeArquivo);
        mostrarToast(`Planilha "${nomeArquivo}" baixada com sucesso! (${recordsToExport.length} registros)`, "sucesso");
    } else {
        // Fallback server-side via endpoint Flask
        const supervisao = document.getElementById("supervisaoFilterValue")?.value || "Todas";
        window.location.href = `/api/exportar-excedentes?supervisao=${encodeURIComponent(supervisao)}`;
    }
}

// ==========================================
// 14. NAVEGAÇÃO E TABS (NOVA ABA IMPORTAÇÕES)
// ==========================================
function inicializarNavegacao() {
    const navPainelGeral = document.getElementById("navPainelGeral");
    const navImportacoes = document.getElementById("navImportacoes");
    const painelGeralView = document.getElementById("painelGeralView");
    const importacoesView = document.getElementById("importacoesView");

    if (navPainelGeral && navImportacoes && painelGeralView && importacoesView) {
        navPainelGeral.addEventListener("click", (e) => {
            e.preventDefault();
            navPainelGeral.classList.add("active");
            navImportacoes.classList.remove("active");
            painelGeralView.style.display = "block";
            importacoesView.style.display = "none";
        });

        navImportacoes.addEventListener("click", (e) => {
            e.preventDefault();
            navImportacoes.classList.add("active");
            navPainelGeral.classList.remove("active");
            importacoesView.style.display = "block";
            painelGeralView.style.display = "none";
        });
    }
}

// ==========================================
// 15. LÓGICA DE UPLOAD PELO CARD DE IMPORTAÇÃO (MOCKUP ACCURACY)
// ==========================================
function arquivosSelecionadoNoCard() {
    const input = document.getElementById("fileUploadInputCard");
    const dropzoneText = document.getElementById("dropzoneText");
    const cloudIconSvg = document.getElementById("cloudUploadIcon");
    const btnImportar = document.getElementById("btnImportarCard");

    if (input && input.files && input.files.length > 0) {
        const file = input.files[0];
        dropzoneText.innerHTML = `Selecionado: <strong style="color: #22d3ee;">${escapeHtml(file.name)}</strong>`;
        if (cloudIconSvg) {
            cloudIconSvg.style.stroke = "#22d3ee";
        }
        if (btnImportar) {
            btnImportar.disabled = false;
        }
    } else {
        dropzoneText.textContent = "Selecionar arquivo .CSV";
        if (cloudIconSvg) {
            cloudIconSvg.style.stroke = "#475569";
        }
        if (btnImportar) {
            btnImportar.disabled = true;
        }
    }
}

async function fazerUploadBasePeloCard() {
    const input = document.getElementById("fileUploadInputCard");
    const btnImportar = document.getElementById("btnImportarCard");
    const dropzoneText = document.getElementById("dropzoneText");
    const cloudIconSvg = document.getElementById("cloudUploadIcon");

    if (!input || !input.files || input.files.length === 0) {
        mostrarToast("Selecione um arquivo primeiro.", "erro");
        return;
    }

    const file = input.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
        if (btnImportar) {
            btnImportar.disabled = true;
            btnImportar.textContent = "Importando...";
        }
        mostrarToast("Enviando e processando base de lojas...", "info");

        const res = await fetch("/api/upload-base", {
            method: "POST",
            body: formData
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast(data.message, "sucesso");
            
            // Recarregar lojas e atualizar estados
            await carregarLojasEInicializar();
            await carregarExcedentes();
            
            // Resetar o card
            input.value = "";
            dropzoneText.textContent = "Selecionar arquivo .CSV";
            if (cloudIconSvg) {
                cloudIconSvg.style.stroke = "#475569";
            }
        } else {
            mostrarToast("Erro: " + data.message, "erro");
        }
    } catch (err) {
        console.error(err);
        mostrarToast("Erro ao processar o arquivo enviado.", "erro");
    } finally {
        if (btnImportar) {
            btnImportar.textContent = "Importar Colaboradores";
            btnImportar.disabled = (input.value === "");
        }
    }
}

