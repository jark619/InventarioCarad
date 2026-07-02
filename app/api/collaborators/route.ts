import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseWithToken } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

type Role = Database['public']['Enums']['app_role'];

type CollaboratorPayload = {
  id?: string;
  first_name?: string;
  last_name?: string;
  employee_number?: string;
  email?: string;
  password?: string;
  role?: Role;
  store_id?: string | null;
  active?: boolean;
};

const roles: Role[] = ['admin', 'inventory', 'cashier'];

function bearerToken(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
}

function cleanPayload(body: CollaboratorPayload) {
  return {
    first_name: body.first_name?.trim() ?? '',
    last_name: body.last_name?.trim() ?? '',
    employee_number: body.employee_number?.trim() ?? '',
    email: body.email?.trim().toLowerCase() ?? '',
    password: body.password ?? '',
    role: body.role,
    store_id: body.store_id || null,
  };
}

async function getAdminContext(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return { error: NextResponse.json({ error: 'Inicia sesion para continuar.' }, { status: 401 }) };
  }

  const client = supabaseWithToken(token);
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) {
    return { error: NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('tenant_id,role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return { error: NextResponse.json({ error: 'Usuario sin tienda asignada.' }, { status: 403 }) };
  }

  if (profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Solo administradores pueden gestionar colaboradores.' }, { status: 403 }) };
  }

  return { user, profile };
}

export async function POST(request: Request) {
  const context = await getAdminContext(request);
  if ('error' in context) return context.error;

  const payload = cleanPayload(await request.json() as CollaboratorPayload);
  if (!payload.first_name || !payload.last_name || !payload.employee_number || !payload.email || !payload.password || !payload.role) {
    return NextResponse.json({ error: 'Captura nombre, apellidos, numero de empleado, correo, password y rol.' }, { status: 400 });
  }

  if (!roles.includes(payload.role)) {
    return NextResponse.json({ error: 'Rol invalido.' }, { status: 400 });
  }

  if (payload.password.length < 6) {
    return NextResponse.json({ error: 'El password debe tener al menos 6 caracteres.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const fullName = `${payload.first_name} ${payload.last_name}`.trim();

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    app_metadata: {
      skip_tenant_onboarding: true,
    },
    user_metadata: {
      full_name: fullName,
      first_name: payload.first_name,
      last_name: payload.last_name,
    },
  });

  if (createUserError || !createdUser.user) {
    return NextResponse.json({ error: createUserError?.message ?? 'No se pudo crear el usuario.' }, { status: 400 });
  }

  const userId = createdUser.user.id;
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    tenant_id: context.profile.tenant_id,
    role: payload.role,
    full_name: fullName,
    first_name: payload.first_name,
    last_name: payload.last_name,
    employee_number: payload.employee_number,
    is_administrator: payload.role === 'admin',
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const { data: collaborator, error: collaboratorError } = await admin
    .from('collaborators')
    .insert({
      tenant_id: context.profile.tenant_id,
      user_id: userId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      employee_number: payload.employee_number,
      email: payload.email,
      role: payload.role,
      store_id: payload.store_id,
      active: true,
    })
    .select('id,first_name,last_name,employee_number,email,role,store_id,active')
    .single();

  if (collaboratorError) {
    await admin.from('profiles').delete().eq('id', userId);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: collaboratorError.message }, { status: 400 });
  }

  return NextResponse.json({ collaborator });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext(request);
  if ('error' in context) return context.error;

  const body = await request.json() as CollaboratorPayload;
  const id = body.id?.trim();
  const payload = cleanPayload(body);
  const active = body.active ?? true;

  if (!id) {
    return NextResponse.json({ error: 'Colaborador invalido.' }, { status: 400 });
  }

  if (!payload.first_name || !payload.last_name || !payload.employee_number || !payload.role) {
    return NextResponse.json({ error: 'Captura nombre, apellidos, numero de empleado y rol.' }, { status: 400 });
  }

  if (!roles.includes(payload.role)) {
    return NextResponse.json({ error: 'Rol invalido.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: current, error: currentError } = await admin
    .from('collaborators')
    .select('id,user_id,tenant_id')
    .eq('id', id)
    .eq('tenant_id', context.profile.tenant_id)
    .single();

  if (currentError || !current) {
    return NextResponse.json({ error: 'Colaborador no encontrado.' }, { status: 404 });
  }

  const { error: collaboratorError } = await admin
    .from('collaborators')
    .update({
      first_name: payload.first_name,
      last_name: payload.last_name,
      employee_number: payload.employee_number,
      role: payload.role,
      store_id: payload.store_id,
      active,
    })
    .eq('id', id)
    .eq('tenant_id', context.profile.tenant_id);

  if (collaboratorError) {
    return NextResponse.json({ error: collaboratorError.message }, { status: 400 });
  }

  if (current.user_id) {
    const fullName = `${payload.first_name} ${payload.last_name}`.trim();
    const { error: profileError } = await admin
      .from('profiles')
      .update({
        role: payload.role,
        full_name: fullName,
        first_name: payload.first_name,
        last_name: payload.last_name,
        employee_number: payload.employee_number,
        is_administrator: payload.role === 'admin',
      })
      .eq('id', current.user_id)
      .eq('tenant_id', context.profile.tenant_id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (payload.password) {
      if (payload.password.length < 6) {
        return NextResponse.json({ error: 'El password debe tener al menos 6 caracteres.' }, { status: 400 });
      }

      const { error: passwordError } = await admin.auth.admin.updateUserById(current.user_id, {
        password: payload.password,
      });

      if (passwordError) {
        return NextResponse.json({ error: passwordError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
