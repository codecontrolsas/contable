import moment from 'moment';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Construcción de where/orderBy del listado de cuotas de tarjeta.
 *
 * Varias columnas de la tabla (Tarjeta, Titular, Origen) son campos derivados de relaciones,
 * así que no se pueden pasar tal cual a Prisma: cada columna se traduce explícitamente y lo que
 * no se reconoce se descarta, para que un parámetro de URL nunca rompa la query.
 */

type SortOrder = 'asc' | 'desc';
type OrderBy = Prisma.PaymentOrderInstallmentOrderByWithRelationInput;

/** Valor del filtro "Titular" que representa a las tarjetas de la empresa (el resto son ids de socios) */
export const COMPANY_OWNER_FILTER_VALUE = 'COMPANY';

/** Offset de Argentina. Fijo: el país no aplica horario de verano desde 2009. */
const ARGENTINA_UTC_OFFSET = '-03:00';

const DEFAULT_ORDER_BY: OrderBy[] = [{ dueDate: 'asc' }];

const SORT_BUILDERS: Record<string, (order: SortOrder) => OrderBy[]> = {
  dueDate: (order) => [{ dueDate: order }],
  number: (order) => [{ number: order }],
  amount: (order) => [{ amount: order }],
  status: (order) => [{ status: order }],
  cardName: (order) => [{ card: { name: order } }],
  ownerLabel: (order) => [{ card: { ownerType: order } }, { card: { partner: { name: order } } }],
  originFullNumber: (order) => [{ paymentOrder: { fullNumber: order } }],
};

export function buildCardInstallmentsOrderBy(sortBy: string | null, sortOrder: SortOrder): OrderBy[] {
  const builder = sortBy ? SORT_BUILDERS[sortBy] : undefined;
  return builder ? builder(sortOrder) : DEFAULT_ORDER_BY;
}

/**
 * `dueDate` es una columna DATE (medianoche UTC), pero el filtro de rango manda la medianoche
 * de Argentina (03:00 UTC). Se lleva cada extremo al día calendario de Argentina para no
 * dejar afuera las cuotas del primer día del rango.
 */
function toCalendarDay(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = moment(value);
  if (!parsed.isValid()) return undefined;
  const day = parsed.utcOffset(ARGENTINA_UTC_OFFSET).format('YYYY-MM-DD');
  return moment.utc(day, 'YYYY-MM-DD').toDate();
}

export function buildCardInstallmentsWhere(
  filters: Record<string, string[]>
): Prisma.PaymentOrderInstallmentWhereInput {
  const where: Prisma.PaymentOrderInstallmentWhereInput = {};

  const status = filters.status?.filter(Boolean) ?? [];
  if (status.length > 0) {
    where.status = { in: status as Prisma.EnumPaymentInstallmentStatusFilter['in'] };
  }

  const cardIds = filters.cardName?.filter(Boolean) ?? [];
  if (cardIds.length > 0) {
    where.cardId = { in: cardIds };
  }

  const owners = filters.ownerLabel?.filter(Boolean) ?? [];
  if (owners.length > 0) {
    const partnerIds = owners.filter((owner) => owner !== COMPANY_OWNER_FILTER_VALUE);
    const ownerConditions: Prisma.PaymentOrderInstallmentWhereInput[] = [];
    if (owners.includes(COMPANY_OWNER_FILTER_VALUE)) {
      ownerConditions.push({ card: { ownerType: 'COMPANY' } });
    }
    if (partnerIds.length > 0) {
      ownerConditions.push({ card: { partnerId: { in: partnerIds } } });
    }
    where.AND = [{ OR: ownerConditions }];
  }

  const originNumber = filters.originFullNumber?.[0]?.trim();
  if (originNumber) {
    where.paymentOrder = { fullNumber: { contains: originNumber, mode: 'insensitive' } };
  }

  const from = toCalendarDay(filters.dueDate?.[0]);
  const to = toCalendarDay(filters.dueDate?.[1]);
  if (from || to) {
    where.dueDate = { ...(from && { gte: from }), ...(to && { lte: to }) };
  }

  return where;
}
