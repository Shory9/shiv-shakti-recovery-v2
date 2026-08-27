export type BankCode = "BOB" | "SBI";

export type BankContext = {
  code: BankCode;
  label: string;
  tables: {
    cases: "cases" | "sbi_cases";
    executives: "executives" | "sbi_executives";
    payments: "payments" | "sbi_payments";
    visits: "field_visits" | "sbi_field_visits";
    followups: "followups" | "sbi_followups";
    gpsLocations: "gps_locations" | "sbi_gps_locations";
  };
};

export const BANK_CONTEXTS: Record<BankCode, BankContext> = {
  BOB: {
    code: "BOB",
    label: "Bank of Baroda (BOB)",
    tables: {
      cases: "cases",
      executives: "executives",
      payments: "payments",
      visits: "field_visits",
      followups: "followups",
      gpsLocations: "gps_locations",
    },
  },
  SBI: {
    code: "SBI",
    label: "State Bank of India (SBI)",
    tables: {
      cases: "sbi_cases",
      executives: "sbi_executives",
      payments: "sbi_payments",
      visits: "sbi_field_visits",
      followups: "sbi_followups",
      gpsLocations: "sbi_gps_locations",
    },
  },
};

export function bankContext(code: BankCode): BankContext {
  return BANK_CONTEXTS[code];
}
