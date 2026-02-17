/* ═══════════════════════════════════════════════════════════
   admin.js — Catalina Glossary admin panel
═══════════════════════════════════════════════════════════ */

const DEFAULT_IMG = "/static/img/default.png";
const $  = id => document.getElementById(id);

let allItems     = [];
let allSuggs     = [];
let editUID      = null;   // null = new item, string = editing
let deleteUID    = null;
let suggAdminUID = null;
let imgFile      = null;
let searchTimeout = null;

const imgSrc = f => f ? `/product-img/${f}` : DEFAULT_IMG;

// ── Load everything ────────────────────────────────────────
async function loadData(q = "") {
    const url = q ? `/api/items?q=${encodeURIComponent(q)}` : "/api/items";
    const res  = await fetch(url);
    allItems   = await res.json();

    // Gather suggestions count per item (fetch all individually if needed)
    // We store counts via a separate lightweight approach:
    renderTable(allItems);
    updateStats();
}

function updateStats() {
    $("statItems").textContent = allItems.length;
    // Count sugg badges from DOM (not loaded individually)
}

// ── Render table ───────────────────────────────────────────
function renderTable(items) {
    const tbody = $("adminTableBody");
    tbody.innerHTML = "";

    if (!items.length) {
        tbody.innerHTML = `<tr class="no-items-row"><td colspan="7">No hay items. ¡Agrega el primero!</td></tr>`;
        return;
    }

    items.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><img class="tbl-img" src="${imgSrc(item.imagen)}" alt="${item.nombre}"
                     onerror="this.src='${DEFAULT_IMG}'"></td>
            <td>${escHtml(item.nombre)}</td>
            <td class="desc-cell" title="${escHtml(item.descripcion)}">${escHtml(item.descripcion)}</td>
            <td>${escHtml(item.despacho)}</td>
            <td>${escHtml(item.cajas)}</td>
            <td>
                <span class="badge-sugg" data-uid="${item.uid_item}" title="Ver sugerencias">...</span>
            </td>
            <td>
                <div class="action-cell">
                    <button class="btn-edit"   data-uid="${item.uid_item}">Editar</button>
                    <button class="btn-delete" data-uid="${item.uid_item}" data-name="${escHtml(item.nombre)}">Eliminar</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });

    // Load suggestion counts asynchronously
    items.forEach(item => loadSuggCount(item.uid_item));

    // Wire buttons
    tbody.querySelectorAll(".btn-edit").forEach(b =>
        b.addEventListener("click", () => openEditModal(b.dataset.uid)));
    tbody.querySelectorAll(".btn-delete").forEach(b =>
        b.addEventListener("click", () => openDeleteModal(b.dataset.uid, b.dataset.name)));
    tbody.querySelectorAll(".badge-sugg").forEach(b =>
        b.addEventListener("click", () => openSuggAdmin(b.dataset.uid)));
}

async function loadSuggCount(uid) {
    const res  = await fetch(`/api/items/${uid}`);
    const item = await res.json();
    const badge = document.querySelector(`.badge-sugg[data-uid="${uid}"]`);
    if (badge) badge.textContent = (item.sugerencias || []).length;

    // update total count
    let total = 0;
    document.querySelectorAll(".badge-sugg").forEach(b => {
        const n = parseInt(b.textContent, 10);
        if (!isNaN(n)) total += n;
    });
    $("statSuggs").textContent = total;
}

// ── Add / Edit item modal ──────────────────────────────────
function openAddModal() {
    editUID = null; imgFile = null;
    $("itemFormTitle").textContent = "Nuevo Item";
    $("imgPreview").src = DEFAULT_IMG;
    $("fieldNombre").value  = "";
    $("fieldDesc").value    = "";
    $("fieldDespacho").value = "";
    $("fieldCajas").value   = "";
    $("itemFormError").classList.add("hidden");
    $("itemFormOverlay").classList.remove("hidden");
}

async function openEditModal(uid) {
    editUID = uid; imgFile = null;
    const res  = await fetch(`/api/items/${uid}`);
    const item = await res.json();
    $("itemFormTitle").textContent  = "Editar Item";
    $("imgPreview").src             = imgSrc(item.imagen);
    $("fieldNombre").value          = item.nombre;
    $("fieldDesc").value            = item.descripcion;
    $("fieldDespacho").value        = item.despacho;
    $("fieldCajas").value           = item.cajas;
    $("itemFormError").classList.add("hidden");
    $("itemFormOverlay").classList.remove("hidden");
}

function closeItemForm() {
    $("itemFormOverlay").classList.add("hidden");
}

async function saveItem() {
    const nombre = $("fieldNombre").value.trim();
    if (!nombre) {
        $("itemFormError").classList.remove("hidden");
        return;
    }
    $("itemFormError").classList.add("hidden");

    const fd = new FormData();
    fd.append("nombre",      nombre);
    fd.append("descripcion", $("fieldDesc").value.trim());
    fd.append("despacho",    $("fieldDespacho").value.trim());
    fd.append("cajas",       $("fieldCajas").value.trim());
    if (imgFile) fd.append("imagen", imgFile);

    const url    = editUID ? `/api/items/${editUID}` : "/api/items";
    const method = editUID ? "PUT" : "POST";

    const res = await fetch(url, { method, body: fd });
    if (res.ok) {
        closeItemForm();
        loadData($("Browsebar").value.trim());
    }
}

// ── Delete modal ───────────────────────────────────────────
function openDeleteModal(uid, name) {
    deleteUID = uid;
    $("deleteItemName").textContent = name;
    $("deleteOverlay").classList.remove("hidden");
}

async function confirmDelete() {
    if (!deleteUID) return;
    await fetch(`/api/items/${deleteUID}`, { method: "DELETE" });
    $("deleteOverlay").classList.add("hidden");
    deleteUID = null;
    loadData($("Browsebar").value.trim());
}

// ── Suggestions admin modal ────────────────────────────────
async function openSuggAdmin(uid) {
    suggAdminUID = uid;
    const res  = await fetch(`/api/items/${uid}`);
    const item = await res.json();
    $("suggAdminItemName").textContent = item.nombre;
    renderSuggAdmin(item.sugerencias || []);
    $("suggAdminOverlay").classList.remove("hidden");
}

function renderSuggAdmin(suggs) {
    const list = $("suggAdminList");
    list.innerHTML = "";
    $("noSuggMsg").classList.toggle("hidden", suggs.length > 0);

    suggs.forEach(s => {
        const li = document.createElement("li");
        li.className = "sugg-admin-item";
        li.innerHTML = `
            <span><strong>${escHtml(s.sugeridor)}</strong>: ${escHtml(s.nombre_sugerido)}</span>
            <button class="sugg-del-btn" title="Eliminar sugerencia" data-uid="${s.uid_sugerencia}">✕</button>`;
        list.appendChild(li);
    });

    list.querySelectorAll(".sugg-del-btn").forEach(b =>
        b.addEventListener("click", () => deleteSugg(b.dataset.uid)));
}

async function deleteSugg(uid) {
    await fetch(`/api/sugerencias/${uid}`, { method: "DELETE" });
    openSuggAdmin(suggAdminUID); // refresh
    loadSuggCount(suggAdminUID);
}

// ── Image preview ──────────────────────────────────────────
$("imgInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    imgFile = file;
    const reader = new FileReader();
    reader.onload = ev => $("imgPreview").src = ev.target.result;
    reader.readAsDataURL(file);
});

// ── Search ─────────────────────────────────────────────────
$("Browsebar").addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadData(e.target.value.trim()), 300);
});

// ── Event wiring ───────────────────────────────────────────
$("openAddModal").addEventListener("click",  openAddModal);
$("cancelItemForm").addEventListener("click", closeItemForm);
$("closeItemForm").addEventListener("click",  closeItemForm);
$("saveItem").addEventListener("click",       saveItem);
$("cancelDelete").addEventListener("click",   () => $("deleteOverlay").classList.add("hidden"));
$("confirmDelete").addEventListener("click",  confirmDelete);
$("closeSuggAdmin").addEventListener("click", () => $("suggAdminOverlay").classList.add("hidden"));

// Backdrop close
["itemFormOverlay","deleteOverlay","suggAdminOverlay"].forEach(id => {
    $(id).addEventListener("click", e => {
        if (e.target === $(id)) $(id).classList.add("hidden");
    });
});

// ── Util ───────────────────────────────────────────────────
function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;")
        .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Init ───────────────────────────────────────────────────
loadData();
