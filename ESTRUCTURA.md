# Catalina Glossary — Estructura del Proyecto

## Árbol de Archivos

```
catalina_glossary/
│
├── app.py                          ← Punto de entrada Flask (BackEnd)
├── requirements.txt                ← Dependencias Python
│
├── templates/                      ← Plantillas HTML (Jinja2)
│   ├── index.html                  ← Vista pública del glosario
│   └── admin.html                  ← Panel de administración
│
└── static/                         ← Archivos estáticos servidos por Flask
    ├── css/
    │   ├── styles.css              ← Estilos globales (header, cards, modals)
    │   └── admin.css               ← Estilos exclusivos del panel admin
    ├── js/
    │   ├── main.js                 ← Lógica de la vista pública
    │   └── admin.js                ← Lógica del panel de administración
    └── img/
        ├── icon.png                ← Ícono alternativo
        ├── icon2.png               ← Ícono principal del header
        └── default.png             ← Imagen placeholder de productos
```

## Datos Guardados (fuera del proyecto)

```
{Usuario}/Documents/Yuuruii/Catalina Glossary/
│
├── items.json                      ← Lista de items del glosario
│   └── [ { uid_item, nombre, descripcion,
│             despacho, cajas, imagen }, ... ]
│
├── sugerencias.json                ← Sugerencias de nombres
│   └── [ { uid_sugerencia, uid_item,
│             nombre_sugerido, sugeridor }, ... ]
│
└── Img/
    └── Productos/
        └── {uid}.{ext}             ← Imágenes de productos
```

## Pasos para Ejecutar

### 1. Requisitos
- Python 3.10 o superior

### 2. Instalar dependencias
```bash
cd catalina_glossary
pip install -r requirements.txt
```

### 3. Iniciar el servidor
```bash
python app.py
```
El servidor se inicia en `http://0.0.0.0:5000`  
Soporta **múltiples usuarios simultáneos** gracias a `threaded=True`.

### 4. Acceder
| URL | Descripción |
|-----|-------------|
| `http://localhost:5000/` | Vista pública del glosario |
| `http://localhost:5000/admin` | Panel de administración |

## API REST (resumen)

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/items` | Listar items (acepta `?q=búsqueda`) |
| GET | `/api/items/<uid>` | Detalle + sugerencias de un item |
| POST | `/api/items` | Crear item (multipart/form-data) |
| PUT | `/api/items/<uid>` | Editar item (multipart/form-data) |
| DELETE | `/api/items/<uid>` | Eliminar item e imagen |
| POST | `/api/sugerencias` | Agregar sugerencia (JSON) |
| DELETE | `/api/sugerencias/<uid>` | Eliminar sugerencia |
| GET | `/product-img/<filename>` | Servir imagen de producto |
