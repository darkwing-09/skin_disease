import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPatients, fetchPatientByUuid, createPatient } from "@/api/patients";
import type { CreatePatientInput } from "@/api/patients";
import { toast } from "sonner";

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: fetchPatients,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatientByUuid(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => createPatient(input),
    onSuccess: (patient) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      toast.success(`Patient registered: ${patient.patient_id}`);
    },
    onError: () => {
      toast.error("Failed to register patient.");
    },
  });
}
