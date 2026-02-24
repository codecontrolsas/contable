import moment from 'moment';

export interface ScheduleEntryInput {
  periodNumber: number;
  scheduledDate: Date;
  amount: number;
  accumulatedAmount: number;
  bookValueAfter: number;
}

export interface DepreciationConfig {
  method: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
  grossValue: number;
  salvageValue: number;
  usefulLifeMonths: number;
  startDate: Date;
  depreciationRate?: number; // Tasa anual % para saldo decreciente
}

/**
 * Calcula el monto mensual de depreciación en línea recta.
 * (grossValue - salvageValue) / usefulLifeMonths
 */
export function calculateStraightLineMonthly(
  grossValue: number,
  salvageValue: number,
  usefulLifeMonths: number,
): number {
  if (usefulLifeMonths <= 0) return 0;
  const depreciableAmount = grossValue - salvageValue;
  if (depreciableAmount <= 0) return 0;
  return Math.round((depreciableAmount / usefulLifeMonths) * 100) / 100;
}

/**
 * Calcula el monto mensual de depreciación por saldo decreciente.
 * currentBookValue * (annualRate / 100 / 12)
 */
export function calculateDecliningBalanceMonthly(
  currentBookValue: number,
  annualRate: number,
): number {
  if (annualRate <= 0 || currentBookValue <= 0) return 0;
  const monthlyRate = annualRate / 100 / 12;
  return Math.round(currentBookValue * monthlyRate * 100) / 100;
}

/**
 * Genera el schedule completo de depreciación.
 * Retorna un array de entries, uno por cada mes de vida útil.
 */
export function generateDepreciationSchedule(
  config: DepreciationConfig,
): ScheduleEntryInput[] {
  const { method, grossValue, salvageValue, usefulLifeMonths, startDate, depreciationRate } =
    config;

  const entries: ScheduleEntryInput[] = [];
  let accumulatedAmount = 0;
  let currentBookValue = grossValue;

  for (let period = 1; period <= usefulLifeMonths; period++) {
    const scheduledDate = moment(startDate).add(period - 1, 'months').toDate();

    let amount: number;

    if (method === 'STRAIGHT_LINE') {
      amount = calculateStraightLineMonthly(grossValue, salvageValue, usefulLifeMonths);
    } else {
      amount = calculateDecliningBalanceMonthly(currentBookValue, depreciationRate ?? 0);
    }

    // En el último período, ajustar para no depreciar por debajo del valor residual
    if (period === usefulLifeMonths) {
      const maxAmount = currentBookValue - salvageValue;
      amount = Math.min(amount, Math.max(maxAmount, 0));
    }

    // No depreciar por debajo del valor residual
    if (currentBookValue - amount < salvageValue) {
      amount = Math.max(currentBookValue - salvageValue, 0);
    }

    amount = Math.round(amount * 100) / 100;
    accumulatedAmount = Math.round((accumulatedAmount + amount) * 100) / 100;
    currentBookValue = Math.round((currentBookValue - amount) * 100) / 100;

    entries.push({
      periodNumber: period,
      scheduledDate,
      amount,
      accumulatedAmount,
      bookValueAfter: currentBookValue,
    });

    // Si ya llegamos al valor residual, detenemos
    if (currentBookValue <= salvageValue) {
      break;
    }
  }

  return entries;
}

/**
 * Recalcula el schedule desde un período dado (para ajustes de valor).
 * Los períodos ya contabilizados se mantienen intactos.
 */
export function recalculateScheduleFromPeriod(
  config: {
    method: 'STRAIGHT_LINE' | 'DECLINING_BALANCE';
    newBookValue: number;
    salvageValue: number;
    remainingMonths: number;
    depreciationRate?: number;
    startPeriodNumber: number;
    startDate: Date;
  },
  previousAccumulated: number,
): ScheduleEntryInput[] {
  const {
    method,
    newBookValue,
    salvageValue,
    remainingMonths,
    depreciationRate,
    startPeriodNumber,
    startDate,
  } = config;

  const entries: ScheduleEntryInput[] = [];
  let accumulatedAmount = previousAccumulated;
  let currentBookValue = newBookValue;

  for (let i = 0; i < remainingMonths; i++) {
    const periodNumber = startPeriodNumber + i;
    const scheduledDate = moment(startDate).add(i, 'months').toDate();

    let amount: number;

    if (method === 'STRAIGHT_LINE') {
      amount = calculateStraightLineMonthly(newBookValue, salvageValue, remainingMonths);
    } else {
      amount = calculateDecliningBalanceMonthly(currentBookValue, depreciationRate ?? 0);
    }

    // Último período: ajustar
    if (i === remainingMonths - 1) {
      const maxAmount = currentBookValue - salvageValue;
      amount = Math.min(amount, Math.max(maxAmount, 0));
    }

    if (currentBookValue - amount < salvageValue) {
      amount = Math.max(currentBookValue - salvageValue, 0);
    }

    amount = Math.round(amount * 100) / 100;
    accumulatedAmount = Math.round((accumulatedAmount + amount) * 100) / 100;
    currentBookValue = Math.round((currentBookValue - amount) * 100) / 100;

    entries.push({
      periodNumber,
      scheduledDate,
      amount,
      accumulatedAmount,
      bookValueAfter: currentBookValue,
    });

    if (currentBookValue <= salvageValue) {
      break;
    }
  }

  return entries;
}

/**
 * Calcula la fecha de fin estimada a partir de la fecha de inicio y la vida útil.
 */
export function calculateEndDate(startDate: Date, usefulLifeMonths: number): Date {
  return moment(startDate).add(usefulLifeMonths - 1, 'months').toDate();
}
