import { CardType, CardOwnerType } from '@/generated/prisma/enums';

export interface Card extends Record<string, unknown> {
  id: string;
  companyId: string;
  name: string;
  cardType: CardType;
  brand: string | null;
  lastFour: string | null;
  ownerType: CardOwnerType;
  partnerId: string | null;
  partnerName: string | null;
  creditLimit: number | null;
  closingDay: number | null;
  dueDay: number | null;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerOption {
  id: string;
  name: string;
}

// Labels para UI
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  DEBIT: 'Débito',
  CREDIT: 'Crédito',
};

export const CARD_OWNER_TYPE_LABELS: Record<CardOwnerType, string> = {
  COMPANY: 'Empresa',
  PARTNER: 'Socio',
};
