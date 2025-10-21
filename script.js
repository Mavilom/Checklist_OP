// normaliza texto para comparar nomes (ignora acentos, espaços e caixa)
const normalize = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();

// === Utilities ===
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

const STORAGE_KEY = "checklists";

function todayStr(){
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().slice(0,10);
}

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(); }

function loadAll(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }catch(e){ return []; }
}
function saveAll(list){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// === Catalog of items (Checklist) ===
const CATALOG = [
  { group: "Rastreador Multiportal", items: ["RST MINI", "RST HÍBRIDO"] },
  { group: "Rastreador SUNTECH", items: ["ST4305", "ST340UR", "ST310UC2"] },
  { group: "Rastreador QUECKLINT", items: ["GV55", "GV75"] },
  { group: "PERIFÉRICOS", items: ["RFID", "ICARD PARA RFID", "IBUTTON", "TAG PARA IBUTTON", "ST20U SUTECH", "BUZZER", "RELÉ BLOQUEIO 12V 5P", "RELÉ BLOQUEIO 24V 5P", "SW101"] },
  { group: "ADESIVOS", items: ["ADESIVOS"] }
];

// === State ===
let editingId = null;

// === Tabs ===
$$(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.getAttribute("data-target");
    $$(".tab").forEach(t => t.classList.remove("active"));
    $(target).classList.add("active");
  });
});

// === Render Items ===
function buildItemsUI(){
  const container = $("#items-container");
  if(!container) return;
  container.innerHTML = "";
  CATALOG.forEach(group => {
    const box = document.createElement("div");
    box.className = "item-group";
    box.innerHTML = `<h4>${group.group}</h4>`;
    group.items.forEach(name => {
      const tpl = $("#item-row-tpl").content.cloneNode(true);
      tpl.querySelector(".item-name").textContent = name;
      const row = tpl.querySelector(".item-row");
      const check = tpl.querySelector(".item-check");
      const qty = tpl.querySelector(".item-qty");
      check.addEventListener("change", () => {
        qty.disabled = !check.checked;
        if(!check.checked){ qty.value = ""; }
      });
      box.appendChild(row);
    });
    container.appendChild(box);
  });
}

// === Collect & Fill Form ===
function collectForm(){
  const date = $("#date").value || todayStr();
  const company = $("#company").value.trim();
  const cnpj = $("#cnpj").value.trim();
  const city = $("#city").value.trim();
  const driver = $("#driver").value;

  const items = [];
  $$("#items-container .item-group").forEach(groupEl => {
    const group = $("h4", groupEl).textContent;
    $$(".item-row", groupEl).forEach(row => {
      const name = $(".item-name", row).textContent;
      const checked = $(".item-check", row).checked;
      const qty = Number($(".item-qty", row).value || 0);
      if(checked){
        items.push({ group, name, qty });
      }
    });
  });

  if(!company || !cnpj || !city || !driver){
    alert("Preencha Empresa, CNPJ, Cidade e Técnico.");
    return null;
  }

  return {
    id: editingId || uid(),
    date,
    company, cnpj, city, driver,
    items
  };
}

function fillForm(entry){
  $("#entry-id").value = entry.id;
  $("#date").value = entry.date;
  $("#company").value = entry.company;
  $("#cnpj").value = entry.cnpj;
  $("#city").value = entry.city;
  $("#driver").value = entry.driver;

  // reset checks
  $$("#items-container .item-row").forEach(row => {
    $(".item-check", row).checked = false;
    const qty = $(".item-qty", row);
    qty.value = "";
    qty.disabled = true;
  });

  entry.items.forEach(it => {
    $$("#items-container .item-group").forEach(groupEl => {
      if($("h4", groupEl).textContent === it.group){
        $$(".item-row", groupEl).forEach(row => {
          if($(".item-name", row).textContent === it.name){
            $(".item-check", row).checked = true;
            const qty = $(".item-qty", row);
            qty.disabled = false;
            qty.value = it.qty;
          }
        });
      }
    });
  });

  editingId = entry.id;
}

function clearForm(){
  $("#entry-id").value = "";
  $("#date").value = todayStr();
  $("#company").value = "";
  $("#cnpj").value = "";
  $("#city").value = "";
  $("#driver").value = "";
  $$("#items-container .item-row").forEach(row => {
    $(".item-check", row).checked = false;
    const qty = $(".item-qty", row);
    qty.value = "";
    qty.disabled = true;
  });
  editingId = null;
}

// === Save Checklist + Baixa no Estoque ===
$("#btn-save").addEventListener("click", () => {
  const data = collectForm();
  if(!data) return;

  // Carrega estoque
  produtos = JSON.parse(localStorage.getItem("produtos")) || [];

  // 🔎 Validação: impede salvar se faltar estoque
  /*for (const it of data.items) {
    const qty = Number(it.qty) || 0;
    if(qty <= 0) continue;

    const produto = produtos.find(p => normalize(p.nome) === normalize(it.name));

   if(!produto){
   alert(`O item "${it.name}" não está cadastrado no estoque! Cadastre antes de lançar o checklist.`);
   return; // bloqueia salvar
   }

    if(produto.quantidade < qty){
      alert(`Estoque insuficiente para "${it.name}".\nDisponível: ${produto.quantidade}, solicitado: ${qty}.`);
      return; // bloqueia salvar
    }
  }*/

  // ✅ Se chegou até aqui, tudo certo: salva checklist
  const all = loadAll();
  const exists = all.findIndex(x => x.id === data.id);
  if(exists >= 0){
    all[exists] = data;
  } else {
    all.push(data);
  }
  saveAll(all);

  // 🔽 Faz a baixa no estoque
  data.items.forEach(it => {
    const qty = Number(it.qty) || 0;
    if(qty <= 0) return;
    const produto = produtos.find(p => normalize(p.nome) === normalize(it.name));
    produto.quantidade -= qty;
    totalSaidas += qty;
  });

  localStorage.setItem("produtos", JSON.stringify(produtos));

  renderTabela();
  atualizarDashboard();

  alert("Checklist salvo e estoque atualizado com sucesso!");
});

// === New Checklist ===
$("#btn-new").addEventListener("click", clearForm);

// === PDF ===
$("#btn-pdf").addEventListener("click", () => {
  const data = collectForm();
  if(!data) return;
  openPrintView(data);
});

// === Dashboard Checklist ===
function formatItemsShort(items){
  const total = items.reduce((acc, it) => acc + Number(it.qty || 0), 0);
  return `${items.length} itens / ${total} un.`; 
}

function renderDashboard(dateFilter){
  const all = loadAll();
  const tbody = $("#checklist-table tbody");
  tbody.innerHTML = "";

  let filtered = all;
  if(dateFilter && dateFilter.trim() !== ""){
    filtered = all.filter(x => x.date === dateFilter);
  }

  renderCards(filtered);

  // 🔔 Se não tiver dados
  if (!filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="7" style="text-align:center; padding:10px; color:#666;">
        Nenhum checklist encontrado.
      </td>
    `;
    tbody.appendChild(tr);
    return;
  }

  filtered.sort((a,b) => (a.date < b.date ? 1 : -1));
  filtered.forEach(entry => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge">${entry.date}</span></td>
      <td>${entry.company}</td>
      <td>${entry.cnpj}</td>
      <td>${entry.city}</td>
      <td>${entry.driver}</td>
      <td>${formatItemsShort(entry.items)}</td>
      <td>
        <button class="btn btn-small btn-secondary act-edit">Editar</button>
        <button class="btn btn-small btn-outline act-pdf">PDF</button>
        <button class="btn btn-small btn-secondary act-del">Excluir</button>
      </td>
    `;
    $(".act-edit", tr).addEventListener("click", () => {
      $$("[data-target='#form']")[0].click();
      fillForm(entry);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $(".act-pdf", tr).addEventListener("click", () => openPrintView(entry));
    $(".act-del", tr).addEventListener("click", () => {
      if(confirm("Excluir este checklist?")){
        const all2 = loadAll().filter(x => x.id !== entry.id);
        saveAll(all2);
        renderDashboard(dateFilter);
      }
    });
    tbody.appendChild(tr);
  });
}

function renderCards(list){
  const cards = $("#cards");
  const totalChecklists = list.length;
  let totalUnidades = 0;
  const byGroup = {};

  list.forEach(e => {
    e.items.forEach(it => {
      totalUnidades += Number(it.qty || 0);
      byGroup[it.group] = (byGroup[it.group] || 0) + Number(it.qty || 0);
    });
  });

  const topGroups = Object.entries(byGroup).sort((a,b)=>b[1]-a[1]).slice(0,3);

  cards.innerHTML = `
    <div class="card"><div class="label">Checklists</div><div class="value">${totalChecklists}</div></div>
    <div class="card"><div class="label">Total de Unidades</div><div class="value">${totalUnidades}</div></div>
    ${topGroups.map(([g,v]) => `
      <div class="card"><div class="label">${g}</div><div class="value">${v}</div></div>
    `).join("")}
  `;
}

// === Print View Checklist ===
function openPrintView(entry){
  const win = window.open("", "_blank");
  const logo = "logo.png";
  const rows = entry.items.map(it => `
    <tr><td>${it.group}</td><td>${it.name}</td><td style="text-align:right">${it.qty}</td></tr>
  `).join("");

  win.document.write(`
    <html lang="pt-BR"><head>
      <meta charset="utf-8"/>
      <title>Checklist - ${entry.company} - ${entry.date}</title>
      <style>
        body{ font-family: Arial, sans-serif; padding: 24px; color:#111; }
        header{ display:flex; align-items:center; gap:16px; margin-bottom:16px; }
        header img{ width: 180px; border-radius: 12px; }
        h1{ margin:0; font-size: 22px; }
        .muted{ color:#555; }
        .meta{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; margin: 12px 0 16px; }
        .box{ border:1px solid #ddd; border-radius: 10px; padding: 8px 12px; }
        table{ width:100%; border-collapse: collapse; margin-top: 8px; }
        th, td{ border:1px solid #ddd; padding: 8px; }
        th{ background:#f2f2f2; text-align:left; }
        tfoot td{ font-weight: 700; }
        @page{ size: A4; margin: 16mm; }
      </style>
    </head>
    <body>
      <header><img src="${logo}" alt="Logo"/><div><h1>Checklist de Entrega</h1><div class="muted">Emitido em ${new Date().toLocaleString()}</div></div></header>
      <section class="meta">
        <div class="box"><strong>Empresa:</strong> ${entry.company}</div>
        <div class="box"><strong>CNPJ:</strong> ${entry.cnpj}</div>
        <div class="box"><strong>Cidade:</strong> ${entry.city}</div>
        <div class="box"><strong>Técnico:</strong> ${entry.driver}</div>
        <div class="box"><strong>Data do Envio:</strong> ${entry.date}</div>
        <div class="box"><strong>Ass. Recebedor:</strong> _____________________________</div>
      </section>
      <table>
        <thead><tr><th>Categoria</th><th>Item</th><th style="width:120px; text-align:right">Quantidade</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">Nenhum item selecionado.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="2" style="text-align:right">Total</td><td style="text-align:right">${entry.items.reduce((a,b)=>a + Number(b.qty||0), 0)}</td></tr></tfoot>
      </table>
      <script>window.print();</script>
    </body></html>
  `);
  win.document.close();
}

// === Filter (Daily) ===
$("#filter-date").value = todayStr();
$("#apply-filter").addEventListener("click", () => {
  renderDashboard($("#filter-date").value);
});
$("#clear-filter").addEventListener("click", () => {
  $("#filter-date").value = "";
  renderDashboard();   // mostra todos
});

// === Initialize ===
window.addEventListener("DOMContentLoaded", () => {
  if($("#date")) $("#date").value = todayStr();
  buildItemsUI();
  renderDashboard(todayStr());
  renderTabela();
  atualizarGraficos();
});

// Botão para zerar as saídas realizadas
$("#reset-saidas").addEventListener("click", () => {
  if(confirm("Tem certeza que deseja zerar as saídas realizadas?")){
    totalSaidas = 0;
    localStorage.setItem("saidas", 0);
    atualizarDashboard();
    alert("Saídas realizadas foram zeradas!");
  }
});
function carregarPagina() {
  fetch('latlong.html')
    .then(resp => resp.text())
    .then(html => {
      document.body.innerHTML = html;
    });
}

