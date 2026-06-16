import { useState, useMemo, useRef, useEffect } from "react";
import { Search, User, X, Plus } from "lucide-react";
import type { Patient } from "@/types";

interface Props {
  patients: Patient[];
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient | null) => void;
  onRegisterClick: () => void;
}

export function PatientPicker({
  patients,
  selectedPatient,
  onSelectPatient,
  onRegisterClick,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_id.toLowerCase().includes(q)
    );
  }, [patients, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="space-y-3 relative">
      <label className="block text-sm text-text-secondary font-medium">
        Step 1 — Select Patient
      </label>

      {selectedPatient ? (
        <div className="flex items-center justify-between p-3.5 bg-surface border border-primary/40 rounded-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-primary/10 text-primary">
              <User size={18} />
            </div>
            <div>
              <p className="font-sora font-semibold text-sm text-text-primary">
                {selectedPatient.full_name}
              </p>
              <p className="font-mono text-xs text-text-secondary mt-0.5">
                {selectedPatient.patient_id}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectPatient(null)}
            className="p-1 hover:bg-surface-hover rounded text-text-tertiary hover:text-text-primary transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Remove selected patient"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <input
              type="text"
              placeholder="Search patient by name or ID…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full bg-surface border border-border-subtle rounded px-3 py-2.5 pl-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
            />
          </div>

          {isOpen && (
            <div className="absolute z-10 w-full mt-1.5 bg-surface border border-border-subtle rounded-card shadow-2xl max-h-60 overflow-y-auto divide-y divide-border-subtle/50">
              {filtered.length > 0 ? (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPatient(p);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-surface-hover flex flex-col gap-0.5 transition-colors"
                  >
                    <span className="font-sora font-semibold text-sm text-text-primary">
                      {p.full_name}
                    </span>
                    <span className="font-mono text-xs text-text-secondary">
                      {p.patient_id} · DOB: {p.date_of_birth}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-center">
                  <p className="text-text-secondary text-sm">
                    {query.trim() ? "No patients found" : "Type to search..."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onRegisterClick();
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2 font-medium"
                  >
                    <Plus size={12} /> Register New Patient
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedPatient && (
        <button
          type="button"
          onClick={onRegisterClick}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
        >
          <Plus size={12} /> Register New Patient
        </button>
      )}
    </div>
  );
}
