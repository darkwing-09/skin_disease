import { api } from "./client";
import type { AdminDashboard, ModelVersion } from "@/types";

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const { data } = await api.get<AdminDashboard>("/admin/dashboard");
  return data;
}

export async function triggerRetrain() {
  const { data } = await api.post("/admin/trigger-retrain");
  return data;
}

export async function fetchModelVersions(): Promise<(ModelVersion & { training_samples?: number; created_at?: string })[]> {
  const { data } = await api.get<any[]>("/admin/model-versions");
  return data.map(m => ({
    version: m.version_tag,
    accuracy: m.accuracy,
    status: m.is_active ? "active" : "previous",
    promoted_at: m.promoted_at,
    training_samples: m.training_samples,
    created_at: m.created_at,
  }));
}

export interface AuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  payload: any;
  created_at: string;
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLogItem[]> {
  const { data } = await api.get<AuditLogItem[]>("/admin/audit-logs", {
    params: { limit },
  });
  return data;
}
