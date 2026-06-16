import { useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import { RippleButton } from "@/components/common/RippleButton";
import { DISEASE_CLASSES } from "@/lib/constants";

interface Props {
  imageId: string;
  onSuccess?: () => void;
  initialFeedbackSubmitted?: boolean;
}

export function FeedbackWidget({ imageId, onSuccess, initialFeedbackSubmitted = false }: Props) {
  const { mutateAsync: submitFeedback, isPending } = useSubmitFeedback();
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const [submitted, setSubmitted] = useState(initialFeedbackSubmitted);
  const [correctLabel, setCorrectLabel] = useState("");
  const [notes, setNotes] = useState("");

  async function handleVote(vote: "up" | "down") {
    if (vote === "up") {
      try {
        await submitFeedback({ image_id: imageId, vote: "up" });
        setSubmitted(true);
        setVoted("up");
        onSuccess?.();
      } catch {
        // Handled in hook toast
      }
    } else {
      setVoted("down");
    }
  }

  async function handleSubmitDownVote(e: React.FormEvent) {
    e.preventDefault();
    if (!correctLabel) return;
    try {
      await submitFeedback({
        image_id: imageId,
        vote: "down",
        correct_label: correctLabel,
        notes: notes || undefined,
      });
      setSubmitted(true);
      onSuccess?.();
    } catch {
      // Handled in hook toast
    }
  }

  if (submitted) {
    return (
      <div className="clinical-card p-5 border-success/30 bg-success/5 text-center">
        <p className="text-success text-sm font-medium">
          Feedback submitted successfully. Thank you for training tomorrow's model.
        </p>
      </div>
    );
  }

  if (voted === "down") {
    return (
      <div className="clinical-card p-5 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Provide Correct Label</h4>
          <p className="text-text-secondary text-xs mt-0.5">
            Your input will help fine-tune the model in the next retraining cycle.
          </p>
        </div>

        <form onSubmit={handleSubmitDownVote} className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Correct Diagnosis <span className="text-danger-critical">*</span>
            </label>
            <select
              required
              value={correctLabel}
              onChange={(e) => setCorrectLabel(e.target.value)}
              className="w-full bg-base border border-border-subtle rounded px-2.5 py-2 text-xs text-text-primary focus:border-primary outline-none transition-all min-h-[38px]"
            >
              <option value="" disabled>
                Select correct class
              </option>
              {DISEASE_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Clinical Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-base border border-border-subtle rounded px-2.5 py-2 text-xs text-text-primary focus:border-primary outline-none transition-all resize-none"
              placeholder="E.g., verified by biopsy..."
            />
          </div>

          <div className="flex gap-2 justify-end">
            <RippleButton
              type="button"
              variant="ghost"
              onClick={() => setVoted(null)}
              className="px-3 py-1.5 min-h-[36px] text-xs"
            >
              Cancel
            </RippleButton>
            <RippleButton
              type="submit"
              loading={isPending}
              className="px-3 py-1.5 min-h-[36px] text-xs"
            >
              Submit Feedback
            </RippleButton>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="clinical-card p-5 space-y-3.5">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">Was this AI prediction correct?</h4>
        <p className="text-text-secondary text-xs mt-0.5">
          Your feedback trains tomorrow's model.
        </p>
      </div>

      <div className="flex gap-3">
        <RippleButton
          variant="ghost"
          onClick={() => handleVote("up")}
          className="flex-1 flex items-center justify-center gap-2 border-success/20 text-success hover:bg-success/10"
          disabled={isPending}
        >
          {isPending && voted === "up" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsUp size={16} />
          )}
          Correct
        </RippleButton>

        <RippleButton
          variant="ghost"
          onClick={() => handleVote("down")}
          className="flex-1 flex items-center justify-center gap-2 border-danger-critical/20 text-danger-critical hover:bg-danger-critical/10"
          disabled={isPending}
        >
          <ThumbsDown size={16} />
          Incorrect
        </RippleButton>
      </div>
    </div>
  );
}
