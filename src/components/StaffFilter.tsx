"use client";

import { useEffect, useState } from "react";
import { getApi } from "@/lib/data";
import type { Profile } from "@/lib/types";
import { Label, Select } from "./primitives";

/** Dropdown of team members (admin only). value = profile id, "" = everyone. */
export function StaffFilter({ value, onChange, label = "Personal" }: { value: string; onChange: (id: string) => void; label?: string }) {
  const [people, setPeople] = useState<Profile[]>([]);
  useEffect(() => {
    getApi()
      .listProfiles()
      .then(setPeople)
      .catch(() => setPeople([]));
  }, []);
  return (
    <label>
      <Label>{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        <option value="">Todos</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </Select>
    </label>
  );
}
