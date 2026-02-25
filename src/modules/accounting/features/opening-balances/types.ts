import type {
  getOpeningBalancesPageData,
  getOpeningBalanceInvoices,
} from './actions.server';

export type OpeningBalancesPageData = Awaited<
  ReturnType<typeof getOpeningBalancesPageData>
>;

export type AccountForOpening = OpeningBalancesPageData['accounts'][number];

export type OpeningBalanceInvoicesData = Awaited<
  ReturnType<typeof getOpeningBalanceInvoices>
>;

export type ExistingOpeningEntry =
  OpeningBalancesPageData['existingOpeningEntry'];
