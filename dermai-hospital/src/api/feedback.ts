import { api } from "./client";
import type { FeedbackPayload } from "@/types";

export async function submitFeedback(payload: FeedbackPayload) {
  const { data } = await api.post("/feedback/", payload);
  return data;
}
