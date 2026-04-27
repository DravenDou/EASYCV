# RenderCV Web MVP - Estado Actual

Fecha: 2026-04-24

## Hecho hasta ahora
- Se levantó el entorno local con `uv sync --all-extras` y se validó que la base Python funciona.
- Se corrigió el manejo de `src/rendercv/renderer/typst_fontawesome` para que una carpeta vacía no rompa la compilación.
- Se ajustó la salida de progreso en Windows para evitar el `UnicodeEncodeError` del símbolo Unicode.
- Se implementó la base web en `src/rendercv/web/`:
  - modelos de request/response
  - servicio de validación y render
  - app FastAPI con `/health`, `/api/v1/validate` y `/api/v1/render`
  - runner `rendercv-web`
- Se agregó soporte web en `pyproject.toml` con extra `web` y script de ejecución.
- Se validó el flujo con un render real y con pruebas básicas de importación y ejecución del backend web.
- Se creó el frontend Next.js en `frontend/` y ya existe el MVP inicial.
- Se implementó la pantalla principal del frontend con:
  - editor de YAML
  - validación automática contra el backend
  - render de PDF, PNG y HTML
  - descarga de artefactos
- Se añadió un cliente API tipado y un YAML de ejemplo público para arrancar la interfaz.
- Se validó el frontend con `npm run lint` y `npm run build`.
- Se instaló HeroUI v3 y `next-themes` en el frontend.
- Se agregó `frontend/src/app/providers.tsx` y se conectó el provider de tema al layout.
- Se importó `@heroui/styles` en `frontend/src/app/globals.css` y se redefinió el shell visual.
- Se refactorizó la pantalla principal hacia una interfaz con HeroUI usando `Card`, `Chip`, `Button`, `Input`, `TextArea`, `TextField`, `Tabs` y `ScrollShadow`.
- Se volvió a validar el frontend con `npm run lint` y `npm run build` después del refactor visual.

## Falta por hacer
- Agregar persistencia temporal y limpieza automática de artefactos generados.
- Endurecer seguridad operativa:
  - rate limiting
  - límites de payload más estrictos si hace falta
  - autenticación opcional
  - logging estructurado
- Decidir el despliegue gratis y la estrategia de hosting.
- Separar la UI refactorizada en componentes más pequeños dentro de `frontend/src/components/`.
- Agregar overlays dedicados para exportación y configuración avanzada.
- Conectar selector de tema y mejorar navegación responsiva para móvil.
- Agregar más documentación de uso del backend web y de integración con el frontend.

## Observaciones
- La base actual ya sirve como backend funcional para una futura interfaz web.
- La licencia del proyecto sigue siendo MIT; no se retiró porque forma parte del cumplimiento de distribución.
- El frontend ya comenzó su refactor visual con HeroUI; el siguiente paso es modularizar y añadir overlays/tema.
