# CV Studio

Interfaz web para editar CVs en YAML, completar datos desde formulario y
previsualizar/descargar salidas generadas por el backend.

## Getting Started

Install dependencies and run the development server:

```bash
npm run dev
```

By default the frontend expects the backend at `http://127.0.0.1:8000`.
You can override it with:

```bash
NEXT_PUBLIC_RENDERCV_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Attribution

This project includes code derived from RenderCV, created by Sina Atalay and
contributors, licensed under the MIT License. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the full notice.

## Scripts

```bash
npm run lint
npm run build
```

## Deployment

Set `NEXT_PUBLIC_RENDERCV_API_BASE_URL` to the public backend URL in your
hosting provider before deploying.
