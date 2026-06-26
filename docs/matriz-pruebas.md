# Matriz de pruebas - InventarioCarad

Fecha de evidencia: 2026-06-26

## Resumen ejecutivo

| Item | Resultado | Evidencia |
| --- | --- | --- |
| Compilacion productiva | Aprobado | `npm run build` compilo Next.js 14.2.35 y genero 14 paginas sin errores de TypeScript/Next. |
| Verificacion de estilo | Aprobado | `npm run lint` finalizo sin warnings ni errores tras agregar configuracion y dependencias ESLint compatibles con Next 14. |
| Suite automatizada | No disponible | El repositorio no contiene pruebas unitarias comprometidas al momento de esta evidencia. |
| Revision estatica de flujos | Ejecutada | Se revisaron rutas en `app/`, componentes en `components/`, cliente Supabase en `lib/` y migraciones principales en `supabase/migrations/`. |

## Hallazgos para desarrollo

| ID | Severidad | Flujo | Hallazgo | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Media | Calidad / CI | Corregido: `npm run lint` ya puede ejecutarse de forma no interactiva y termina sin warnings ni errores. | `.eslintrc.json`, `package.json`, `package-lock.json`. | Mantener lint como verificacion obligatoria en CI. |
| QA-002 | Media | POS | Corregido: el carrito ya no permite agregar mas unidades de un producto que la existencia disponible. | `app/pos/page.tsx`, funcion `add`. | Cubrir con prueba unitaria UT-008. |
| QA-003 | Baja | Reportes | Corregido: la carga de reportes muestra un mensaje visible cuando falla la consulta de Supabase. | `app/reports/page.tsx`, funcion `load`. | Cubrir con prueba unitaria UT-012. |
| QA-004 | Baja | Interfaz | Corregido parcialmente: desarrollo normalizo textos visibles en rutas/componentes principales. | `app/page.tsx`, `app/pricing/page.tsx`, `app/profile/page.tsx`, `app/team/page.tsx`, `components/dashboard.tsx`. | Mantener revision de textos visibles en QA manual. |
| QA-005 | Alta | POS / integridad de precios | Corregido: `create_sale` usa el precio de `products.price` dentro de la base de datos y ya no confia en `unit_price` enviado por el cliente. | `supabase/migrations/009_secure_sales_and_billing.sql`. | Aplicar migracion en Supabase y cubrir con prueba DB UT-031. |
| QA-006 | Media | Dashboard | Corregido: el producto mas vendido lee la relacion `products(name)` como objeto relacionado. | `components/dashboard.tsx`. | Validar con datos reales de ventas. |
| QA-007 | Alta | Facturacion Stripe | Corregido: el webhook actualiza `store_limit` segun plan y revierte a trial/1 tienda al cancelar. | `supabase/functions/stripe-webhook/index.ts`, `supabase/migrations/009_secure_sales_and_billing.sql`. | Probar con Stripe test mode. |
| QA-008 | Media | Facturacion / auditoria | Corregido: los eventos Stripe se guardan con `tenant_id` cuando se puede resolver desde metadata o suscripcion. | `supabase/functions/stripe-webhook/index.ts`. | Probar lectura de eventos con usuario admin del tenant. |
| QA-009 | Alta | Auth / onboarding | Pendiente: el registro crea usuario Auth, pero no crea automaticamente tenant/perfil; el README indica hacerlo manualmente. | `app/login/page.tsx`, `README.md`, `supabase/functions/create-checkout/index.ts`. | Implementar onboarding automatico o trigger/RPC para crear tenant y perfil tras signup. |

## Matriz funcional ejecutada

| Flujo | Caso | Tipo | Estado | Resultado esperado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Autenticacion | Login con email/password | Revision estatica | Cubierto | Enviar credenciales a Supabase y redirigir a inicio si hay sesion. | `app/login/page.tsx` |
| Autenticacion | Registro con confirmacion por correo | Revision estatica | Cubierto | Crear usuario, usar callback `/auth/callback` y mostrar mensaje si requiere confirmacion. | `app/login/page.tsx`, `app/auth/callback/route.ts` |
| Inventario | Cargar productos activos | Revision estatica | Cubierto | Listar productos `is_active = true` ordenados por nombre. | `app/inventory/page.tsx` |
| Inventario | Crear producto con imagen | Revision estatica | Cubierto | Validar campos, subir imagen a `product-images`, insertar producto. | `components/product-form.tsx` |
| Inventario | Editar producto existente | Revision estatica | Cubierto | Precargar datos, permitir cambiar campos e imagen opcional. | `components/product-form.tsx` |
| Inventario | Validar codigo duplicado | Revision estatica | Cubierto | Mostrar aviso si otro producto activo usa el mismo codigo. | `components/product-form.tsx` |
| Inventario | Retirar producto | Revision estatica | Cubierto | Marcar `is_active = false` sin borrar historial. | `app/inventory/page.tsx` |
| POS | Buscar producto por codigo | Revision estatica | Cubierto | Agregar producto activo al carrito o mostrar no encontrado/sin existencias. | `app/pos/page.tsx` |
| POS | Cobrar venta | Revision estatica | Cubierto | Enviar items a RPC `create_sale`, vaciar carrito si la venta fue exitosa. | `app/pos/page.tsx`, `supabase/migrations/001_initial.sql` |
| Reportes | Ver productos, vendidos y bajo stock | Revision estatica | Cubierto con observacion | Leer `sales_report`, calcular totales y alertas. | `app/reports/page.tsx` |
| Tiendas | Crear sucursal | Revision estatica | Cubierto | Usar RPC `create_store`, respetar limite del plan y recargar lista. | `app/stores/page.tsx`, `supabase/migrations/004_promotions_stores_staff.sql` |
| Equipo | Crear, editar y desactivar colaborador | Revision estatica | Cubierto | Administrar colaboradores con tienda, rol y estado. | `app/team/page.tsx`, `supabase/migrations/008_collaborators_crud.sql` |
| Promociones | Crear, editar, activar/desactivar promocion | Revision estatica | Cubierto | Gestionar codigos de descuento por tienda o globales. | `app/promotions/page.tsx` |
| Perfil | Actualizar nombre visible | Revision estatica | Cubierto | Invocar RPC `update_my_profile` y mostrar resultado. | `app/profile/page.tsx` |
| Planes | Iniciar checkout Stripe | Revision estatica | Cubierto | Requerir sesion e invocar Edge Function `create-checkout`. | `app/pricing/page.tsx`, `supabase/functions/create-checkout/index.ts` |
| Webhook Stripe | Activar/cancelar suscripcion | Revision estatica | Pendiente de prueba integrada | Procesar eventos de Stripe desde Edge Function. | `supabase/functions/stripe-webhook/index.ts` |

## Matriz recomendada de pruebas unitarias

| ID | Flujo | Unidad bajo prueba | Caso unitario | Datos de entrada | Resultado esperado | Prioridad |
| --- | --- | --- | --- | --- | --- | --- |
| UT-001 | Inventario | `ProductForm` | Rechaza alta sin imagen nueva | Campos validos sin archivo | Muestra error y no llama insert. | Alta |
| UT-002 | Inventario | `ProductForm` | Rechaza codigo duplicado | Supabase devuelve producto activo distinto | Muestra aviso de duplicado y no guarda. | Alta |
| UT-003 | Inventario | `ProductForm` | Permite editar sin reemplazar imagen | Producto existente sin archivo nuevo | Actualiza payload conservando `image_url`. | Alta |
| UT-004 | Inventario | `Inventory` | Filtra por nombre, codigo y categoria | Lista con coincidencias parciales | Renderiza solo productos coincidentes. | Media |
| UT-005 | Inventario | `Inventory` | Retira producto activo | Confirmacion aceptada | Ejecuta update `is_active=false` y recarga. | Alta |
| UT-006 | POS | `Pos` | Agrega producto por codigo | Producto activo con stock | Agrega linea al carrito y actualiza total. | Alta |
| UT-007 | POS | `Pos` | Bloquea producto sin existencias | Producto con `quantity=0` | Muestra `Sin existencias` y no agrega linea. | Alta |
| UT-008 | POS | `Pos` | No excede stock en carrito | Stock 1 y dos lecturas del mismo codigo | Segunda lectura muestra aviso y no incrementa unidades. | Alta |
| UT-009 | POS | `Pos` | Cobra venta exitosa | Carrito con items | Invoca RPC `create_sale`, vacia carrito y muestra confirmacion. | Alta |
| UT-010 | POS | `Pos` | Maneja error de RPC | RPC devuelve error de stock | Mantiene carrito y muestra mensaje de error. | Alta |
| UT-011 | Reportes | `ReportsPage` | Calcula bajo stock | Productos con quantity <= threshold | Contador de alertas coincide. | Media |
| UT-012 | Reportes | `ReportsPage` | Muestra error de carga | Supabase devuelve error | Renderiza mensaje de error. | Media |
| UT-013 | Tiendas | `StoresPage` | Crea tienda valida | Nombre con espacios | Envia nombre limpio a `create_store`, limpia formulario y recarga. | Media |
| UT-014 | Tiendas | `StoresPage` | Muestra limite de plan | Perfil con `store_limit=1` y una tienda | Muestra usadas 1 de 1. | Media |
| UT-015 | Equipo | `TeamPage` | Valida campos requeridos | Falta numero de empleado | Muestra mensaje y no inserta. | Alta |
| UT-016 | Equipo | `TeamPage` | Edita colaborador | Registro existente | Actualiza payload y restablece modo edicion. | Media |
| UT-017 | Equipo | `TeamPage` | Desactiva colaborador | ID valido | Ejecuta update `active=false` y recarga. | Media |
| UT-018 | Promociones | `PromotionsPage` | Normaliza codigo | Codigo ` verano10 ` | Guarda `VERANO10`. | Media |
| UT-019 | Promociones | `PromotionsPage` | Rechaza descuento cero | `discount_value=0` | Muestra mensaje y no guarda. | Alta |
| UT-020 | Promociones | `PromotionsPage` | Alterna estado | Promocion activa | Actualiza `active=false` y recarga. | Media |
| UT-021 | Perfil | `ProfilePage` | Guarda nombre | Nombre editado | Invoca `update_my_profile` y muestra exito. | Media |
| UT-022 | Planes | `PricingPage` | Redirige a login sin sesion | Sin sesion Supabase | Cambia ubicacion a `/login?next=/pricing`. | Alta |
| UT-023 | Planes | `PricingPage` | Redirige a Stripe con sesion | Edge Function devuelve URL | Navega a URL de checkout. | Alta |
| UT-024 | Auth | `LoginPage` | Login exitoso | Supabase devuelve sesion | Redirige a `/` y refresca router. | Alta |
| UT-025 | Auth | `LoginPage` | Registro requiere confirmacion | `signUp` sin sesion | Muestra instruccion de revisar correo. | Media |
| UT-026 | Callback Auth | `GET /auth/callback` | Intercambia codigo | Query `code` valido | Llama `exchangeCodeForSession` y redirige a `/`. | Alta |
| UT-027 | Edge Checkout | `create-checkout` | Rechaza plan invalido | Plan desconocido | Devuelve error controlado. | Alta |
| UT-028 | Edge Webhook | `stripe-webhook` | Procesa checkout completado | Evento `checkout.session.completed` | Actualiza tenant/suscripcion segun metadata. | Alta |
| UT-029 | Edge Webhook | `stripe-webhook` | Procesa cancelacion | Evento `customer.subscription.deleted` | Marca plan como cancelado o downgrade esperado. | Alta |
| UT-030 | Seguridad DB | RPC `create_sale` | Bloquea rol no autorizado | Usuario sin rol admin/cashier | Lanza `No autorizado`. | Alta |
| UT-031 | Seguridad DB | RPC `create_sale` | Venta atomica sin stock | Cantidad mayor a existencia | No crea venta ni descuenta inventario. | Alta |
| UT-032 | Seguridad DB | RLS tenant | Aisla datos por tenant | Usuario de tenant A consulta tenant B | No devuelve registros ajenos. | Alta |

## Criterios de cierre QA

| Criterio | Estado actual | Proximo paso |
| --- | --- | --- |
| Build productivo exitoso | Cumplido | Mantener en CI. |
| Lint automatico ejecutable | Cumplido | Mantener en CI. |
| Pruebas unitarias por flujo critico | Pendiente | Incorporar framework de pruebas y cubrir UT-001 a UT-032. |
| Prueba manual con Supabase real | Pendiente | Ejecutar con usuario admin, inventory y cashier. |
| Pruebas Stripe end-to-end | Pendiente | Ejecutar con Stripe test mode y webhook local/remoto. |
