import { NextResponse } from "next/server";
import { requireOwnerApiAccess } from "@/lib/auth";
import { completeWeeklyOwnerReview } from "@/lib/runtime-store";
import { sanitizeText } from "@/lib/sanitize";
import { validateWeeklyReviewCompletion, type WeeklyReviewCompletionInput } from "@/lib/weekly-review";

function integerValue(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : Number.NaN;
}

function optionalDate(value: unknown) {
  const date = sanitizeText(value, 10);
  return date || null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await requireOwnerApiAccess(request, "operations:write");
  if (denied) return denied;

  const { id: rawId } = await context.params;
  const id = sanitizeText(rawId, 100);
  if (!/^weekly-[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid weekly review id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const input: WeeklyReviewCompletionInput = {
    repeatedQuestionsTotal: integerValue(body.repeatedQuestionsTotal),
    repeatedQuestionsCovered: integerValue(body.repeatedQuestionsCovered),
    knownVacancyDate: optionalDate(body.knownVacancyDate),
    listingReadyDate: optionalDate(body.listingReadyDate),
    keepNote: sanitizeText(body.keepNote, 1200),
    changeNote: sanitizeText(body.changeNote, 1200),
    stopNote: sanitizeText(body.stopNote, 1200)
  };
  const validationError = validateWeeklyReviewCompletion(input);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const result = await completeWeeklyOwnerReview(id, input);
    if (!result.review) {
      return NextResponse.json({ error: "Weekly owner review not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...result,
      contentApplied: false,
      externalActionsPerformed: [],
      metricBoundary: "Unauthorized-action evidence covers this product's governed action surface only."
    });
  } catch {
    return NextResponse.json(
      { error: "Weekly owner review completion failed", contentApplied: false, externalActionsPerformed: [] },
      { status: 503 }
    );
  }
}
