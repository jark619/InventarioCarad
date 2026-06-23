# SGI SaaS — MVP

## Arranque local

1. Crea un proyecto en Supabase y ejecuta `supabase/migrations/001_initial.sql` en SQL Editor.
2. Copia `.env.example` a `.env.local` y completa las credenciales públicas.
3. Crea un tenant y un perfil para el usuario autenticado (el onboarding administrativo puede añadirse después):

```sql
insert into public.tenants(name) values ('Mi tienda') returning id;
insert into public.profiles(id, tenant_id, role) values ('AUTH_USER_UUID', 'TENANT_UUID', 'admin');
```

4. `npm install` y `npm run dev`.

## Flujo MVP

El usuario crea un producto → el POS lo encuentra por código (cámara o lectora USB) → `create_sale` registra venta y descuenta stock de forma atómica → la vista `sales_report` ofrece ventas y alertas de bajo stock.

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel.
2. Declara `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Environment Variables.
3. Despliega. Para cámara, usa HTTPS (Vercel lo aporta automáticamente).

## Login y cobros SaaS

- En Supabase habilita **Email + Password** en Authentication > Providers y configura la URL de redirección `https://TU_DOMINIO/auth/callback`.
- Ejecuta también `supabase/migrations/002_billing.sql`.
- Crea los precios recurrentes de Stripe y despliega las funciones: `supabase functions deploy create-checkout` y `supabase functions deploy stripe-webhook --no-verify-jwt`.
- Declara en Supabase Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`, `STRIPE_WEBHOOK_SECRET` y `APP_URL`. El webhook de Stripe debe apuntar a `https://PROJECT_REF.supabase.co/functions/v1/stripe-webhook` y escuchar `checkout.session.completed` y `customer.subscription.deleted`.

## Siguiente iteración recomendada

Añadir onboarding de tenant, carga de imágenes a un bucket `product-images`, dashboard de reportes, auditoría de movimientos y cola offline para ventas. Nunca expongas `service_role` en el cliente.
