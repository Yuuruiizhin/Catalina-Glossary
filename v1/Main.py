from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
import os
import json
import uuid
import aiofiles
from filelock import FileLock

app = FastAPI()

# Base data directory: ~/Documents/Yuuruii/Catalina Glossary
DATA_ROOT = Path(os.path.expanduser("~/Documents/Yuuruii/Catalina Glossary")).expanduser()
IMG_DIR = DATA_ROOT / "Img" / "Productos"
ITEMS_FILE = DATA_ROOT / "items.json"
SUGGEST_FILE = DATA_ROOT / "suggestions.json"

TEMPLATES_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

def ensure_dirs():
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    if not ITEMS_FILE.exists():
        ITEMS_FILE.write_text("[]", encoding="utf-8")
    if not SUGGEST_FILE.exists():
        SUGGEST_FILE.write_text("[]", encoding="utf-8")

ensure_dirs()

def load_json(file_path: Path):
    lock = FileLock(str(file_path) + ".lock")
    with lock:
        try:
            return json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            return []

def save_json_atomic(file_path: Path, data):
    lock = FileLock(str(file_path) + ".lock")
    with lock:
        tmp = file_path.with_suffix(file_path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(str(tmp), str(file_path))

async def save_upload_image(upload: UploadFile) -> str:
    extend = Path(upload.filename).suffix if upload.filename else ""
    name = f"{uuid.uuid4().hex}{extend}"
    dest = IMG_DIR / name
    async with aiofiles.open(dest, "wb") as out_file:
        content = await upload.read()
        await out_file.write(content)
    return name

@app.on_event("startup")
async def startup_event():
    ensure_dirs()

app.mount("/static", StaticFiles(directory="./static"), name="static")
app.mount("/data_files", StaticFiles(directory=str(DATA_ROOT)), name="data_files")

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    items = load_json(ITEMS_FILE)
    return templates.TemplateResponse("index.html", {"request": request, "items": items})

@app.get("/admin", response_class=HTMLResponse)
async def admin(request: Request):
    items = load_json(ITEMS_FILE)
    suggestions = load_json(SUGGEST_FILE)
    return templates.TemplateResponse("admin.html", {"request": request, "items": items, "suggestions": suggestions})

@app.post("/upload_item")
async def upload_item(
    name: str = Form(...),
    description: str = Form(""),
    method: str = Form(""),
    quantities_per_box: str = Form(""),
    uid_item: str = Form(None),
    image: UploadFile = File(None),
):
    items = load_json(ITEMS_FILE)
    image_name = None
    if image is not None and image.filename:
        image_name = await save_upload_image(image)

    item_uid = uid_item if uid_item else uuid.uuid4().hex
    new_item = {
        "Imagen": image_name,
        "Nombre": name,
        "Descripcion": description,
        "Metodo de despacho": method,
        "Cantidades por caja": quantities_per_box,
        "UID_Item": item_uid,
    }
    items.append(new_item)
    save_json_atomic(ITEMS_FILE, items)
    return RedirectResponse(url="/admin", status_code=303)

@app.post("/suggest")
async def suggest(uid_item: str = Form(...), suggester_name: str = Form(...), suggested_name: str = Form(...)):
    suggestions = load_json(SUGGEST_FILE)
    new = {"UID Item": uid_item, "Nombre de Quien sugiere": suggester_name, "Nombre Sugerido": suggested_name}
    suggestions.append(new)
    save_json_atomic(SUGGEST_FILE, suggestions)
    return RedirectResponse(url="/", status_code=303)