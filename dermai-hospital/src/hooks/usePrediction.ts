import { useQuery, useMutation } from "@tanstack/react-query";
import {
  submitPrediction,
  fetchPrediction,
  fetchReportImageBlobUrl,
  fetchReportPdfBlobUrl,
} from "@/api/predictions";
import { toast } from "sonner";

export function usePrediction(imageId: string) {
  return useQuery({
    queryKey: ["prediction", imageId],
    queryFn: () => fetchPrediction(imageId),
    enabled: !!imageId,
  });
}

export function useSubmitPrediction() {
  return useMutation({
    mutationFn: ({
      patientId,
      file,
      doctorNotes,
    }: {
      patientId: string;
      file: File;
      doctorNotes: string;
    }) => submitPrediction(patientId, file, doctorNotes),
    onError: () => {
      toast.error("Prediction failed. Please try again.");
    },
  });
}

export function useReportImage(imageId: string) {
  return useQuery({
    queryKey: ["report-image", imageId],
    queryFn: () => fetchReportImageBlobUrl(imageId),
    enabled: !!imageId,
    staleTime: Infinity,
  });
}

export function useReportPdf(imageId: string) {
  return useQuery({
    queryKey: ["report-pdf", imageId],
    queryFn: () => fetchReportPdfBlobUrl(imageId),
    enabled: !!imageId,
    staleTime: Infinity,
  });
}
