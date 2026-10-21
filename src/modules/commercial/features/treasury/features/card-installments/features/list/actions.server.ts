'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { getActiveCompanyId } from '@/shared/lib/company';
import { parseSearchParams, stateToPrismaParams } from '@/shared/components/common/DataTable/helpers';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import { buildCardInstallmentsOrderBy, buildCardInstallmentsWhere } from './query';

/**
 * Obtiene el listado de cuotas de tarjeta de la empresa activa con paginación.
 * Cada cuota representa un egreso futuro: si la tarjeta es de la empresa se le
 * paga al banco; si es de un socio, se le devuelve al socio.
 */
export async function getCardInstallments(searchParams: DataTableSearchParams = {}) {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);
    const { skip, take } = stateToPrismaParams(state);
    const orderBy = buildCardInstallmentsOrderBy(state.sortBy, state.sortOrder);

    const where = {
      companyId,
      ...buildCardInstallmentsWhere(state.filters),
    };

    const [installments, total] = await Promise.all([
      prisma.paymentOrderInstallment.findMany({
        where,
        include: {
          card: {
            select: {
              name: true,
              ownerType: true,
              partner: { select: { name: true } },
            },
          },
          paymentOrder: { select: { fullNumber: true } },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.paymentOrderInstallment.count({ where }),
    ]);

    const data = installments.map((installment) => ({
      id: installment.id,
      number: installment.number,
      dueDate: installment.dueDate,
      amount: Number(installment.amount),
      status: installment.status,
      cardName: installment.card?.name ?? '-',
      ownerLabel:
        installment.card?.ownerType === 'PARTNER'
          ? installment.card?.partner?.name ?? 'Socio'
          : 'Empresa',
      originFullNumber: installment.paymentOrder?.fullNumber ?? '-',
    }));

    return {
      data,
      pagination: {
        page: state.page + 1,
        pageSize: state.pageSize,
        total,
        totalPages: Math.ceil(total / state.pageSize),
      },
    };
  } catch (error) {
    logger.error('Error al obtener cuotas de tarjeta', { data: { error } });
    throw new Error('Error al obtener cuotas de tarjeta');
  }
}

/**
 * Obtiene el total pendiente de pago (status PENDING) de las cuotas que cumplen los filtros
 * del listado. Se combina con AND para que un filtro "Pagada" dé total 0 en vez de pisarse.
 */
export async function getCardInstallmentsPendingTotal(searchParams: DataTableSearchParams = {}) {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);
    const result = await prisma.paymentOrderInstallment.aggregate({
      where: {
        companyId,
        AND: [buildCardInstallmentsWhere(state.filters), { status: 'PENDING' }],
      },
      _sum: { amount: true },
    });

    return Number(result._sum.amount ?? 0);
  } catch (error) {
    logger.error('Error al obtener total pendiente de cuotas', { data: { error } });
    throw new Error('Error al obtener total pendiente de cuotas');
  }
}

/**
 * Opciones para los filtros de Tarjeta y Titular: solo las tarjetas que tienen cuotas generadas
 * y los socios titulares de esas tarjetas.
 */
export async function getCardInstallmentFilterOptions() {
  await checkPermission('commercial.treasury.cards', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const cards = await prisma.card.findMany({
      where: { companyId, installments: { some: {} } },
      select: {
        id: true,
        name: true,
        ownerType: true,
        partner: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const partners = new Map<string, string>();
    cards.forEach((card) => {
      if (card.ownerType === 'PARTNER' && card.partner) {
        partners.set(card.partner.id, card.partner.name);
      }
    });

    return {
      cards: cards.map((card) => ({ value: card.id, label: card.name })),
      hasCompanyCards: cards.some((card) => card.ownerType === 'COMPANY'),
      partners: Array.from(partners, ([value, label]) => ({ value, label })).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    };
  } catch (error) {
    logger.error('Error al obtener opciones de filtro de cuotas', { data: { error } });
    throw new Error('Error al obtener opciones de filtro de cuotas');
  }
}
