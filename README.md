# SGI SaaS - MVP

## Arranque local

1. Crea un proyecto en Supabase y, para una instalacion nueva, pega y ejecuta `supabase/setup.sql` en el SQL Editor. Alternativamente, ejecuta las migraciones de `supabase/migrations/` en orden (no combines ambos metodos).
2. Copia `.env.example` a `.env.local` y completa las credenciales publicas.
3. La migracion `010_auto_create_user_tenant.sql` crea automaticamente el tenant y el perfil administrador cuando un usuario se registra.
4. `npm install` y `npm run dev`.

## Flujo MVP

El usuario crea un producto -> el POS lo encuentra por codigo (camara o lectora USB) -> `create_sale` registra venta y descuenta stock de forma atomica -> la vista `sales_report` ofrece ventas y alertas de bajo stock.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e importalo en Vercel.
2. Declara `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Environment Variables.
3. Despliega. Para camara, usa HTTPS (Vercel lo aporta automaticamente).

## Login y cobros SaaS

- En Supabase habilita **Email + Password** en Authentication > Providers y configura la URL de redireccion `https://TU_DOMINIO/auth/callback`.
- Ejecuta tambien `supabase/migrations/002_billing.sql`.
- Crea los precios recurrentes de Stripe y despliega las funciones: `supabase functions deploy create-checkout` y `supabase functions deploy stripe-webhook --no-verify-jwt`.
- Declara en Supabase Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`, `STRIPE_WEBHOOK_SECRET` y `APP_URL`. El webhook de Stripe debe apuntar a `https://PROJECT_REF.supabase.co/functions/v1/stripe-webhook` y escuchar `checkout.session.completed` y `customer.subscription.deleted`.

## Usuario demo

La forma mas directa es ejecutar `supabase/create_demo_user.sql` en Supabase SQL Editor despues de `supabase/setup.sql`. El archivo crea la cuenta Auth, la identidad Email/Password y el negocio de demostracion, y al final muestra una consulta de verificacion.

Para crear o restablecer el usuario administrador de demostracion de Dulceria Carad:

1. Completa `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
2. Define temporalmente la variable `DEMO_USER_PASSWORD` en la terminal.
3. Ejecuta `npm run demo:user`.

El comando confirma el correo, asigna el rol Admin y activa el plan Business. La contrasena no se guarda en el repositorio.

## Siguiente iteracion recomendada

Anadir onboarding de tenant, carga de imagenes a un bucket `product-images`, dashboard de reportes, auditoria de movimientos y cola offline para ventas. Nunca expongas `service_role` en el cliente.
