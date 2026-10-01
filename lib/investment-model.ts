import { z } from "zod";

const money = z.number().finite().min(0).max(1_000_000_000_000);
const nonnegativeRate = z.number().finite().min(0).max(100);
const growthRate = z.number().finite().min(-100).max(100);

/** Nominal currency amounts; all percentages are percentage points, not fractions. */
export const investmentSchema = z.object({
  purchasePrice: money.min(0.01),
  acquisitionCostPct: nonnegativeRate,
  initialCapex: money,
  monthlyColdRent: money,
  vacancyPct: nonnegativeRate,
  annualOperatingCosts: money,
  annualMaintenanceReserve: money,
  rentGrowthPct: growthRate,
  costGrowthPct: growthRate,
  loanAmount: money,
  interestRatePct: nonnegativeRate,
  amortizationYears: z.number().int().min(1).max(40),
  fixedRateYears: z.number().int().min(0).max(30),
  refinanceRatePct: nonnegativeRate,
  horizonYears: z.number().int().min(1).max(30),
  exitCapRatePct: z.number().finite().min(0.01).max(100),
  sellingCostPct: nonnegativeRate,
  discountRatePct: nonnegativeRate
}).strict().superRefine((input, context) => {
  const totalCost = input.purchasePrice * (1 + input.acquisitionCostPct / 100) + input.initialCapex;
  if (input.loanAmount > totalCost) {
    context.addIssue({
      code: "custom",
      path: ["loanAmount"],
      message: "Loan amount cannot exceed purchase price, acquisition costs, and initial capex combined."
    });
  }
});

export type InvestmentInput = z.infer<typeof investmentSchema>;

export type InvestmentYear = {
  year: number;
  scheduledRent: number;
  effectiveRent: number;
  operatingCosts: number;
  maintenanceReserve: number;
  /** Effective rent less operating costs, before reserve and financing. */
  noi: number;
  cashAvailableForDebtService: number;
  interest: number;
  principal: number;
  debtService: number;
  cashFlow: number;
  closingDebt: number;
  coverageAfterReserve: number | null;
};

export type InvestmentResult = {
  totalCost: number;
  initialEquity: number;
  years: InvestmentYear[];
  grossYieldPct: number;
  initialLtvPct: number;
  exitValue: number;
  exitProceeds: number;
  equityMultiple: number | null;
  irrPct: number | null;
  npv: number;
  assumptions: string[];
};

const stressSchema = z.object({
  vacancyDeltaPct: z.number().finite().min(-100).max(100),
  refinanceRateDeltaPct: z.number().finite().min(-100).max(100),
  capexOverrunPct: z.number().finite().min(0).max(1_000),
  exitCapRateDeltaPct: z.number().finite().min(-100).max(100)
}).strict();

export type InvestmentStress = z.infer<typeof stressSchema>;

/** Stress changes the refinancing assumption; it never changes the fixed initial rate. */
export function applyStress(input: InvestmentInput, stress: InvestmentStress): InvestmentInput {
  const baseline = investmentSchema.parse(input);
  const shock = stressSchema.parse(stress);
  return investmentSchema.parse({
    ...baseline,
    vacancyPct: Math.min(100, Math.max(0, baseline.vacancyPct + shock.vacancyDeltaPct)),
    refinanceRatePct: baseline.refinanceRatePct + shock.refinanceRateDeltaPct,
    initialCapex: baseline.initialCapex * (1 + shock.capexOverrunPct / 100),
    exitCapRatePct: baseline.exitCapRatePct + shock.exitCapRateDeltaPct
  });
}

function firstMonthlyPrincipal(balance: number, monthlyRate: number, months: number): number {
  if (balance === 0) return 0;
  if (monthlyRate === 0) return balance / months;
  // Equivalent to annuity payment minus first-month interest. This form avoids
  // cancellation both at tiny rates and when a long loan is nearly interest-only.
  return balance * (monthlyRate / Math.expm1(months * Math.log1p(monthlyRate)));
}

/**
 * A single coefficient sign change establishes one positive discount-factor root.
 * Nonconventional flows are deliberately left unreported, rather than selecting a
 * convenient Newton root. Every annual cash flow occurs at the end of its year.
 */
function uniqueAnnualIrr(cashFlows: number[]): number | null {
  if (cashFlows[0] >= 0) return null;
  const nonzero = cashFlows.filter((value) => value !== 0);
  let signChanges = 0;
  for (let index = 1; index < nonzero.length; index += 1) {
    if (Math.sign(nonzero[index]) !== Math.sign(nonzero[index - 1])) signChanges += 1;
  }
  if (signChanges !== 1) return null;

  const scale = Math.max(...cashFlows.map(Math.abs));
  const normalized = cashFlows.map((value) => value / scale);
  // NPV in x = 1 / (1 + annual IRR), evaluated by Horner's method.
  const polynomial = (x: number): number => {
    let value = normalized[normalized.length - 1];
    for (let index = normalized.length - 2; index >= 0; index -= 1) {
      value = value * x + normalized[index];
    }
    return value;
  };

  let low = 0;
  let high = 1;
  let highValue = polynomial(high);
  for (let attempt = 0; highValue < 0 && attempt < 1_024; attempt += 1) {
    high *= 2;
    if (!Number.isFinite(high)) return null;
    highValue = polynomial(high);
  }
  if (Number.isNaN(highValue) || highValue < 0) return null;
  if (highValue === 0) return (1 / high - 1) * 100;

  for (let iteration = 0; iteration < 512; iteration += 1) {
    const middle = low + (high - low) / 2;
    const value = polynomial(middle);
    if (Number.isNaN(value)) return null;
    if (value === 0 || high - low <= middle * 1e-13) {
      const irr = (1 / middle - 1) * 100;
      return Number.isFinite(irr) ? irr : null;
    }
    if (value > 0) high = middle;
    else low = middle;
  }
  return null;
}

/** Pure, deterministic scenario calculation. Does not fetch, persist, or infer facts. */
export function evaluateInvestment(rawInput: InvestmentInput): InvestmentResult {
  const input = investmentSchema.parse(rawInput);
  const totalCost = input.purchasePrice * (1 + input.acquisitionCostPct / 100) + input.initialCapex;
  const initialEquity = totalCost - input.loanAmount;
  const loanMonths = input.amortizationYears * 12;
  const resetMonth = input.fixedRateYears * 12;
  let balance = input.loanAmount;
  let monthlyRate = (resetMonth === 0 ? input.refinanceRatePct : input.interestRatePct) / 1_200;
  let scheduledPrincipal = firstMonthlyPrincipal(balance, monthlyRate, loanMonths);
  const years: InvestmentYear[] = [];

  for (let year = 1; year <= input.horizonYears; year += 1) {
    const scheduledRent = input.monthlyColdRent * 12 * (1 + input.rentGrowthPct / 100) ** (year - 1);
    const effectiveRent = scheduledRent * (1 - input.vacancyPct / 100);
    const costFactor = (1 + input.costGrowthPct / 100) ** (year - 1);
    const operatingCosts = input.annualOperatingCosts * costFactor;
    const maintenanceReserve = input.annualMaintenanceReserve * costFactor;
    const noi = effectiveRent - operatingCosts;
    const cashAvailableForDebtService = noi - maintenanceReserve;
    let interest = 0;
    let principal = 0;

    for (let monthInYear = 0; monthInYear < 12; monthInYear += 1) {
      const month = (year - 1) * 12 + monthInYear;
      if (balance === 0 || month >= loanMonths) continue;
      if (month === resetMonth && resetMonth > 0) {
        monthlyRate = input.refinanceRatePct / 1_200;
        scheduledPrincipal = firstMonthlyPrincipal(balance, monthlyRate, loanMonths - month);
      }
      const monthlyInterest = balance * monthlyRate;
      // The final scheduled month clears floating-point residue. Principal is
      // capped at the remaining balance; no interest accrues after repayment.
      const monthlyPrincipal = month === loanMonths - 1
        ? balance
        : Math.min(balance, Math.max(0, scheduledPrincipal));
      balance -= monthlyPrincipal;
      interest += monthlyInterest;
      principal += monthlyPrincipal;
      // Each annuity principal installment grows by (1 + monthlyRate).
      scheduledPrincipal *= 1 + monthlyRate;
    }

    const debtService = interest + principal;
    years.push({
      year,
      scheduledRent,
      effectiveRent,
      operatingCosts,
      maintenanceReserve,
      noi,
      cashAvailableForDebtService,
      interest,
      principal,
      debtService,
      cashFlow: cashAvailableForDebtService - debtService,
      closingDebt: balance,
      coverageAfterReserve: debtService === 0 ? null : cashAvailableForDebtService / debtService
    });
  }

  const forwardRent = input.monthlyColdRent * 12 * (1 + input.rentGrowthPct / 100) ** input.horizonYears;
  const forwardCosts = input.annualOperatingCosts * (1 + input.costGrowthPct / 100) ** input.horizonYears;
  const forwardNoi = forwardRent * (1 - input.vacancyPct / 100) - forwardCosts;
  const exitValue = Math.max(0, forwardNoi / (input.exitCapRatePct / 100));
  const exitProceeds = exitValue * (1 - input.sellingCostPct / 100) - balance;
  const annualEquityCashFlows = years.map((year, index) =>
    year.cashFlow + (index === years.length - 1 ? exitProceeds : 0)
  );
  const cashFlows = [-initialEquity, ...annualEquityCashFlows];
  const distributions = annualEquityCashFlows.reduce((sum, amount) => sum + Math.max(0, amount), 0);
  const laterContributions = annualEquityCashFlows.reduce((sum, amount) => sum + Math.max(0, -amount), 0);
  const npv = cashFlows.reduce((sum, amount, year) =>
    sum + amount / (1 + input.discountRatePct / 100) ** year, 0
  );

  const assumptions = [
    "Scenario inputs are supplied assumptions, not verified property facts or a valuation.",
    "All results are nominal and before income tax, capital-gains tax, entity tax, depreciation effects, and inflation adjustment.",
    "Acquisition costs apply to the purchase price; initial capex is paid at acquisition. Loan proceeds fund the total acquisition basis.",
    "Cold rent excludes tenant service-charge advances. Operating costs must include all unrecovered recurring owner costs; the maintenance reserve is a separate cash allowance, excluded from NOI.",
    "Rent, vacancy, operating costs, and reserve assumptions apply uniformly within each year. Rent growth and cost growth compound from year two.",
    "Debt uses monthly annuity payments and nominal annual interest divided by 12, without lender fees, prepayment charges, or additional borrowing.",
    `The interest rate resets once after ${input.fixedRateYears} full years to the refinancing assumption, over the original remaining amortization term; a zero fixed term uses that rate immediately.`,
    "Exit value is max(0, forward-year NOI / exit cap rate). Sale costs and closing debt reduce exit proceeds; sale occurs at the projection year end.",
    "NPV and IRR use initial equity at acquisition and annual equity cash flows at each year end, including sale in the final year. Within-year cash-flow timing is aggregated.",
    "Equity multiple is positive annual equity cash flows divided by initial equity plus subsequent negative annual equity cash flows; final-year operations and sale are netted. It is undefined when initial equity is zero.",
    "IRR is reported only with positive initial equity and one cash-flow sign change, which establishes a unique admissible root. Other cases return null rather than selecting a potentially misleading root.",
    "Gross yield is first-year scheduled rent / purchase price. Initial LTV is loan amount / purchase price. Coverage after reserve is cash available after operating costs and reserve / debt service."
  ];
  if (forwardNoi <= 0) {
    assumptions.push("Forward NOI is nonpositive: terminal value is floored at zero. This model does not estimate land, redevelopment, or an alternative disposal value.");
  }
  if (input.fixedRateYears >= input.amortizationYears) {
    assumptions.push("The loan is repaid before or at the rate-reset date; the refinancing rate has no effect.");
  } else if (input.fixedRateYears >= input.horizonYears) {
    assumptions.push("The rate-reset date is outside the operating projection; refinancing-rate changes do not affect projected debt service.");
  }

  return {
    totalCost,
    initialEquity,
    years,
    grossYieldPct: input.monthlyColdRent * 12 / input.purchasePrice * 100,
    initialLtvPct: input.loanAmount / input.purchasePrice * 100,
    exitValue,
    exitProceeds,
    equityMultiple: initialEquity === 0 ? null : distributions / (initialEquity + laterContributions),
    irrPct: uniqueAnnualIrr(cashFlows),
    npv,
    assumptions
  };
}
