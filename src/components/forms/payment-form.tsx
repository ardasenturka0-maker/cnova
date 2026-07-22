"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";

export type PaymentFormPatient = { id: string; name: string };
export type PaymentFormTreatment = { id: string; patientId: string; label: string; fee: number };

export function PaymentForm({
  action,
  patients,
  treatments,
  locale
}: {
  action: (formData: FormData) => Promise<void>;
  patients: PaymentFormPatient[];
  treatments: PaymentFormTreatment[];
  locale: Locale;
}) {
  const [patientId, setPatientId] = useState("");
  const [treatmentId, setTreatmentId] = useState("");
  const [listAmount, setListAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("PAID");
  const [type, setType] = useState("INCOME");

  const patientTreatments = useMemo(
    () => (patientId ? treatments.filter((treatment) => treatment.patientId === patientId) : treatments),
    [patientId, treatments]
  );

  function computeFinal(list: string, discount: string) {
    const listValue = Number(list);
    const discountValue = Number(discount || 0);
    if (!list || !Number.isFinite(listValue)) return;
    setAmount(String(Math.max(listValue - discountValue, 0)));
  }

  function onPatientChange(nextPatientId: string) {
    setPatientId(nextPatientId);
    if (treatmentId) {
      const selected = treatments.find((treatment) => treatment.id === treatmentId);
      if (selected && nextPatientId && selected.patientId !== nextPatientId) setTreatmentId("");
    }
  }

  function onTreatmentChange(nextTreatmentId: string) {
    setTreatmentId(nextTreatmentId);
    const selected = treatments.find((treatment) => treatment.id === nextTreatmentId);
    if (!selected) return;
    setPatientId(selected.patientId);
    setListAmount(String(selected.fee));
    computeFinal(String(selected.fee), discountAmount);
  }

  const discountValue = Number(discountAmount || 0);
  const listValue = Number(listAmount || 0);
  const showSummary = listAmount !== "" && Number.isFinite(listValue) && listValue > 0;

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-4">
      <div className="space-y-2">
        <Label>Hasta</Label>
        <Select name="patientId" value={patientId} onChange={(event) => onPatientChange(event.target.value)}>
          <option value="">Klinik / genel</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.name}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>İşlem / tedavi</Label>
        <Select name="treatmentId" value={treatmentId} onChange={(event) => onTreatmentChange(event.target.value)}>
          <option value="">İşlem seçilmedi</option>
          {patientTreatments.map((treatment) => (
            <option key={treatment.id} value={treatment.id}>
              {treatment.label} · {formatCurrency(treatment.fee, locale)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label>İşlem tipi</Label>
        <Select name="type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="INCOME">Gelir</option>
          <option value="EXPENSE">Gider</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Yöntem</Label>
        <Select name="method" defaultValue="CARD">
          <option value="CASH">Nakit</option>
          <option value="CARD">Kart</option>
          <option value="TRANSFER">Havale</option>
          <option value="ONLINE">Online</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Liste fiyatı</Label>
        <Input
          name="listAmount"
          type="number"
          min="0"
          step="0.01"
          value={listAmount}
          onChange={(event) => {
            setListAmount(event.target.value);
            computeFinal(event.target.value, discountAmount);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>İndirim</Label>
        <Input
          name="discountAmount"
          type="number"
          min="0"
          step="0.01"
          value={discountAmount}
          onChange={(event) => {
            setDiscountAmount(event.target.value);
            computeFinal(listAmount, event.target.value);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>Son tutar</Label>
        <Input name="amount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Referans / bağlantı</Label>
        <Input name="referralSource" placeholder="Örn. Dr. Emir Aydın, Google, hasta tavsiyesi" />
      </div>
      <div className="space-y-2">
        <Label>Durum</Label>
        <Select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="PAID">Ödendi</option>
          <option value="PENDING">Bekliyor</option>
          <option value="CANCELLED">İptal</option>
        </Select>
      </div>
      {type === "INCOME" ? <label className="flex min-h-10 items-center gap-3 rounded-md border px-3 text-sm">
        <input name="isDeposit" type="checkbox" className="h-4 w-4" />
        Bu tahsilat peşinattır
      </label> : null}
      <div className="space-y-2">
        <Label>Tarih</Label>
        <Input name="paidAt" type="date" />
      </div>
      <div className="space-y-2">
        <Label>Vade tarihi</Label>
        <Input name="dueDate" type="date" />
        {status === "PENDING" ? <p className="text-xs text-muted-foreground">Bekleyen tahsilatın planlanan tarihi.</p> : null}
      </div>
      <div className="space-y-2 lg:col-span-4">
        <Label>Açıklama</Label>
        <Textarea name="description" />
      </div>
      {showSummary ? (
        <p className="text-sm text-muted-foreground lg:col-span-4">
          {formatCurrency(listValue, locale)} − {formatCurrency(discountValue, locale)} indirim → <span className="font-semibold text-foreground">{formatCurrency(Number(amount || 0), locale)}</span>
        </p>
      ) : null}
      <Button className="w-fit lg:col-span-4" type="submit">Kaydet</Button>
    </form>
  );
}
