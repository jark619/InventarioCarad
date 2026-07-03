import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseWithToken } from '@/lib/supabase/server';
import {
  authBanDurationForActiveState,
  bearerToken,
  cleanCollaboratorPayload,
  type CollaboratorPayload,
  validateCollaboratorCreate,
  validateCollaboratorUpdate,
} from '@/lib/collaborators/validation';

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

  const payload = cleanCollaboratorPayload(await request.json() as CollaboratorPayload);
  const validationError = validateCollaboratorCreate(payload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

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
  const id = body.id?.trim() ?? '';
  const payload = cleanCollaboratorPayload(body);
  const active = body.active ?? true;
  const validationError = validateCollaboratorUpdate(id, payload);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

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

    const { error: authError } = await admin.auth.admin.updateUserById(current.user_id, {
      ...(payload.password ? { password: payload.password } : {}),
      ban_duration: authBanDurationForActiveState(active),
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
