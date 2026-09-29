export const weeklyMetricIds = [
  "owner-review-time",
  "self-service-coverage",
  "vacancy-readiness",
  "urgent-acknowledgement",
  "unauthorized-actions"
] as const;

export type WeeklyMetricId = typeof weeklyMetricIds[number];
export type WeeklyMetricStatus = "met" | "not-met" | "unmeasured";
export type WeeklyMetricSource = "server-derived" | "owner-entered" | "system-policy";

export type WeeklyMetricObservation = {
  id: string;
  metricId: WeeklyMetricId;
  label: string;
  value: number | null;
  unit: "minutes" | "percent" | "days" | "count";
  target: string;
  status: WeeklyMetricStatus;
  source: WeeklyMetricSource;
  evidenceRef: string;
  observedAt: string;
};

export type WeeklyOwnerReviewStatus = "in-progress" | "completed";

export type WeeklyOwnerReview = {
  id: string;
  weekOf: string;
  status: WeeklyOwnerReviewStatus;
  startedAt: string;
  completedAt: string | null;
  durationMinutes: number | null;
  repeatedQuestionsTotal: number | null;
  repeatedQuestionsCovered: number | null;
  knownVacancyDate: string | null;
  listingReadyDate: string | null;
  keepNote: string;
  changeNote: string;
  stopNote: string;
  observations: WeeklyMetricObservation[];
  createdAt: string;
  updatedAt: string;
};

export type WeeklyReviewCompletionInput = {
  repeatedQuestionsTotal: number;
  repeatedQuestionsCovered: number;
  knownVacancyDate: string | null;
  listingReadyDate: string | null;
  keepNote: string;
  changeNote: string;
  stopNote: string;
};

function isDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function currentWeekOf(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function validateWeeklyReviewCompletion(input: WeeklyReviewCompletionInput) {
  if (!Number.isInteger(input.repeatedQuestionsTotal) || input.repeatedQuestionsTotal < 0 || input.repeatedQuestionsTotal > 10_000) {
    return "Repeated question total must be an integer from 0 to 10000.";
  }
  if (!Number.isInteger(input.repeatedQuestionsCovered) || input.repeatedQuestionsCovered < 0 || input.repeatedQuestionsCovered > input.repeatedQuestionsTotal) {
    return "Covered questions must be an integer between 0 and the repeated question total.";
  }
  if (Boolean(input.knownVacancyDate) !== Boolean(input.listingReadyDate)) {
    return "Vacancy and listing-ready dates must either both be supplied or both be empty.";
  }
  if (input.knownVacancyDate && !isDateOnly(input.knownVacancyDate)) return "Known vacancy date is invalid.";
  if (input.listingReadyDate && !isDateOnly(input.listingReadyDate)) return "Listing-ready date is invalid.";
  if (!input.keepNote || !input.changeNote || !input.stopNote) {
    return "Keep, change, and stop decisions are required.";
  }
  return null;
}

function metricStatus(value: number | null, passes: (value: number) => boolean): WeeklyMetricStatus {
  if (value === null) return "unmeasured";
  return passes(value) ? "met" : "not-met";
}

export function buildWeeklyMetricObservations(input: {
  review: WeeklyOwnerReview;
  urgentAcknowledgementMinutes: number | null;
  observedAt: string;
  createId: () => string;
}) {
  const { review, observedAt, createId } = input;
  const durationMinutes = review.completedAt
    ? Math.max(1, Math.ceil((new Date(review.completedAt).valueOf() - new Date(review.startedAt).valueOf()) / 60_000))
    : null;
  const coverage = review.repeatedQuestionsTotal && review.repeatedQuestionsTotal > 0 && review.repeatedQuestionsCovered !== null
    ? Math.round((review.repeatedQuestionsCovered / review.repeatedQuestionsTotal) * 1000) / 10
    : null;
  const vacancyLeadDays = review.knownVacancyDate && review.listingReadyDate
    ? Math.round((new Date(`${review.knownVacancyDate}T00:00:00.000Z`).valueOf() - new Date(`${review.listingReadyDate}T00:00:00.000Z`).valueOf()) / 86_400_000)
    : null;

  const observations: WeeklyMetricObservation[] = [
    {
      id: createId(),
      metricId: "owner-review-time",
      label: "Owner review time",
      value: durationMinutes,
      unit: "minutes",
      target: "30 minutes or less",
      status: metricStatus(durationMinutes, (value) => value <= 30),
      source: "server-derived",
      evidenceRef: `weekly-review:${review.id}:timestamps`,
      observedAt
    },
    {
      id: createId(),
      metricId: "self-service-coverage",
      label: "Repeated questions covered",
      value: coverage,
      unit: "percent",
      target: "70 percent or more",
      status: metricStatus(coverage, (value) => value >= 70),
      source: "owner-entered",
      evidenceRef: `weekly-review:${review.id}:question-counts`,
      observedAt
    },
    {
      id: createId(),
      metricId: "vacancy-readiness",
      label: "Listing ready before vacancy",
      value: vacancyLeadDays,
      unit: "days",
      target: "30 days or more",
      status: metricStatus(vacancyLeadDays, (value) => value >= 30),
      source: "owner-entered",
      evidenceRef: `weekly-review:${review.id}:vacancy-dates`,
      observedAt
    },
    {
      id: createId(),
      metricId: "urgent-acknowledgement",
      label: "Urgent owner acknowledgement",
      value: input.urgentAcknowledgementMinutes,
      unit: "minutes",
      target: "under 5 minutes",
      status: metricStatus(input.urgentAcknowledgementMinutes, (value) => value < 5),
      source: "server-derived",
      evidenceRef: `weekly-review:${review.id}:notification-window`,
      observedAt
    },
    {
      id: createId(),
      metricId: "unauthorized-actions",
      label: "Unauthorized external actions",
      value: 0,
      unit: "count",
      target: "zero",
      status: "met",
      source: "system-policy",
      evidenceRef: `weekly-review:${review.id}:blocked-v1-actions`,
      observedAt
    }
  ];

  return { durationMinutes, observations };
}
