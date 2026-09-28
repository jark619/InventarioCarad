import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_USER_PASSWORD;

const email = 'sandoval.carmen2@gmail.com';
const businessName = 'Dulcería Carad';
const fullName = 'Carmen Sandoval';

if (!supabaseUrl || !serviceRoleKey || !password) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o DEMO_USER_PASSWORD.'
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('DEMO_USER_PASSWORD debe tener al menos 8 caracteres.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail() {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
}

async function ensureAuthUser() {
  let user = await findUserByEmail();

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: 'Carmen',
        last_name: 'Sandoval',
        store_name: businessName,
      },
    });
    if (error || !data.user) throw error ?? new Error('Supabase no devolvió el usuario.');
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      ...user.user_metadata,
      full_name: fullName,
      first_name: 'Carmen',
      last_name: 'Sandoval',
      store_name: businessName,
    },
  });
  if (error || !data.user) throw error ?? new Error('No se pudo actualizar el usuario.');
  return data.user;
}

async function ensureApplicationData(userId) {
  const { data: existingProfile, error: profileReadError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileReadError) throw profileReadError;

  let tenantId = existingProfile?.tenant_id;
  if (!tenantId) {
    const { data: tenant, error: tenantCreateError } = await supabase
      .from('tenants')
      .insert({
        name: businessName,
        plan: 'business',
        subscription_status: 'active',
        store_limit: 5,
      })
      .select('id')
      .single();
    if (tenantCreateError) throw tenantCreateError;
    tenantId = tenant.id;
  }

  const { error: tenantUpdateError } = await supabase
    .from('tenants')
    .update({
      name: businessName,
      plan: 'business',
      subscription_status: 'active',
      store_limit: 5,
    })
    .eq('id', tenantId);
  if (tenantUpdateError) throw tenantUpdateError;

  const { error: profileWriteError } = await supabase.from('profiles').upsert({
    id: userId,
    tenant_id: tenantId,
    role: 'admin',
    full_name: fullName,
    first_name: 'Carmen',
    last_name: 'Sandoval',
    is_administrator: true,
  });
  if (profileWriteError) throw profileWriteError;
}

try {
  const user = await ensureAuthUser();
  await ensureApplicationData(user.id);
  console.log(`Usuario demo listo: ${email} / ${businessName}`);
} catch (error) {
  console.error('No se pudo crear el usuario demo:', error.message ?? error);
  process.exit(1);
}

