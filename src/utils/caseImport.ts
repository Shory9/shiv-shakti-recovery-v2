import * as XLSX from "xlsx";

export type BankFileFormat =
  | "detailed"
  | "compact"
  | "unknown";

export type ParsedCase = {
  customerName: string;
  mobile: string;
  bankName: string;
  branchName: string;
  address: string;
  accountNo: string;
  loanType: string;
  schemeCode: string;
  accountSegment: string;
  assetClassification: string;
  loanAmount: number;
  pendingAmount: number;
  sanctionLimit: number;
  customerBalance: number;
  alpha: string;
  resolvedArea: string;
};

export type CaseDatabaseRow = {
  customer_name: string;
  mobile: string;
  bank_name: string;
  branch_name: string;
  address: string;
  account_no: string;
  loan_type: string;
  scheme_code: string;
  account_segment: string;
  asset_classification: string;
  loan_amount: number;
  pending_amount: number;
  sanction_limit: number;
  customer_balance: number;
  assigned_agent: number | null;
  status: "Pending";
  remarks: string;
};

export type ParseBankFileResult = {
  format: BankFileFormat;
  sheetName: string;
  cases: ParsedCase[];
  duplicateCount: number;
  missingAddressCount: number;
};

type RawRow = Record<string, unknown>;

const ALPHA_AREA_MAP: Record<string, string> = {
  BAMANI: "Bamaniya",
  MANDSA: "Mandsaur",
  NEEMUC: "Neemuch",
  SAILAN: "Sailana",
  MANASA: "Manasa",
  BILPAN: "Bilpank",
  MANAWA: "Manavar",
  JAORA: "Jaora",
  VJNEEM: "CRPF Neemuch",
  DBMSUR: "MEN DB Mandsaur",
};

const ADDRESS_AREA_RULES: Array<{
  area: string;
  keywords: string[];
}> = [
  {
    area: "CRPF Neemuch",
    keywords: [
      "CRPF ROAD NEEMUCH",
      "CRPF NEEMUCH",
      "CRPF ROAD",
      "VJNEEM",
    ],
  },
  {
    area: "Pustak Bajar Neemuch",
    keywords: [
      "PUSTAK BAJAR NEEMUCH",
      "PUSTAK BAZAR NEEMUCH",
      "PUSTAK BAJAR",
      "PUSTAK BAZAR",
    ],
  },
  {
    area: "MEN DB Mandsaur",
    keywords: [
      "MEN DB MANDSAUR",
      "DB MANDSAUR",
      "DBMSUR",
    ],
  },
  {
    area: "Station Road Ratlam",
    keywords: [
      "STATION ROAD RATLAM",
      "STATION ROAD",
    ],
  },
  {
    area: "Alkapuri Ratlam",
    keywords: [
      "ALKAPURI RATLAM",
      "ALKAPURI",
    ],
  },
  {
    area: "College Road Ratlam",
    keywords: [
      "COLLEGE ROAD RATLAM",
      "COLLEGE ROAD",
    ],
  },
  {
    area: "Chandni Chowk Ratlam",
    keywords: [
      "CHANDNI CHOWK RATLAM",
      "CHANDNI CHOWK",
      "CHANDNI CHAUK",
    ],
  },
  {
    area: "Bamaniya",
    keywords: [
      "BAMANIYA MANDI",
      "BAMANIA MANDI",
      "BAMANIYA",
      "BAMANIA",
      "BAMANI",
    ],
  },
  {
    area: "Khachrod",
    keywords: [
      "KHACHROD",
      "KHACHRAUD",
    ],
  },
  {
    area: "Bilpank",
    keywords: [
      "BILPANK",
      "BILPAN",
      "BILPAAK",
    ],
  },
  {
    area: "Sailana",
    keywords: [
      "SAILANA",
      "SAILAN",
    ],
  },
  {
    area: "Manasa",
    keywords: ["MANASA"],
  },
  {
    area: "Mandsaur",
    keywords: [
      "MANDSAUR",
      "MANDSA",
    ],
  },
  {
    area: "Neemuch",
    keywords: [
      "NEEMUCH",
      "NEEMUC",
    ],
  },
  {
    area: "Jaora",
    keywords: ["JAORA"],
  },
  {
    area: "Dhar",
    keywords: [
      "DHAAR",
      "DHAR",
    ],
  },
  {
    area: "Manavar",
    keywords: [
      "MANAWAR",
      "MANAVAR",
      "MANAWA",
    ],
  },
  {
    area: "Tonki",
    keywords: ["TONKI"],
  },
  {
    area: "Petlawad",
    keywords: [
      "PETLAWAD",
      "PETLAWADA",
    ],
  },
];

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getValue(
  row: RawRow,
  possibleHeaders: string[]
) {
  const rowKeys = Object.keys(row);

  for (const header of possibleHeaders) {
    const wanted = normalizeHeader(header);

    const matchedKey = rowKeys.find(
      (key) =>
        normalizeHeader(key) === wanted
    );

    if (matchedKey) {
      return String(
        row[matchedKey] ?? ""
      ).trim();
    }
  }

  return "";
}

function hasHeader(
  row: RawRow,
  possibleHeaders: string[]
) {
  const rowHeaders = Object.keys(row).map(
    normalizeHeader
  );

  return possibleHeaders.some((header) =>
    rowHeaders.includes(
      normalizeHeader(header)
    )
  );
}

export function parseBankAmount(
  value: unknown
) {
  const original = String(
    value ?? ""
  ).trim();

  if (!original) return 0;

  const cleaned = original
    .replace(/[₹,\s]/g, "")
    .replace(/[^0-9.eE+-]/g, "");

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  const absolute = Math.abs(parsed);

  const rupeeAmount =
    absolute > 0 && absolute < 10000
      ? parsed * 100000
      : parsed;

  return (
    Math.round(rupeeAmount * 100) /
    100
  );
}

export function resolveCaseArea(
  alpha: string,
  branchName: string,
  address: string
) {
  const normalizedBranch = normalizeText(branchName);

  // 1) Bank branch/market is the primary assignment source.
  // Example: BAMANIA MANDI branch cases stay in Bamaniya even when
  // the customer's address contains Petlawad or another nearby place.
  for (const rule of ADDRESS_AREA_RULES) {
    const branchMatched = rule.keywords.some((keyword) =>
      normalizedBranch.includes(normalizeText(keyword))
    );

    if (branchMatched) {
      return rule.area;
    }
  }

  // 2) Alpha is the bank market-code fallback.
  // Special Alpha codes such as DBMSUR and VJNEEM still remain separate.
  const normalizedAlpha = normalizeText(alpha);

  if (ALPHA_AREA_MAP[normalizedAlpha]) {
    return ALPHA_AREA_MAP[normalizedAlpha];
  }

  // 3) Address is used only when branch and Alpha do not resolve an area.
  const normalizedAddress = normalizeText(address);

  for (const rule of ADDRESS_AREA_RULES) {
    const addressMatched = rule.keywords.some((keyword) =>
      normalizedAddress.includes(normalizeText(keyword))
    );

    if (addressMatched) {
      return rule.area;
    }
  }

  return "";
}

function detectFileFormat(
  firstRow: RawRow
): BankFileFormat {
  const isDetailed =
    hasHeader(firstRow, [
      "Account ID",
      "Customer Name",
    ]) &&
    hasHeader(firstRow, [
      "O/S Balance",
      "OS Balance",
    ]);

  if (isDetailed) {
    return "detailed";
  }

  const isCompact =
    hasHeader(firstRow, [
      "A/C No",
      "A/C Name",
    ]) &&
    hasHeader(firstRow, [
      "Cust. Bal",
      "CUST BAL",
      "Balance [INR]",
    ]);

  if (isCompact) {
    return "compact";
  }

  return "unknown";
}

function parseRow(
  row: RawRow,
  format: BankFileFormat,
  selectedBankName: string
): ParsedCase {
  const accountNo = getValue(row, [
    "Account ID",
    "A/C No",
    "Account No",
    "Account Number",
  ]);

  const customerName = getValue(row, [
    "Customer Name",
    "A/C Name",
    "Borrower Name",
    "Name",
  ]);

  const mobile = getValue(row, [
    "MOBILE NO",
    "MOBILE",
    "Mobile No",
    "Mobile",
    "Phone",
    "Contact",
  ]);

  const branchName = getValue(row, [
    "Branch Name",
    "Branch",
  ]);

  const address = getValue(row, [
    "ADDRESS",
    "Address",
    "Customer Address",
    "Location",
  ]);

  const alpha = getValue(row, [
    "Alpha",
  ]).toUpperCase();

  const schemeCode = getValue(row, [
    "Scheme Code",
    "Loan Type",
    "Product",
    "Type",
  ]);

  const accountSegment = getValue(row, [
    "Account Segment",
    "REV SEG",
  ]);

  const assetClassification =
    getValue(row, [
      "Asset Classification",
      "Class",
      "Category",
    ]).toUpperCase();

  const detailedBalance = getValue(
    row,
    [
      "O/S Balance",
      "OS Balance",
      "Outstanding",
      "Loan Amount",
      "Balance [INR]",
    ]
  );

  const compactBalance = getValue(
    row,
    [
      "Cust. Bal",
      "CUST BAL",
      "Customer Balance",
      "Balance [INR]",
    ]
  );

  const amountText =
    format === "compact"
      ? compactBalance
      : detailedBalance ||
        compactBalance;

  const sanctionLimit =
    parseBankAmount(
      getValue(row, [
        "Sanction Limit",
      ])
    );

  const customerBalance =
    parseBankAmount(
      compactBalance
    );

  const loanAmount =
    parseBankAmount(amountText);

  const resolvedArea =
    resolveCaseArea(
      alpha,
      branchName,
      address
    );

  return {
    customerName,
    mobile,
    bankName: selectedBankName,
    branchName,
    address,
    accountNo,
    loanType:
      schemeCode || "Recovery",
    schemeCode:
      schemeCode || "Recovery",
    accountSegment,
    assetClassification,
    loanAmount,
    pendingAmount: loanAmount,
    sanctionLimit,
    customerBalance,
    alpha,
    resolvedArea,
  };
}

export async function parseBankExcel(
  file: File,
  selectedBankName: string
): Promise<ParseBankFileResult> {
  const arrayBuffer =
    await file.arrayBuffer();

  const workbook = XLSX.read(
    arrayBuffer,
    {
      type: "array",
    }
  );

  const sheetName =
    workbook.SheetNames.find(
      (name) => {
        const normalized =
          name.trim().toUpperCase();

        return (
          normalized === "NPA LIST" ||
          normalized === "LIST"
        );
      }
    ) || workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      "Excel me koi sheet nahi mili."
    );
  }

  const sheet =
    workbook.Sheets[sheetName];

  const rawRows =
    XLSX.utils.sheet_to_json<RawRow>(
      sheet,
      {
        defval: "",
        raw: true,
      }
    );

  if (rawRows.length === 0) {
    throw new Error(
      "Excel sheet empty hai."
    );
  }

  const format =
    detectFileFormat(rawRows[0]);

  if (format === "unknown") {
    throw new Error(
      "Excel headers supported format se match nahi hue."
    );
  }

  const parsedRows = rawRows
    .map((row) =>
      parseRow(
        row,
        format,
        selectedBankName
      )
    )
    .filter(
      (item) =>
        item.accountNo ||
        item.customerName ||
        item.mobile ||
        item.loanAmount > 0
    );

  const uniqueCases =
    new Map<string, ParsedCase>();

  let duplicateCount = 0;

  for (const item of parsedRows) {
    const key = normalizeText(
      item.accountNo
    );

    if (!key) continue;

    if (uniqueCases.has(key)) {
      duplicateCount += 1;
      continue;
    }

    uniqueCases.set(key, item);
  }

  const cases = Array.from(
    uniqueCases.values()
  );

  const missingAddressCount =
    cases.filter(
      (item) => !item.address
    ).length;

  return {
    format,
    sheetName,
    cases,
    duplicateCount,
    missingAddressCount,
  };
}

export function createCaseDatabaseRow(
  item: ParsedCase,
  options: {
    assignedAgentId?: number | null;
    sourceFileName: string;
    assignmentText?: string;
  }
): CaseDatabaseRow {
  const assignedAgentId =
    options.assignedAgentId ?? null;

  return {
    customer_name:
      item.customerName ||
      "Unknown Customer",

    mobile: item.mobile,

    bank_name: item.bankName,

    branch_name: item.branchName,

    address: item.address,

    account_no: item.accountNo,

    loan_type: item.loanType,

    scheme_code: item.schemeCode,

    account_segment:
      item.accountSegment,

    asset_classification:
      item.assetClassification,

    loan_amount: item.loanAmount,

    pending_amount:
      item.pendingAmount,

    sanction_limit:
      item.sanctionLimit,

    customer_balance:
      item.customerBalance,

    assigned_agent:
      assignedAgentId,

    status: "Pending",

    remarks: [
      `Alpha: ${
        item.alpha || "Not Available"
      }`,

      `Resolved Area: ${
        item.resolvedArea ||
        "Unmatched"
      }`,

      options.assignmentText
        ? `Assignment: ${options.assignmentText}`
        : "Assignment: Unassigned",

      `Source File: ${
        options.sourceFileName
      }`,
    ].join(" | "),
  };
}