# SGI SaaS - MVP

## Arranque local

1. Crea un proyecto en Supabase y ejecuta las migraciones de `supabase/migrations/` en orden.
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

Tras crear `jark619@gmail.com` en Supabase Auth, ejecuta `supabase/migrations/003_activate_demo_user.sql` en SQL Editor. Creara la tienda demo y dara el rol Admin con el plan Business activo.

## Siguiente iteracion recomendada

Anadir onboarding de tenant, carga de imagenes a un bucket `product-images`, dashboard de reportes, auditoria de movimientos y cola offline para ventas. Nunca expongas `service_role` en el cliente.
