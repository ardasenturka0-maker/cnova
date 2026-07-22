"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type PatientOption = { id: string; firstName: string; lastName: string; branchId: string };
type DoctorOption = { id: string; name: string; branchId: string | null };

export function PatientDoctorFields({ patients, doctors }: { patients: PatientOption[]; doctors: DoctorOption[] }) {
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const patientBranchId = patients.find((patient) => patient.id === patientId)?.branchId;
  const eligibleDoctors = patientBranchId
    ? doctors.filter((doctor) => doctor.branchId === null || doctor.branchId === patientBranchId)
    : [];
  const selectedDoctorId = eligibleDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : "";

  return (
    <>
      <div className="space-y-2">
        <Label>Hasta</Label>
        <Select name="patientId" value={patientId} onChange={(event) => { setPatientId(event.target.value); setDoctorId(""); }} required>
          <option value="">Seçin</option>
          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Doktor</Label>
        <Select name="doctorId" value={selectedDoctorId} onChange={(event) => setDoctorId(event.target.value)} disabled={!patientBranchId} required>
          <option value="">{patientBranchId ? "Seçin" : "Önce hasta seçin"}</option>
          {eligibleDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
        </Select>
      </div>
    </>
  );
}
