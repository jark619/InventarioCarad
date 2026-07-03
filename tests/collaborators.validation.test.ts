import { describe, expect, it } from 'vitest';
import {
  authBanDurationForActiveState,
  bearerToken,
  cleanCollaboratorPayload,
  validateCollaboratorCreate,
  validateCollaboratorUpdate,
} from '../lib/collaborators/validation';

describe('collaborator validation', () => {
  it('normalizes collaborator input before creating auth accounts', () => {
    const payload = cleanCollaboratorPayload({
      first_name: ' Ana ',
      last_name: ' Lopez ',
      employee_number: ' E-001 ',
      email: ' ANA@EXAMPLE.COM ',
      password: 'secret123',
      role: 'cashier',
      store_id: '',
    });

    expect(payload).toEqual({
      first_name: 'Ana',
      last_name: 'Lopez',
      employee_number: 'E-001',
      email: 'ana@example.com',
      password: 'secret123',
      role: 'cashier',
      store_id: null,
    });
  });

  it('requires email and password when creating a collaborator login', () => {
    const payload = cleanCollaboratorPayload({
      first_name: 'Ana',
      last_name: 'Lopez',
      employee_number: 'E-001',
      role: 'cashier',
    });

    expect(validateCollaboratorCreate(payload)).toBe('Captura nombre, apellidos, numero de empleado, correo, password y rol.');
  });

  it('rejects short passwords on create and update', () => {
    const createPayload = cleanCollaboratorPayload({
      first_name: 'Ana',
      last_name: 'Lopez',
      employee_number: 'E-001',
      email: 'ana@example.com',
      password: '123',
      role: 'cashier',
    });

    const updatePayload = cleanCollaboratorPayload({
      first_name: 'Ana',
      last_name: 'Lopez',
      employee_number: 'E-001',
      password: '123',
      role: 'cashier',
    });

    expect(validateCollaboratorCreate(createPayload)).toBe('El password debe tener al menos 6 caracteres.');
    expect(validateCollaboratorUpdate('collab-id', updatePayload)).toBe('El password debe tener al menos 6 caracteres.');
  });

  it('allows updating collaborator details without forcing an email or password change', () => {
    const payload = cleanCollaboratorPayload({
      first_name: 'Ana',
      last_name: 'Lopez',
      employee_number: 'E-001',
      role: 'inventory',
    });

    expect(validateCollaboratorUpdate('collab-id', payload)).toBe('');
  });

  it('maps active state to Supabase Auth ban duration', () => {
    expect(authBanDurationForActiveState(false)).toBe('876000h');
    expect(authBanDurationForActiveState(true)).toBe('none');
  });

  it('extracts bearer tokens case-insensitively', () => {
    const request = new Request('https://example.test', {
      headers: { authorization: 'bearer token-123' },
    });

    expect(bearerToken(request)).toBe('token-123');
  });
});
