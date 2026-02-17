/* ═══════════════════════════════════════════════════════════
   main.js — Catalina Glossary public view
═══════════════════════════════════════════════════════════ */

const DEFAULT_IMG = "/static/img/default.png";
let currentItemUID  = null;
let searchTimeout   = null;

// ── Helpers ────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const imgSrc = filename =>
    filename ? `/product-img/${filename}` : DEFAULT_IMG;

// ── Fetch items & render cards ─────────────────────────────
async function loadItems(q = "") {
    const url = q ? `/api/items?q=${encodeURIComponent(q)}` : "/api/items";
    const res  = await fetch(url);
    const items = await res.json();

    const container = $("cardsContainer");
    container.innerHTML = "";

    if (!items.length) {
        $("noResultsQuery").textContent = q;
        $("noResults").classList.toggle("hidden", !q);
        return;
    }
    $("noResults").classList.add("hidden");

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "yrz_card";
        card.dataset.uid = item.uid_item;
        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${imgSrc(item.imagen)}" alt="${item.nombre}"
                     onerror="this.src='${DEFAULT_IMG}'">
            </div>
            <div class="item-info"><p>${item.nombre}</p></div>`;
        card.addEventListener("click", () => openItemModal(item.uid_item));
        container.appendChild(card);
    });
}

// ── Item detail modal ──────────────────────────────────────
async function openItemModal(uid) {
    currentItemUID = uid;
    const res  = await fetch(`/api/items/${uid}`);
    if (!res.ok) return;
    const item = await res.json();

    $("modalImg").src    = imgSrc(item.imagen);
    $("modalImg").onerror = () => { $("modalImg").src = DEFAULT_IMG; };
    $("modalNombre").textContent   = item.nombre;
    $("modalDesc").textContent     = item.descripcion;
    $("modalDespacho").textContent = item.despacho;
    $("modalCajas").textContent    = item.cajas;

    renderSuggestions(item.sugerencias || []);
    $("itemOverlay").classList.remove("hidden");
}

function renderSuggestions(suggs) {
    const list = $("suggList");
    list.innerHTML = "";
    if (!suggs.length) {
        const li = document.createElement("li");
        li.className = "empty-sugg";
        li.textContent = "Sin sugerencias aún.";
        list.appendChild(li);
        return;
    }
    suggs.forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.sugeridor}: ${s.nombre_sugerido}`;
        list.appendChild(li);
    });
}

// ── Suggestion modal ───────────────────────────────────────
function openSuggModal() {
    $("inputNombreSugerido").value = "";
    $("inputSugeridor").value      = "";
    $("suggError").classList.add("hidden");
    $("suggOverlay").classList.remove("hidden");
}

async function submitSugg() {
    const nombre_sugerido = $("inputNombreSugerido").value.trim();
    const sugeridor       = $("inputSugeridor").value.trim();

    if (!nombre_sugerido || !sugeridor) {
        $("suggError").classList.remove("hidden");
        return;
    }
    $("suggError").classList.add("hidden");

    const res = await fetch("/api/sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid_item: currentItemUID, nombre_sugerido, sugeridor })
    });

    if (res.ok) {
        $("suggOverlay").classList.add("hidden");
        // refresh item modal suggestions
        const item = await (await fetch(`/api/items/${currentItemUID}`)).json();
        renderSuggestions(item.sugerencias || []);
    }
}

// ── Search ─────────────────────────────────────────────────
$("Browsebar").addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadItems(e.target.value.trim()), 300);
});

// ── Event wiring ───────────────────────────────────────────
$("closeItemModal").addEventListener("click",  () => $("itemOverlay").classList.add("hidden"));
$("openSuggForm").addEventListener("click",    openSuggModal);
$("closeSuggModal").addEventListener("click",  () => $("suggOverlay").classList.add("hidden"));
$("submitSugg").addEventListener("click",      submitSugg);

// Close overlays on backdrop click
["itemOverlay", "suggOverlay"].forEach(id => {
    $(id).addEventListener("click", e => {
        if (e.target === $(id)) $(id).classList.add("hidden");
    });
});

// "Sugerir" nav link — opens suggest on any focused card
$("globalSuggestBtn")?.addEventListener("click", e => {
    e.preventDefault();
    if (currentItemUID) openSuggModal();
});

// ── Init ───────────────────────────────────────────────────
loadItems();
