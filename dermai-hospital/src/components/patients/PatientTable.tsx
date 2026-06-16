import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Eye, Microscope } from "lucide-react";
import type { Patient } from "@/types";
import { CopyableId } from "@/components/common/CopyableId";
import { ShimmerSkeleton } from "@/components/common/ShimmerSkeleton";
import { formatDate } from "@/lib/utils";

interface Props {
  patients: Patient[];
  isLoading: boolean;
}

export function PatientTable({ patients, isLoading }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = useMemo(() => {
    if (!search) return patients;
    const q = search.toLowerCase();
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.patient_id.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const pageCount = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  if (isLoading) {
    return (
      <div className="clinical-card p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          placeholder="Search by name or patient ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-full bg-surface border border-border-subtle rounded px-3 py-2.5 pl-9 text-sm text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[44px]"
        />
      </div>

      <div className="clinical-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-text-secondary">
              <th className="text-left px-4 py-3 font-medium">Patient ID</th>
              <th className="text-left px-4 py-3 font-medium">Full Name</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                DOB
              </th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">
                Gender
              </th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">
                Blood Group
              </th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border-subtle/50 hover:bg-surface-hover/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <CopyableId value={p.patient_id} label="Patient ID" />
                </td>
                <td className="px-4 py-3 text-text-primary font-medium">
                  {p.full_name}
                </td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                  {p.date_of_birth ? formatDate(p.date_of_birth) : "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary hidden md:table-cell">
                  {p.gender ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary hidden lg:table-cell">
                  {p.blood_group ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/patients/${p.patient_id}`}
                      className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm transition-colors min-h-[32px]"
                    >
                      <Eye size={14} /> View
                    </Link>
                    <Link
                      to={`/scan?patient=${p.patient_id}`}
                      className="inline-flex items-center gap-1.5 text-success hover:text-success/80 text-sm transition-colors min-h-[32px]"
                    >
                      <Microscope size={14} /> Scan
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>
            Showing {page * perPage + 1}–
            {Math.min((page + 1) * perPage, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-border-subtle hover:bg-surface-hover disabled:opacity-40 transition-colors min-h-[32px]"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-1.5 rounded border border-border-subtle hover:bg-surface-hover disabled:opacity-40 transition-colors min-h-[32px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
