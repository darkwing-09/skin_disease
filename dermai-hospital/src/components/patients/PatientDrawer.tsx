import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RippleButton } from "@/components/common/RippleButton";
import { CopyableId } from "@/components/common/CopyableId";
import { useCreatePatient } from "@/hooks/usePatients";
import { useState } from "react";

const schema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female", "Other"]),
  blood_group: z.string().optional(),
  contact_number: z.string().optional(),
  medical_history: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientDrawer({ open, onOpenChange }: Props) {
  const { mutateAsync, isPending } = useCreatePatient();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    const patient = await mutateAsync(values);
    setCreatedId(patient.patient_id);
    reset();
  }

  function handleClose(v: boolean) {
    if (!v) {
      setCreatedId(null);
      reset();
    }
    onOpenChange(v);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="bg-surface border-l border-border-subtle w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-sora text-text-primary">
            Register New Patient
          </SheetTitle>
        </SheetHeader>

        {createdId ? (
          <div className="mt-8 text-center space-y-4">
            <p className="text-text-secondary text-sm">
              Patient registered successfully!
            </p>
            <div className="clinical-card p-4 flex items-center justify-center gap-2">
              <span className="text-text-secondary text-sm">Patient ID:</span>
              <CopyableId value={createdId} label="Patient ID" />
            </div>
            <RippleButton
              variant="ghost"
              onClick={() => setCreatedId(null)}
              className="w-full"
            >
              Register Another
            </RippleButton>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 space-y-4"
          >
            {/* Full Name */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Full Name <span className="text-danger-critical">*</span>
              </label>
              <input
                {...register("full_name")}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                placeholder="e.g. Rajesh Kumar"
              />
              {errors.full_name && (
                <p className="text-danger-critical text-xs mt-1">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Date of Birth <span className="text-danger-critical">*</span>
              </label>
              <input
                type="date"
                {...register("date_of_birth")}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
              />
              {errors.date_of_birth && (
                <p className="text-danger-critical text-xs mt-1">
                  {errors.date_of_birth.message}
                </p>
              )}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Gender <span className="text-danger-critical">*</span>
              </label>
              <select
                {...register("gender")}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                defaultValue=""
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              {errors.gender && (
                <p className="text-danger-critical text-xs mt-1">
                  {errors.gender.message}
                </p>
              )}
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Blood Group
              </label>
              <select
                {...register("blood_group")}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                defaultValue=""
              >
                <option value="">Not specified</option>
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                  (bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Contact Number
              </label>
              <input
                type="tel"
                {...register("contact_number")}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Medical History */}
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">
                Medical History
              </label>
              <textarea
                {...register("medical_history")}
                rows={3}
                className="w-full bg-base border border-border-subtle rounded px-3 py-2.5 text-text-primary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                placeholder="Known allergies, chronic conditions, medications…"
              />
            </div>

            <RippleButton
              type="submit"
              loading={isPending}
              className="w-full mt-2"
            >
              Register Patient
            </RippleButton>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
