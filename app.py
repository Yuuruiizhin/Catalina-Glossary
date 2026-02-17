import os
import json
import uuid
import shutil
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_from_directory, abort

# ── Data paths ─────────────────────────────────────────────────────────────────
DOCS = Path.home() / "Documents" / "Yuuruii" / "Catalina Glossary"
IMG_DIR  = DOCS / "Img" / "Productos"
ITEMS_FILE  = DOCS / "items.json"
SUGGS_FILE  = DOCS / "sugerencias.json"

for d in [DOCS, IMG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

def load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default

def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

# ── Flask app ──────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB upload limit

ALLOWED_EXTS = {"png", "jpg", "jpeg", "gif", "webp", "bmp"}

def allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTS

# ── Serve product images from Documents folder ─────────────────────────────────
@app.route("/product-img/<filename>")
def product_img(filename):
    safe = Path(filename).name          # prevent path traversal
    full = IMG_DIR / safe
    if not full.exists():
        abort(404)
    return send_from_directory(str(IMG_DIR), safe)

# ── API: list items ────────────────────────────────────────────────────────────
@app.route("/api/items")
def api_items():
    items = load_json(ITEMS_FILE, [])
    suggs = load_json(SUGGS_FILE, [])
    q = request.args.get("q", "").strip().lower()
    if q:
        def matches(item):
            if q in item.get("nombre", "").lower():
                return True
            item_suggs = [s["nombre_sugerido"].lower() for s in suggs
                          if s["uid_item"] == item["uid_item"]]
            return any(q in s for s in item_suggs)
        items = [i for i in items if matches(i)]
    return jsonify(items)

# ── API: single item ───────────────────────────────────────────────────────────
@app.route("/api/items/<uid>")
def api_item(uid):
    items = load_json(ITEMS_FILE, [])
    item  = next((i for i in items if i["uid_item"] == uid), None)
    if not item:
        return jsonify({"error": "not found"}), 404
    suggs = [s for s in load_json(SUGGS_FILE, []) if s["uid_item"] == uid]
    return jsonify({**item, "sugerencias": suggs})

# ── API: create item ───────────────────────────────────────────────────────────
@app.route("/api/items", methods=["POST"])
def api_create_item():
    nombre      = request.form.get("nombre", "").strip()
    descripcion = request.form.get("descripcion", "").strip()
    despacho    = request.form.get("despacho", "").strip()
    cajas       = request.form.get("cajas", "").strip()

    if not nombre:
        return jsonify({"error": "nombre requerido"}), 400

    uid  = str(uuid.uuid4())
    img_filename = ""

    file = request.files.get("imagen")
    if file and file.filename and allowed(file.filename):
        ext = file.filename.rsplit(".", 1)[1].lower()
        img_filename = f"{uid}.{ext}"
        file.save(str(IMG_DIR / img_filename))

    items = load_json(ITEMS_FILE, [])
    item  = {
        "uid_item":   uid,
        "nombre":     nombre,
        "descripcion": descripcion,
        "despacho":   despacho,
        "cajas":      cajas,
        "imagen":     img_filename,
    }
    items.append(item)
    save_json(ITEMS_FILE, items)
    return jsonify(item), 201

# ── API: update item ───────────────────────────────────────────────────────────
@app.route("/api/items/<uid>", methods=["PUT"])
def api_update_item(uid):
    items = load_json(ITEMS_FILE, [])
    idx   = next((i for i, x in enumerate(items) if x["uid_item"] == uid), None)
    if idx is None:
        return jsonify({"error": "not found"}), 404

    item = items[idx]
    item["nombre"]      = request.form.get("nombre",      item["nombre"])
    item["descripcion"] = request.form.get("descripcion", item["descripcion"])
    item["despacho"]    = request.form.get("despacho",    item["despacho"])
    item["cajas"]       = request.form.get("cajas",       item["cajas"])

    file = request.files.get("imagen")
    if file and file.filename and allowed(file.filename):
        # remove old image if any
        old = IMG_DIR / item["imagen"] if item.get("imagen") else None
        if old and old.exists():
            old.unlink()
        ext = file.filename.rsplit(".", 1)[1].lower()
        img_filename = f"{uid}.{ext}"
        file.save(str(IMG_DIR / img_filename))
        item["imagen"] = img_filename

    items[idx] = item
    save_json(ITEMS_FILE, items)
    return jsonify(item)

# ── API: delete item ───────────────────────────────────────────────────────────
@app.route("/api/items/<uid>", methods=["DELETE"])
def api_delete_item(uid):
    items = load_json(ITEMS_FILE, [])
    item  = next((i for i in items if i["uid_item"] == uid), None)
    if not item:
        return jsonify({"error": "not found"}), 404

    if item.get("imagen"):
        img_path = IMG_DIR / item["imagen"]
        if img_path.exists():
            img_path.unlink()

    items = [i for i in items if i["uid_item"] != uid]
    save_json(ITEMS_FILE, items)

    suggs = [s for s in load_json(SUGGS_FILE, []) if s["uid_item"] != uid]
    save_json(SUGGS_FILE, suggs)
    return jsonify({"ok": True})

# ── API: suggestions ───────────────────────────────────────────────────────────
@app.route("/api/sugerencias", methods=["POST"])
def api_create_sugg():
    data = request.get_json(force=True)
    uid_item        = data.get("uid_item", "").strip()
    nombre_sugerido = data.get("nombre_sugerido", "").strip()
    sugeridor       = data.get("sugeridor", "").strip()

    if not uid_item or not nombre_sugerido or not sugeridor:
        return jsonify({"error": "faltan campos"}), 400

    items = load_json(ITEMS_FILE, [])
    if not any(i["uid_item"] == uid_item for i in items):
        return jsonify({"error": "item no existe"}), 404

    suggs = load_json(SUGGS_FILE, [])
    entry = {
        "uid_sugerencia": str(uuid.uuid4()),
        "uid_item":       uid_item,
        "nombre_sugerido": nombre_sugerido,
        "sugeridor":      sugeridor,
    }
    suggs.append(entry)
    save_json(SUGGS_FILE, suggs)
    return jsonify(entry), 201

# ── API: delete suggestion ─────────────────────────────────────────────────────
@app.route("/api/sugerencias/<uid_sugg>", methods=["DELETE"])
def api_delete_sugg(uid_sugg):
    suggs = load_json(SUGGS_FILE, [])
    suggs = [s for s in suggs if s["uid_sugerencia"] != uid_sugg]
    save_json(SUGGS_FILE, suggs)
    return jsonify({"ok": True})

# ── Pages ──────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin")
def admin():
    return render_template("admin.html")

if __name__ == "__main__":
    # threaded=True handles multiple concurrent users
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
