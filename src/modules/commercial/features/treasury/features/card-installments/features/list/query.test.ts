import { describe, expect, it } from 'vitest';
import {
  COMPANY_OWNER_FILTER_VALUE,
  buildCardInstallmentsOrderBy,
  buildCardInstallmentsWhere,
} from './query';

describe('buildCardInstallmentsOrderBy', () => {
  it('ordena por vencimiento ascendente si no hay columna de orden', () => {
    expect(buildCardInstallmentsOrderBy(null, 'asc')).toEqual([{ dueDate: 'asc' }]);
  });

  it('ordena por campos propios de la cuota de forma directa', () => {
    expect(buildCardInstallmentsOrderBy('amount', 'desc')).toEqual([{ amount: 'desc' }]);
    expect(buildCardInstallmentsOrderBy('dueDate', 'desc')).toEqual([{ dueDate: 'desc' }]);
  });

  it('ordena por el número de la OP de origen a través de la relación', () => {
    expect(buildCardInstallmentsOrderBy('originFullNumber', 'desc')).toEqual([
      { paymentOrder: { fullNumber: 'desc' } },
    ]);
  });

  it('ordena por el nombre de la tarjeta a través de la relación', () => {
    expect(buildCardInstallmentsOrderBy('cardName', 'asc')).toEqual([{ card: { name: 'asc' } }]);
  });

  it('ordena por titular: primero tipo de titular y luego nombre del socio', () => {
    expect(buildCardInstallmentsOrderBy('ownerLabel', 'asc')).toEqual([
      { card: { ownerType: 'asc' } },
      { card: { partner: { name: 'asc' } } },
    ]);
  });

  it('ignora columnas desconocidas en vez de mandarlas a Prisma', () => {
    expect(buildCardInstallmentsOrderBy('inexistente', 'desc')).toEqual([{ dueDate: 'asc' }]);
  });
});

describe('buildCardInstallmentsWhere', () => {
  it('sin filtros devuelve un where vacío', () => {
    expect(buildCardInstallmentsWhere({})).toEqual({});
  });

  it('filtra por estado', () => {
    expect(buildCardInstallmentsWhere({ status: ['PENDING'] })).toEqual({ status: { in: ['PENDING'] } });
  });

  it('filtra por tarjeta usando su id', () => {
    expect(buildCardInstallmentsWhere({ cardName: ['card-1', 'card-2'] })).toEqual({
      cardId: { in: ['card-1', 'card-2'] },
    });
  });

  it('filtra por titular combinando empresa y socios', () => {
    expect(
      buildCardInstallmentsWhere({ ownerLabel: [COMPANY_OWNER_FILTER_VALUE, 'partner-1'] })
    ).toEqual({
      AND: [
        {
          OR: [
            { card: { ownerType: 'COMPANY' } },
            { card: { partnerId: { in: ['partner-1'] } } },
          ],
        },
      ],
    });
  });

  it('filtra por número de OP de origen con búsqueda parcial', () => {
    expect(buildCardInstallmentsWhere({ originFullNumber: ['0001'] })).toEqual({
      paymentOrder: { fullNumber: { contains: '0001', mode: 'insensitive' } },
    });
  });

  it('convierte el rango de vencimiento a días calendario de Argentina', () => {
    // El DateRangeFilter manda medianoche de Argentina (03:00 UTC)
    const where = buildCardInstallmentsWhere({
      dueDate: ['2026-10-01T03:00:00.000Z', '2026-10-31T03:00:00.000Z'],
    });
    expect(where).toEqual({
      dueDate: {
        gte: new Date('2026-10-01T00:00:00.000Z'),
        lte: new Date('2026-10-31T00:00:00.000Z'),
      },
    });
  });

  it('acepta un rango de vencimiento abierto', () => {
    expect(buildCardInstallmentsWhere({ dueDate: ['', '2026-10-31T03:00:00.000Z'] })).toEqual({
      dueDate: { lte: new Date('2026-10-31T00:00:00.000Z') },
    });
  });

  it('ignora parámetros que no son columnas filtrables', () => {
    expect(buildCardInstallmentsWhere({ tab: ['x'], number: ['1'] })).toEqual({});
  });
});
