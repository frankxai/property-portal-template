import assert from "node:assert/strict";
import { applyStress, evaluateInvestment, investmentSchema } from "../lib/investment-model.ts";

const base = Object.freeze({
  purchasePrice: 100_000,
  acquisitionCostPct: 0,
  initialCapex: 0,
  monthlyColdRent: 1_000,
  vacancyPct: 0,
  annualOperatingCosts: 0,
  annualMaintenanceReserve: 0,
  rentGrowthPct: 0,
  costGrowthPct: 0,
  loanAmount: 0,
  interestRatePct: 0,
  amortizationYears: 10,
  fixedRateYears: 10,
  refinanceRatePct: 0,
  horizonYears: 10,
  exitCapRatePct: 10,
  sellingCostPct: 0,
  discountRatePct: 0
});

const approximately = (actual, expected, label = "value", relativeTolerance = 1e-9) => {
  assert.ok(Number.isFinite(actual), `${label} must be finite: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= relativeTolerance * Math.max(1, Math.abs(expected)),
    `${label}: expected ${expected}, received ${actual}`);
};
let passed = 0;
const check = (name, run) => {
  try {
    run();
    passed += 1;
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
};

check("zero interest gives equal principal and no residual debt", () => {
  const result = evaluateInvestment({ ...base, purchasePrice: 120_000, loanAmount: 120_000, monthlyColdRent: 1_500 });
  result.years.forEach((year, index) => {
    approximately(year.principal, 12_000, "annual principal");
    assert.equal(year.interest, 0);
    approximately(year.closingDebt, 120_000 - 12_000 * (index + 1), "closing debt");
    approximately(year.cashFlow, 6_000, "cash flow");
  });
  assert.equal(result.initialEquity, 0);
  assert.equal(result.equityMultiple, null);
  assert.equal(result.irrPct, null);
  approximately(result.exitValue, 180_000, "exit value");
  approximately(result.npv, 240_000, "undiscounted equity flows");
});

check("unlevered cash flow separates NOI and reserve", () => {
  const result = evaluateInvestment({
    ...base, vacancyPct: 10, annualOperatingCosts: 2_000,
    annualMaintenanceReserve: 1_000, horizonYears: 3, exitCapRatePct: 5
  });
  const year = result.years[0];
  assert.equal(year.scheduledRent, 12_000);
  assert.equal(year.effectiveRent, 10_800);
  assert.equal(year.noi, 8_800);
  assert.equal(year.cashAvailableForDebtService, 7_800);
  assert.equal(year.cashFlow, 7_800);
  assert.equal(year.coverageAfterReserve, null);
  assert.equal(year.interest, 0);
  assert.equal(year.principal, 0);
  assert.equal(year.closingDebt, 0);
  approximately(result.exitValue, 176_000);
  approximately(result.equityMultiple, 1.994);
  approximately(result.npv, 99_400);
});

check("one-year return has an analytical IRR and zero NPV at its own discount rate", () => {
  const result = evaluateInvestment({ ...base, monthlyColdRent: 10_000 / 12, horizonYears: 1, discountRatePct: 10 });
  approximately(result.grossYieldPct, 10);
  approximately(result.irrPct, 10, "IRR");
  approximately(result.npv, 0, "NPV", 1e-7);
  approximately(result.equityMultiple, 1.1);
});

check("negative but admissible IRR is not suppressed", () => {
  const result = evaluateInvestment({ ...base, monthlyColdRent: 1_000 / 12, horizonYears: 1 });
  // 1,000 operating cash flow plus a 10,000 disposal against 100,000 equity.
  approximately(result.irrPct, -89, "negative IRR");
});

check("exit capitalizes next-year NOI and deducts selling costs once", () => {
  const result = evaluateInvestment({
    ...base, horizonYears: 2, rentGrowthPct: 10, costGrowthPct: 20,
    annualOperatingCosts: 1_000, annualMaintenanceReserve: 2_000,
    exitCapRatePct: 5, sellingCostPct: 3
  });
  const nextYearNoi = 12_000 * 1.1 ** 2 - 1_000 * 1.2 ** 2;
  approximately(result.exitValue, nextYearNoi / 0.05);
  approximately(result.exitProceeds, nextYearNoi / 0.05 * 0.97);
  assert.notEqual(result.exitValue, result.years[1].noi / 0.05);
});

check("full vacancy preserves owner costs and negative exit equity", () => {
  const result = evaluateInvestment({
    ...base, vacancyPct: 100, annualOperatingCosts: 1_000,
    annualMaintenanceReserve: 500, loanAmount: 60_000, horizonYears: 1
  });
  assert.equal(result.years[0].effectiveRent, 0);
  assert.equal(result.years[0].noi, -1_000);
  assert.equal(result.years[0].cashAvailableForDebtService, -1_500);
  assert.equal(result.exitValue, 0);
  approximately(result.exitProceeds, -54_000);
  assert.equal(result.irrPct, null);
  assert.equal(result.equityMultiple, 0);
  assert.ok(result.assumptions.some((item) => item.includes("Forward NOI is nonpositive")));
});

check("rate resets at the exact term boundary without extending maturity", () => {
  const result = evaluateInvestment({
    ...base, purchasePrice: 150_000, loanAmount: 120_000,
    fixedRateYears: 1, refinanceRatePct: 12
  });
  assert.equal(result.years[0].interest, 0);
  approximately(result.years[0].closingDebt, 108_000);
  const rate = 0.01;
  const expectedPayment = 108_000 * rate / (1 - (1 + rate) ** -108);
  const expectedClosing = 108_000 * (1 + rate) ** 12
    - expectedPayment * ((1 + rate) ** 12 - 1) / rate;
  approximately(result.years[1].closingDebt, expectedClosing, "post-reset debt");
  approximately(result.years[1].debtService, expectedPayment * 12, "reset annuity");
  approximately(result.years[1].interest, expectedPayment * 12 - (108_000 - expectedClosing));
  assert.equal(result.years.at(-1).closingDebt, 0);
});

check("zero fixed term uses refinancing assumption immediately", () => {
  const input = { ...base, loanAmount: 60_000, fixedRateYears: 0, refinanceRatePct: 6, horizonYears: 2 };
  const result = evaluateInvestment(input);
  const changedUnusedInitialRate = evaluateInvestment({ ...input, interestRatePct: 40 });
  assert.deepEqual(result.years, changedUnusedInitialRate.years);
  assert.ok(result.years[0].interest > 0);
});

check("no financing cost appears after the original maturity", () => {
  const input = { ...base, loanAmount: 60_000, interestRatePct: 5, amortizationYears: 1, fixedRateYears: 1, horizonYears: 3 };
  const result = evaluateInvestment(input);
  assert.deepEqual(result.years, evaluateInvestment({ ...input, refinanceRatePct: 100 }).years);
  for (const year of result.years.slice(1)) {
    assert.equal(year.closingDebt, 0);
    assert.equal(year.interest, 0);
    assert.equal(year.principal, 0);
    assert.equal(year.debtService, 0);
    assert.equal(year.coverageAfterReserve, null);
  }
});

check("interest stress applies only at refinancing", () => {
  const input = Object.freeze({ ...base, loanAmount: 60_000, interestRatePct: 3, refinanceRatePct: 4, fixedRateYears: 2, horizonYears: 4 });
  const shockedInput = applyStress(input, { vacancyDeltaPct: 0, refinanceRateDeltaPct: 3, capexOverrunPct: 0, exitCapRateDeltaPct: 0 });
  assert.equal(shockedInput.interestRatePct, 3);
  assert.equal(shockedInput.refinanceRatePct, 7);
  const baseline = evaluateInvestment(input);
  const shocked = evaluateInvestment(shockedInput);
  assert.deepEqual(shocked.years.slice(0, 2), baseline.years.slice(0, 2));
  assert.ok(shocked.years[2].debtService > baseline.years[2].debtService);
  const outside = { ...input, fixedRateYears: 5 };
  assert.deepEqual(
    evaluateInvestment(outside).years,
    evaluateInvestment(applyStress(outside, { vacancyDeltaPct: 0, refinanceRateDeltaPct: 3, capexOverrunPct: 0, exitCapRateDeltaPct: 0 })).years
  );
});

check("stress caps vacancy, finances capex overruns with equity, and rejects invalid rates", () => {
  const input = Object.freeze({ ...base, vacancyPct: 98, initialCapex: 20_000, loanAmount: 60_000 });
  const shocked = applyStress(input, { vacancyDeltaPct: 8, refinanceRateDeltaPct: 1, capexOverrunPct: 25, exitCapRateDeltaPct: 0.5 });
  assert.equal(shocked.vacancyPct, 100);
  assert.equal(shocked.initialCapex, 25_000);
  assert.equal(shocked.loanAmount, 60_000);
  assert.equal(shocked.exitCapRatePct, 10.5);
  assert.equal(evaluateInvestment(shocked).initialEquity - evaluateInvestment(input).initialEquity, 5_000);
  assert.equal(input.vacancyPct, 98);
  assert.throws(() => applyStress(input, { vacancyDeltaPct: 0, refinanceRateDeltaPct: -1, capexOverrunPct: 0, exitCapRateDeltaPct: 0 }));
  assert.throws(() => applyStress(input, { vacancyDeltaPct: 0, refinanceRateDeltaPct: 0, capexOverrunPct: 0, exitCapRateDeltaPct: -10 }));
});

check("balance and cash-flow conservation hold across rates, terms, and shocks", () => {
  for (const rate of [0, 0.0000001, 3.5, 25, 100]) {
    for (const term of [1, 10, 40]) {
      const input = {
        ...base, purchasePrice: 300_000, acquisitionCostPct: 10, initialCapex: 20_000,
        loanAmount: 240_000, monthlyColdRent: 1_800, vacancyPct: 7,
        annualOperatingCosts: 1_800, annualMaintenanceReserve: 2_400,
        interestRatePct: rate, refinanceRatePct: Math.min(100, rate + 3),
        amortizationYears: term, fixedRateYears: 2, horizonYears: 30,
        rentGrowthPct: 2, costGrowthPct: 3
      };
      const result = evaluateInvestment(input);
      let previousDebt = input.loanAmount;
      let totalPrincipal = 0;
      for (const year of result.years) {
        assert.ok(year.principal >= 0 && year.interest >= 0 && year.closingDebt >= 0, "no negative amortization");
        assert.ok(year.closingDebt <= previousDebt, "debt cannot grow");
        approximately(previousDebt - year.principal, year.closingDebt, "annual debt identity", 1e-7);
        approximately(year.interest + year.principal, year.debtService, "debt service identity");
        approximately(year.cashFlow + year.debtService, year.cashAvailableForDebtService, "operating cash conservation");
        approximately(year.noi - year.maintenanceReserve, year.cashAvailableForDebtService, "reserve identity");
        previousDebt = year.closingDebt;
        totalPrincipal += year.principal;
      }
      approximately(totalPrincipal + previousDebt, input.loanAmount, "loan conservation");
      if (term <= 30) assert.equal(previousDebt, 0);
    }
  }
});

check("monetary scaling preserves ratios and scales present value", () => {
  const input = {
    ...base, purchasePrice: 300_000, acquisitionCostPct: 10, initialCapex: 20_000,
    monthlyColdRent: 1_800, vacancyPct: 5, annualOperatingCosts: 1_800,
    annualMaintenanceReserve: 2_400, loanAmount: 240_000, interestRatePct: 3.8,
    amortizationYears: 25, fixedRateYears: 5, refinanceRatePct: 5,
    rentGrowthPct: 2, costGrowthPct: 2, exitCapRatePct: 5,
    sellingCostPct: 3, discountRatePct: 6
  };
  const scale = 17.5;
  const scaled = { ...input };
  for (const field of ["purchasePrice", "initialCapex", "monthlyColdRent", "annualOperatingCosts", "annualMaintenanceReserve", "loanAmount"]) {
    scaled[field] *= scale;
  }
  const baseline = evaluateInvestment(input);
  const result = evaluateInvestment(scaled);
  for (const metric of ["grossYieldPct", "initialLtvPct", "equityMultiple", "irrPct"]) {
    if (baseline[metric] === null) assert.equal(result[metric], null);
    else approximately(result[metric], baseline[metric], metric);
  }
  for (const metric of ["totalCost", "initialEquity", "exitValue", "exitProceeds", "npv"]) {
    approximately(result[metric], baseline[metric] * scale, metric);
  }
  result.years.forEach((year, index) => {
    for (const metric of ["cashFlow", "interest", "principal", "closingDebt", "noi"]) {
      approximately(year[metric], baseline.years[index][metric] * scale, metric);
    }
  });
});

check("high-rate long amortization retains tiny initial principal", () => {
  const result = evaluateInvestment({
    ...base, loanAmount: 100_000, interestRatePct: 100,
    amortizationYears: 40, fixedRateYears: 30, horizonYears: 30
  });
  const rate = 1 / 12;
  const expectedTotalPrincipal = 100_000 * Math.expm1(360 * Math.log1p(rate))
    / Math.expm1(480 * Math.log1p(rate));
  assert.ok(result.years[0].principal > 0, "small principal must survive payment-minus-interest cancellation");
  approximately(result.years.at(-1).closingDebt, 100_000 - expectedTotalPrincipal, "long high-rate balance");
});

check("nonconventional flows do not return a selected IRR and later contributions count", () => {
  const result = evaluateInvestment({ ...base, annualMaintenanceReserve: 4_000, costGrowthPct: 100, horizonYears: 4, exitCapRatePct: 5 });
  assert.equal(result.years[2].cashFlow, -4_000);
  assert.equal(result.irrPct, null);
  // Annual equity flows are 8k, 4k, -4k, and 220k including disposal.
  approximately(result.equityMultiple, 232_000 / 104_000);
});

check("reported multi-year IRR reconciles the cash-flow vector", () => {
  const result = evaluateInvestment({ ...base, horizonYears: 10, rentGrowthPct: 3, sellingCostPct: 2, annualOperatingCosts: 1_000, costGrowthPct: 2 });
  assert.notEqual(result.irrPct, null);
  const discounted = result.years.reduce((sum, year, index) => {
    const finalSale = index === result.years.length - 1 ? result.exitProceeds : 0;
    return sum + (year.cashFlow + finalSale) / (1 + result.irrPct / 100) ** year.year;
  }, -result.initialEquity);
  approximately(discounted, 0, "IRR cash-flow reconciliation", 1e-6);
});

check("zero growth base and complete income decline remain finite", () => {
  const result = evaluateInvestment({ ...base, rentGrowthPct: -100, costGrowthPct: -100, annualOperatingCosts: 500, horizonYears: 3 });
  assert.equal(result.years[0].scheduledRent, 12_000);
  assert.equal(result.years[1].scheduledRent, 0);
  assert.equal(result.years[1].operatingCosts, 0);
  assert.equal(result.exitValue, 0);
  approximately(result.irrPct, -88.5, "IRR with trailing zero flows");
});

check("strict schema rejects missing, unknown, nonfinite, and infeasible inputs", () => {
  const invalidChanges = [
    { purchasePrice: 0 }, { purchasePrice: -1 }, { exitCapRatePct: 0 },
    { loanAmount: 100_001 }, { amortizationYears: 0 }, { amortizationYears: 41 },
    { fixedRateYears: -1 }, { fixedRateYears: 31 }, { horizonYears: 1.5 },
    { horizonYears: 31 }, { vacancyPct: 101 }, { annualOperatingCosts: -1 },
    { interestRatePct: -1 }, { monthlyColdRent: Number.NaN },
    { refinanceRatePct: Number.POSITIVE_INFINITY }, { rentGrowthPct: -101 },
    { accidentalExtra: true }, { initialCapex: undefined }
  ];
  for (const change of invalidChanges) {
    assert.equal(investmentSchema.safeParse({ ...base, ...change }).success, false, JSON.stringify(change));
    assert.throws(() => evaluateInvestment({ ...base, ...change }));
  }
  assert.equal(investmentSchema.safeParse({ ...base, fixedRateYears: 0, monthlyColdRent: 0, exitCapRatePct: 0.01 }).success, true);
  assert.equal(investmentSchema.safeParse({ ...base, acquisitionCostPct: 10, initialCapex: 20_000, loanAmount: 130_000 }).success, true);
});

console.log(`Investment model smoke: ${passed} analytical, conservation, stress, and validation checks passed.`);
