## Plan: RenderCV Web MVP

Objetivo: convertir la base Python ya funcional en un backend web estable para renderizar CVs y luego conectarlo a una interfaz gráfica. El enfoque recomendado es API-first, con validación temprana y entregables pequeños verificables.

**Steps**
1. Fase 1, Encapsular motor actual en servicio backend (bloqueante): crear capa de servicio que use el pipeline existente de RenderCV sin depender del CLI, con funciones para validar input y renderizar salidas (PDF, PNG, HTML, Markdown).
2. Fase 1, Definir contrato API (depende de 1): diseñar endpoints de validación y render, formato de request/response, códigos de error y estructura uniforme de errores de validación.
3. Fase 1, Modelo de ejecución MVP (depende de 2): iniciar en modo síncrono para simplicidad; fijar límites de tamaño de input y timeout para proteger recursos.
4. Fase 2, Archivos y persistencia (depende de 3): decidir almacenamiento temporal y ciclo de vida de artefactos; agregar limpieza automática de outputs expirados.
5. Fase 2, Seguridad y operación mínima (paralelo con 4): CORS, rate limiting básico, límites de payload, sanitización de nombres de archivo, logging estructurado y trazabilidad por request id.
6. Fase 3, UX de edición y preview (depende de 2): usar schema.json para formulario/autocompletado, validar en vivo y mostrar preview HTML/PNG antes del PDF final.
7. Fase 3, Distribución gratis inicial (depende de 5): desplegar backend y frontend en servicios gratuitos compatibles con Python, con observabilidad mínima y límites claros de uso.
8. Fase 4, Escalado posterior (depende de 7): colas asíncronas, caché de renders, autenticación opcional y almacenamiento persistente si crece el tráfico.

**Relevant files**
- d:/1projectshack/rendercv/rendercv/src/rendercv/schema/rendercv_model_builder.py — reutilizar para parseo y validación central.
- d:/1projectshack/rendercv/rendercv/src/rendercv/renderer/templater/templater.py — reutilizar para generación de contenido.
- d:/1projectshack/rendercv/rendercv/src/rendercv/renderer/typst.py — generación del archivo Typst.
- d:/1projectshack/rendercv/rendercv/src/rendercv/renderer/pdf_png.py — compilación PDF/PNG y manejo de paquetes Typst.
- d:/1projectshack/rendercv/rendercv/src/rendercv/renderer/html.py — salida HTML para preview web.
- d:/1projectshack/rendercv/rendercv/schema.json — base de validación/autocompletado en frontend.
- d:/1projectshack/rendercv/rendercv/src/rendercv/cli/render_command/run_rendercv.py — referencia de orquestación end-to-end.

**Verification**
1. Prueba de validación: enviar YAML inválido y comprobar errores estructurados con ubicación de campos.
2. Prueba de render: enviar YAML válido y verificar generación de PDF/PNG/HTML.
3. Prueba de estabilidad: ejecutar ráfaga corta de requests para validar timeouts y límites.
4. Prueba de integración frontend-backend: edición, preview y descarga completa.

**Decisions**
- Incluye: backend de render, API pública mínima, preview y descarga.
- Excluye por ahora: autenticación compleja, multiusuario, pagos, plantillas custom por usuario.
- Mantener metadatos/licencias del proyecto y de dependencias para cumplimiento legal.

**Further Considerations**
1. Modelo de ejecución para MVP: síncrono (simple) vs asíncrono (más robusto). Recomendación inicial: síncrono con límites estrictos.
2. Persistencia de artefactos: temporal en disco vs objeto remoto. Recomendación inicial: temporal con expiración.
3. Alcance de preview: HTML solo vs HTML más PNG. Recomendación inicial: HTML + PNG para acercarse al PDF final.
 USA CONTEXT 7 MCP PARA TENER TODO ACTUALIZADO A LAS VERSIONES ESTABLES SEGUTAS
 