# Investment scenario model

`lib/investment-model.ts` is a pure TypeScript calculation shared by the owner interface and typed tools. It validates supplied assumptions with a strict Zod schema, calculates without network access or persistence, and does not infer portfolio facts. Results are scenarios before income, capital-gains, and entity taxes; they are not appraisals or a holding-structure recommendation.

The exported contract is `investmentSchema`, `InvestmentInput`, `InvestmentYear`, `InvestmentResult`, `InvestmentStress`, `evaluateInvestment(input)`, and `applyStress(input, stress)`. Invalid input throws a Zod validation error. Every input is required; numeric strings and unknown properties are rejected. Amounts use one consistent currency throughout, without conversion. Calculations retain full floating-point precision; the interface should round only for display.

## Input conventions

| Fields | Meaning and validation |
| --- | --- |
| `purchasePrice` | Asset purchase price; 0.01 to 1 trillion currency units. |
| `initialCapex`, `monthlyColdRent`, `annualOperatingCosts`, `annualMaintenanceReserve`, `loanAmount` | Nonnegative amounts, at most 1 trillion. Rent excludes service-charge advances; operating costs should include only unrecovered owner costs. Reserve is a separate cash allowance. |
| `acquisitionCostPct`, `vacancyPct`, `interestRatePct`, `refinanceRatePct`, `sellingCostPct`, `discountRatePct` | Percentages from 0 to 100, inclusive. For example, `5` means 5%, not 0.05%. Explicit zero is valid. |
| `rentGrowthPct`, `costGrowthPct` | Annual compound changes from −100% to +100%. The −100% boundary makes the affected amount zero from year two. Cost growth applies to operating costs and reserve. |
| `amortizationYears` | Original loan maturity, integer 1–40 years. |
| `fixedRateYears` | Integer 0–30 years. A zero term uses the refinancing rate from the first month. A reset at or after maturity has no effect. |
| `horizonYears` | Integer 1–30 years. Sale follows operations in the final projection year. |
| `exitCapRatePct` | Forward NOI capitalization rate; 0.01% to 100%. Zero is undefined. |

Loan amount cannot exceed purchase price plus acquisition costs plus initial capex. The model does not assume that a lender would offer the entered leverage. Initial LTV can exceed 100% because the permitted basis includes acquisition costs and capex.

## Cash-flow mechanics

Initial cost is `purchasePrice × (1 + acquisitionCostPct / 100) + initialCapex`. Initial equity is that cost less the loan. All initial capex is paid at acquisition; there is no subsequent construction draw schedule.

For projection year `y`, scheduled rent is `monthlyColdRent × 12 × (1 + rentGrowthPct / 100)^(y − 1)`. Effective rent multiplies this by `1 − vacancyPct / 100`. Operating costs and maintenance reserve independently compound at `costGrowthPct` from year two.

NOI is effective rent less operating costs. Cash available for debt service subtracts reserve from NOI. Cash flow subtracts actual interest and principal from that amount. Coverage after reserve divides cash available for debt service by debt service; it is `null` when debt service is zero. This explicitly differs from a lender covenant that uses NOI before reserve or other adjustments.

Debt is a monthly annuity loan. The monthly rate is the nominal annual percentage divided by 1,200. A positive-rate payment is `balance × monthlyRate / (1 − (1 + monthlyRate)^(−remainingMonths))`; a zero-rate payment is `balance / remainingMonths`. The implementation computes the equivalent first principal installment as `balance × monthlyRate / ((1 + monthlyRate)^remainingMonths − 1)`, using `log1p` and `expm1`, then grows each installment by `1 + monthlyRate`. This avoids losing tiny principal amounts by subtracting nearly equal payment and interest values on a very long, high-rate loan. Monthly interest uses the opening balance. Principal is capped at the outstanding balance, and the final scheduled month clears floating-point residue. The loan never grows from unpaid interest and accrues no interest after repayment.

There is one rate reset, immediately after `fixedRateYears × 12` completed monthly payments. The new annuity uses the then outstanding balance, refinancing rate, and the remaining months of the **original** amortization term. The model does not extend maturity, borrow more, capitalize fees, or model rate changes between reset dates.

## Exit and equity returns

Forward NOI uses the rent and operating costs of year `horizonYears + 1`, after vacancy and before reserve. `exitValue = max(0, forwardNoi / (exitCapRatePct / 100))`. `exitProceeds = exitValue × (1 − sellingCostPct / 100) − closingDebt`.

For nonpositive forward NOI, the cap-rate method is unsuitable for a conventional income valuation. The scenario uses a zero terminal-value floor and adds an explicit assumption; it does not infer land, redevelopment, or an alternative sale price. Exit proceeds can be negative when debt remains.

Equity cash flows comprise the negative initial equity at time zero, followed by each year's operating cash flow at that year's end. Exit proceeds are included in the final year. NPV discounts this vector at the supplied annual discount rate. Annual aggregation does not measure intra-year funding peaks.

Equity multiple divides positive annual equity cash flows by initial equity plus subsequent negative annual equity cash flows. Final-year operations and sale are netted at the same modeled date. This includes later funding needs in invested equity. The multiple is `null` when initial equity is zero.

IRR solves NPV equal to zero for annual rates greater than −100%. In the positive discount-factor variable `x = 1 / (1 + IRR)`, one nonzero cash-flow coefficient sign change establishes exactly one positive polynomial root. The implementation brackets and bisects this root. It returns `null` for zero initial equity, no return, multiple sign changes, or a numerical failure to establish the root. Multiple sign changes do **not** prove that multiple IRRs exist: they mean this conservative solver cannot establish uniqueness. A negative uniquely established IRR is reported. Missing IRR is not displayed as 0%.

Gross yield is first-year scheduled rent divided by purchase price, expressed as a percentage. Initial LTV is loan amount divided by purchase price, also expressed as a percentage. Neither metric is net return on equity.

## Stress contract

`applyStress` returns a new validated input and never mutates the baseline. `vacancyDeltaPct`, `refinanceRateDeltaPct`, and `exitCapRateDeltaPct` are additive percentage-point changes bounded from −100 to +100. `capexOverrunPct` is a nonnegative proportional uplift bounded at 1,000%.

Vacancy is capped into the range 0–100%. Initial capex is multiplied by `1 + capexOverrunPct / 100`; the loan is unchanged, so the owner supplies the additional initial equity. The refinance-rate shock changes only `refinanceRatePct`; it does not change the fixed initial rate. A shock has no financing effect if the reset is beyond the projection or after repayment. The exit-cap shock changes only the terminal capitalization assumption. A resulting rate, capex amount, or cap rate outside the main schema fails validation instead of silently being corrected.

## Verification

Run `node --experimental-strip-types scripts/investment-model-smoke.mjs`. The suite covers analytical zero-interest and unlevered cases, a known one-year IRR, negative IRR, forward-year capitalization, full vacancy and negative exit equity, the exact reset boundary, a zero fixed period, completed repayment, stress timing, additional-equity treatment, conservation across rates and maturities, scale invariance, nonconventional cash flows, cash-flow reconciliation, complete income decline, and strict input rejection.

No claim about property value, rent growth, tax savings, credit availability, or future rates is sourced or asserted by this engine. Those facts and assumptions belong in the evidence workflow that supplies its inputs.
