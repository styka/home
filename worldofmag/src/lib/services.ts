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

export type RequestThreadDTO = {
  requestId: string;
  title: string;
  status: RequestStatus;
  role: "client" | "provider";
  messages: ServiceMessageDTO[];
  quotes: ServiceQuoteDTO[];
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
  provider: {
    id: string;
    displayName: string;
    area: string | null;
    ratingAvg: number;
    ratingCount: number;
    verified: boolean;
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
  clientName: string;
  providerName: string;
  hasReview: boolean;
  rating: number | null;
};
