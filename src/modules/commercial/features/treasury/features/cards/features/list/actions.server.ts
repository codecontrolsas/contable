'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/shared/lib/current-user';
import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { getActiveCompanyId } from '@/shared/lib/company';
import { CardOwnerType, CardType } from '@/generated/prisma/enums';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildFiltersWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { cardSchema, type CardFormData } from '../../shared/validators';
import type { Card, PartnerOption } from '../../shared/types';

const CARDS_PATH = '/dashboard/commercial/treasury/cards';

/**
 * Normaliza el resultado de Prisma a un objeto serializable (Decimal -> Number)
 */
function mapCard(card: {
  id: string;
  companyId: string;
  name: string;
  cardType: CardType;
  brand: string | null;
  lastFour: string | null;
  ownerType: CardOwnerType;
  partnerId: string | null;
  creditLimit: { toString(): string } | null;
  closingDay: number | null;
  dueDay: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  partner?: { name: string } | null;
}): Card {
  return {
    id: card.id,
    companyId: card.companyId,
    name: card.name,
    cardType: card.cardType,
    brand: card.brand,
    lastFour: card.lastFour,
    ownerType: card.ownerType,
    partnerId: card.partnerId,
    partnerName: card.partner?.name ?? null,
    creditLimit: card.creditLimit !== null ? Number(card.creditLimit) : null,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    isActive: card.isActive,
    createdBy: card.createdBy,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

/**
 * Construye los datos de tarjeta a persistir aplicando reglas de negocio:
 * - Campos de crédito solo si cardType = CREDIT
 * - partnerId solo si ownerType = PARTNER
 */
function buildCardData(data: CardFormData) {
  const isCredit = data.cardType === CardType.CREDIT;
  const isPartner = data.ownerType === CardOwnerType.PARTNER;

  return {
    name: data.name,
    cardType: data.cardType,
    brand: data.brand ? data.brand : null,
    lastFour: data.lastFour ? data.lastFour : null,
    ownerType: data.ownerType,
    partnerId: isPartner ? (data.partnerId as string) : null,
    creditLimit: isCredit && data.creditLimit !== undefined ? data.creditLimit : null,
    closingDay: isCredit && data.closingDay !== undefined ? data.closingDay : null,
    dueDay: isCredit && data.dueDay !== undefined ? data.dueDay : null,
    isActive: data.isActive ?? true,
  };
}

/**
 * Obtiene el listado de tarjetas de la empresa activa con paginación server-side
 */
export async function getCards(searchParams: DataTableSearchParams = {}) {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    const filtersWhere = buildFiltersWhere(
      state.filters,
      {
        cardType: 'cardType',
        ownerType: 'ownerType',
      },
      { exclude: ['name'] }
    );

    const nameFilter = state.filters['name']?.[0];
    const nameWhere = nameFilter
      ? { name: { contains: nameFilter, mode: 'insensitive' as const } }
      : {};

    const where = {
      companyId,
      ...filtersWhere,
      ...nameWhere,
    };

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: { partner: { select: { name: true } } },
        orderBy: orderBy || [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take,
      }),
      prisma.card.count({ where }),
    ]);

    return {
      data: cards.map(mapCard),
      pagination: {
        page: state.page + 1,
        pageSize: state.pageSize,
        total,
        totalPages: Math.ceil(total / state.pageSize),
      },
    };
  } catch (error) {
    logger.error('Error al obtener tarjetas', { data: { error } });
    throw new Error('Error al obtener tarjetas');
  }
}

/**
 * Obtiene una tarjeta por ID
 */
export async function getCard(id: string): Promise<Card | null> {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const card = await prisma.card.findFirst({
      where: { id, companyId },
      include: { partner: { select: { name: true } } },
    });

    if (!card) return null;
    return mapCard(card);
  } catch (error) {
    logger.error('Error al obtener tarjeta', { data: { error, id } });
    throw new Error('Error al obtener tarjeta');
  }
}

/**
 * Obtiene los socios activos de la empresa para el selector de titular.
 * Consulta prisma directo (no importa el módulo de socios).
 */
export async function getPartnersForSelect(): Promise<PartnerOption[]> {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const partners = await prisma.partner.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return partners;
  } catch (error) {
    logger.error('Error al obtener socios para selector', { data: { error } });
    throw new Error('Error al obtener socios');
  }
}

/**
 * Crea una nueva tarjeta
 */
export async function createCard(data: CardFormData): Promise<Card> {
  await checkPermission('commercial.treasury.cards', 'create', { redirect: true });
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('No autenticado');

    const companyId = await getActiveCompanyId();
    if (!companyId) throw new Error('No se encontró empresa activa');

    const validatedData = cardSchema.parse(data);

    // Validar que el socio exista y pertenezca a la empresa
    if (validatedData.ownerType === CardOwnerType.PARTNER && validatedData.partnerId) {
      const partner = await prisma.partner.findFirst({
        where: { id: validatedData.partnerId, companyId },
        select: { id: true },
      });
      if (!partner) throw new Error('El socio seleccionado no existe');
    }

    const card = await prisma.card.create({
      data: {
        companyId,
        createdBy: userId,
        ...buildCardData(validatedData),
      },
      include: { partner: { select: { name: true } } },
    });

    logger.info('Tarjeta creada', { data: { cardId: card.id, companyId } });

    revalidatePath(CARDS_PATH);

    return mapCard(card);
  } catch (error) {
    logger.error('Error al crear tarjeta', { data: { error, data } });
    if (error instanceof Error) throw error;
    throw new Error('Error al crear tarjeta');
  }
}

/**
 * Actualiza una tarjeta existente
 */
export async function updateCard(id: string, data: CardFormData): Promise<Card> {
  await checkPermission('commercial.treasury.cards', 'update', { redirect: true });
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('No autenticado');

    const companyId = await getActiveCompanyId();
    if (!companyId) throw new Error('No se encontró empresa activa');

    const validatedData = cardSchema.parse(data);

    const existing = await prisma.card.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new Error('Tarjeta no encontrada');

    if (validatedData.ownerType === CardOwnerType.PARTNER && validatedData.partnerId) {
      const partner = await prisma.partner.findFirst({
        where: { id: validatedData.partnerId, companyId },
        select: { id: true },
      });
      if (!partner) throw new Error('El socio seleccionado no existe');
    }

    const card = await prisma.card.update({
      where: { id },
      data: buildCardData(validatedData),
      include: { partner: { select: { name: true } } },
    });

    logger.info('Tarjeta actualizada', { data: { cardId: card.id, companyId, userId } });

    revalidatePath(CARDS_PATH);
    revalidatePath(`${CARDS_PATH}/${id}/edit`);

    return mapCard(card);
  } catch (error) {
    logger.error('Error al actualizar tarjeta', { data: { error, id, data } });
    if (error instanceof Error) throw error;
    throw new Error('Error al actualizar tarjeta');
  }
}

/**
 * Elimina una tarjeta
 */
export async function deleteCard(id: string): Promise<void> {
  await checkPermission('commercial.treasury.cards', 'delete', { redirect: true });
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('No autenticado');

    const companyId = await getActiveCompanyId();
    if (!companyId) throw new Error('No se encontró empresa activa');

    const existing = await prisma.card.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new Error('Tarjeta no encontrada');

    await prisma.card.delete({ where: { id } });

    logger.info('Tarjeta eliminada', { data: { cardId: id, companyId, userId } });

    revalidatePath(CARDS_PATH);
  } catch (error) {
    logger.error('Error al eliminar tarjeta', { data: { error, id } });
    if (error instanceof Error) throw error;
    throw new Error('Error al eliminar tarjeta');
  }
}
