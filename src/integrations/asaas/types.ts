export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
};

export type AsaasCreateCustomer = {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
};

export type AsaasCreditCard = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

export type AsaasCreditCardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone?: string;
  mobilePhone?: string;
};

export type AsaasSplit = {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
};

export type AsaasCreatePayment = {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  remoteIp?: string;
  creditCard?: AsaasCreditCard;
  creditCardHolderInfo?: AsaasCreditCardHolderInfo;
  creditCardToken?: string;
  split?: AsaasSplit[];
  postalService?: boolean;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: AsaasBillingType;
  status: string;
  value: number;
  netValue?: number;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  creditCard?: {
    creditCardNumber: string; // last4
    creditCardBrand: string;
    creditCardToken: string;
  };
};

export type AsaasPixQrCode = {
  encodedImage: string; // base64 PNG
  payload: string;
  expirationDate: string;
  success: boolean;
};

export type AsaasWebhookEvent = {
  id?: string;
  event: string;
  dateCreated?: string;
  payment: AsaasPayment & {
    [k: string]: unknown;
  };
};
