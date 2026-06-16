import { api } from "./client";
import type { Patient } from "@/types";

export interface CreatePatientInput {
  full_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  contact_number?: string;
  medical_history?: string;
}

export async function fetchPatients(): Promise<Patient[]> {
  const { data } = await api.get<Patient[]>("/patients/");
  return data;
}

export async function fetchPatientByUuid(id: string): Promise<Patient> {
  const { data } = await api.get<Patient>(`/patients/${id}`);
  return data;
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  // Backend expects QUERY PARAMS, not a JSON body.
  const params = new URLSearchParams();
  params.append("full_name", input.full_name);
  params.append("date_of_birth", input.date_of_birth);
  params.append("gender", input.gender);
  if (input.blood_group) params.append("blood_group", input.blood_group);
  if (input.contact_number) params.append("contact_number", input.contact_number);
  if (input.medical_history) params.append("medical_history", input.medical_history);

  const { data } = await api.post<Patient>(`/patients/?${params.toString()}`);
  return data;
}
