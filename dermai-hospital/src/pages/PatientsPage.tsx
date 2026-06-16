import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { usePatients } from "@/hooks/usePatients";
import { PatientTable } from "@/components/patients/PatientTable";
import { PatientDrawer } from "@/components/patients/PatientDrawer";
import { EmptyState } from "@/components/common/EmptyState";
import { RippleButton } from "@/components/common/RippleButton";
import { ScrollReveal } from "@/components/common/ScrollReveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export default function PatientsPage() {
  const { data: patients = [], isLoading } = usePatients();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Patients" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-sora font-bold">Patient Registry</h1>
          <p className="text-text-secondary text-sm mt-1">
            {patients.length} registered patients
          </p>
        </div>
        <RippleButton onClick={() => setDrawerOpen(true)}>
          <UserPlus size={16} className="mr-2 inline" />
          Register New Patient
        </RippleButton>
      </div>

      <ScrollReveal>
        {!isLoading && patients.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="No patients yet"
            description="Register your first patient to begin tracking their dermatological assessments."
            action={
              <RippleButton onClick={() => setDrawerOpen(true)}>
                <UserPlus size={16} className="mr-2 inline" />
                Register First Patient
              </RippleButton>
            }
          />
        ) : (
          <PatientTable patients={patients} isLoading={isLoading} />
        )}
      </ScrollReveal>

      <PatientDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
