'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { revalidateAccountingRoutes } from '../../shared/utils';
import { type CreateAccountInput } from '../../shared/types';
import { validateAccountCode, validateAccountNature, validateAccountParent } from '../../shared/validators';

/**
 * Crea una nueva cuenta contable
 */
export async function createAccount(params: { companyId: string, input: CreateAccountInput }) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.accounts', 'create', { redirect: true });
  try {
    const { companyId, input } = params;

    // Validaciones
    await validateAccountCode(companyId, input.code);
    await validateAccountParent(companyId, input.parentId);
    validateAccountNature(input.type, input.nature);

    const account = await prisma.account.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        nature: input.nature,
        description: input.description,
        parentId: input.parentId,
        companyId: companyId
      }
    });

    logger.info('Cuenta contable creada', { data: { accountId: account.id, userId } });
    revalidateAccountingRoutes(companyId);

    return account;
  } catch (error) {
    logger.error('Error al crear cuenta contable', { data: { error, userId } });
    throw error;
  }
}

/**
 * Actualiza una cuenta contable existente
 */
export async function updateAccount(companyId: string, accountId: string, input: Partial<CreateAccountInput>) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.accounts', 'update', { redirect: true });

  try {
    // Validar que la cuenta exista y pertenezca a la empresa
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    if (account.companyId !== companyId) {
      throw new Error('La cuenta no pertenece a la empresa');
    }

    // Validaciones si hay cambios en campos críticos
    if (input.code && input.code !== account.code) {
      await validateAccountCode(companyId, input.code, accountId);
    }

    if (input.parentId) {
      await validateAccountParent(companyId, input.parentId);
    }

    if (input.type && input.nature) {
      validateAccountNature(input.type, input.nature);
    }

    const updatedAccount = await prisma.account.update({
      where: { id: accountId },
      data: input,
    });

    logger.info('Cuenta contable actualizada', { data: { accountId, userId } });
    revalidateAccountingRoutes(companyId);

    return updatedAccount;
  } catch (error) {
    logger.error('Error al actualizar cuenta contable', { data: { error, accountId, userId } });
    throw error;
  }
}

/**
 * Elimina una cuenta contable (soft delete)
 */
export async function deleteAccount(companyId: string, accountId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.accounts', 'delete', { redirect: true });

  try {
    // Validar que la cuenta exista y pertenezca a la empresa
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        children: true,
        entries: true,
      },
    });

    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    if (account.companyId !== companyId) {
      throw new Error('La cuenta no pertenece a la empresa');
    }

    // No permitir eliminar si tiene subcuentas
    if (account.children.length > 0) {
      throw new Error('No se puede eliminar una cuenta con subcuentas');
    }

    // No permitir eliminar si tiene movimientos
    if (account.entries.length > 0) {
      throw new Error('No se puede eliminar una cuenta con movimientos');
    }

    // Soft delete
    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    logger.info('Cuenta contable eliminada', { data: { accountId, userId } });
    revalidateAccountingRoutes(companyId);

    return { success: true };
  } catch (error) {
    logger.error('Error al eliminar cuenta contable', { data: { error, accountId, userId } });
    throw error;
  }
}

/**
 * Obtiene todas las cuentas de una empresa
 */
export async function getAccounts(companyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.accounts', 'view', { redirect: true });

  try {
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    return accounts;
  } catch (error) {
    logger.error('Error al obtener cuentas contables', { data: { error, companyId, userId } });
    throw error;
  }
}

/**
 * Obtiene una cuenta contable por ID
 */
export async function getAccountById(companyId: string, accountId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('No autenticado');
  await checkPermission('accounting.accounts', 'view', { redirect: true });

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!account) {
      throw new Error('Cuenta no encontrada');
    }

    if (account.companyId !== companyId) {
      throw new Error('La cuenta no pertenece a la empresa');
    }

    return account;
  } catch (error) {
    logger.error('Error al obtener cuenta contable', { data: { error, accountId, userId } });
    throw error;
  }
}
