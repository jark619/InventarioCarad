import type { Database } from '@/lib/supabase/database.types';

export type Role = Database['public']['Enums']['app_role'];

export type CollaboratorPayload = {
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

export const collaboratorRoles: Role[] = ['admin', 'inventory', 'cashier'];

export function bearerToken(request: Request) {
  return request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
}

export function cleanCollaboratorPayload(body: CollaboratorPayload) {
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

export function validateCollaboratorCreate(payload: ReturnType<typeof cleanCollaboratorPayload>) {
  if (!payload.first_name || !payload.last_name || !payload.employee_number || !payload.email || !payload.password || !payload.role) {
    return 'Captura nombre, apellidos, numero de empleado, correo, password y rol.';
  }

  if (!collaboratorRoles.includes(payload.role)) {
    return 'Rol invalido.';
  }

  if (payload.password.length < 6) {
    return 'El password debe tener al menos 6 caracteres.';
  }

  return '';
}

export function validateCollaboratorUpdate(id: string | undefined, payload: ReturnType<typeof cleanCollaboratorPayload>) {
  if (!id) {
    return 'Colaborador invalido.';
  }

  if (!payload.first_name || !payload.last_name || !payload.employee_number || !payload.role) {
    return 'Captura nombre, apellidos, numero de empleado y rol.';
  }

  if (!collaboratorRoles.includes(payload.role)) {
    return 'Rol invalido.';
  }

  if (payload.password && payload.password.length < 6) {
    return 'El password debe tener al menos 6 caracteres.';
  }

  return '';
}

export function authBanDurationForActiveState(active: boolean) {
  return active ? 'none' : '876000h';
}
