import { useMutation } from "@tanstack/react-query";
import { submitFeedback } from "@/api/feedback";
import type { FeedbackPayload } from "@/types";
import { toast } from "sonner";

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
    onSuccess: () => {
      toast.success("Thank you! Feedback saved for tonight's retraining.");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ?? "Failed to submit feedback.";
      toast.error(msg);
    },
  });
}
