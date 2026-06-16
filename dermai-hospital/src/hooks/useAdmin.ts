import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchAdminDashboard, triggerRetrain, fetchModelVersions, fetchAuditLogs } from "@/api/admin";
import { toast } from "sonner";

export function useAdminDashboard() {
  return useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminDashboard,
    retry: false,
  });
}

export function useTriggerRetrain() {
  return useMutation({
    mutationFn: triggerRetrain,
    onSuccess: () => {
      toast.success("Retrain queued! Check model versions shortly.");
    },
    onError: () => {
      toast.error("Failed to trigger retraining.");
    },
  });
}

export function useModelVersions() {
  return useQuery({
    queryKey: ["model-versions"],
    queryFn: fetchModelVersions,
    retry: false,
  });
}

export function useAuditLogs(limit?: number) {
  return useQuery({
    queryKey: ["audit-logs", limit],
    queryFn: () => fetchAuditLogs(limit),
    retry: false,
  });
}
