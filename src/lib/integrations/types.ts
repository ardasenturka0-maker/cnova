export type ProviderResult = {
  ok: boolean;
  provider: string;
  reference: string;
  message: string;
};

export type MessagePayload = {
  to: string;
  message: string;
  subject?: string;
  patientId?: string;
};

export type PaymentPayload = {
  amount: number;
  currency: "TRY";
  description: string;
  patientId?: string;
};

export interface MessageProvider {
  send(payload: MessagePayload): Promise<ProviderResult>;
}

export interface PaymentProvider {
  charge(payload: PaymentPayload): Promise<ProviderResult>;
}
