// Stałe i typy modułu Usług. Wydzielone z `@/actions/services` (plik "use server"
// może eksportować wyłącznie funkcje async — nie obiekty/typy).

export type RequestStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "DECLINED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type PriceModel = "fixed" | "hourly" | "quote";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  REQUESTED: "Zapytanie",
  ACCEPTED: "Zaakceptowane",
  DECLINED: "Odrzucone",
  SCHEDULED: "Umówione",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zakończone",
  CANCELLED: "Anulowane",
};

export const PRICE_MODEL_LABELS: Record<PriceModel, string> = {
  fixed: "Cena stała",
  hourly: "Za godzinę",
  quote: "Wycena indywidualna",
};

export type QuoteStatus = "SENT" | "ACCEPTED" | "REJECTED";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  SENT: "Wysłana",
  ACCEPTED: "Zaakceptowana",
  REJECTED: "Odrzucona",
};

export type ServiceMessageDTO = {
  id: string;
  body: string;
  mine: boolean;
  senderName: string | null;
  createdAt: string;
};

export type ServiceQuoteDTO = {
  id: string;
  amount: number; // grosze
  currency: string;
  message: string | null;
  status: QuoteStatus;
  validUntil: string | null;
  createdAt: string;
};

export type ServiceImageDTO = {
  id: string;
  url: string;
  caption: string | null;
};

export type PaymentMethod = "cash" | "transfer" | "card" | "other";
export type PaymentStatus = "UNPAID" | "PAID";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Gotówka",
  transfer: "Przelew",
  card: "Karta",
  other: "Inna",
};

export type ServicePaymentDTO = {
  amount: number; // grosze (brutto)
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  promoCode: string | null; // M16
  discount: number; // M16 — grosze; netto = amount - discount
  invoiceNo: string | null;
  paidAt: string | null;
};

// M17: spory/moderacja.
export type DisputeStatus = "OPEN" | "RESOLVED" | "REJECTED";
export type ServiceDisputeDTO = {
  id: string;
  reason: string;
  description: string | null;
  status: DisputeStatus;
  resolution: string | null;
  mine: boolean; // czy bieżący użytkownik zgłosił
  createdAt: string;
  resolvedAt: string | null;
};

// M16: kody rabatowe wykonawcy.
export type PromoKind = "percent" | "amount";
export type ServicePromoCodeDTO = {
  id: string;
  code: string;
  kind: PromoKind;
  value: number; // percent (1-100) lub grosze
  minAmount: number | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
};

export type RequestThreadDTO = {
  requestId: string;
  title: string;
  status: RequestStatus;
  role: "client" | "provider";
  messages: ServiceMessageDTO[];
  quotes: ServiceQuoteDTO[];
  payment: ServicePaymentDTO | null;
};

export type ServiceCategoryDTO = {
  id: string;
  name: string;
  icon: string;
  color: string;
  isSystem: boolean;
};

export type ListingDTO = {
  id: string;
  title: string;
  description: string | null;
  priceModel: PriceModel;
  priceAmount: number | null;
  currency: string;
  active: boolean;
  durationMin: number | null;
  bookingEnabled: boolean;
  category: { id: string; name: string; icon: string; color: string } | null;
  distanceKm: number | null;
  provider: {
    id: string;
    displayName: string;
    area: string | null;
    ratingAvg: number;
    ratingCount: number;
    verified: boolean;
    lat: number | null;
    lon: number | null;
  };
};

export type RequestDTO = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  preferredAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  listingTitle: string | null;
  listingId: string | null;
  bookingEnabled: boolean;
  durationMin: number | null;
  clientName: string;
  providerName: string;
  hasReview: boolean;
  rating: number | null;
};
