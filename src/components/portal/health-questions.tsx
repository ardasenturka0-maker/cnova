import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const conditionQuestions = [
  { name: "heartDisease", label: "Kalp hastalığınız var mı?" },
  { name: "asthma", label: "Astımınız var mı?" },
  { name: "diabetes", label: "Diyabetiniz (şeker hastalığı) var mı?" },
  { name: "hypertension", label: "Yüksek tansiyonunuz var mı?" }
];

export function HealthQuestions({
  defaults
}: {
  defaults?: {
    heartDisease?: boolean;
    asthma?: boolean;
    diabetes?: boolean;
    hypertension?: boolean;
    allergies?: string | null;
    medications?: string | null;
    otherConditions?: string | null;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {conditionQuestions.map((question) => (
          <label key={question.name} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>{question.label}</span>
            <input
              className="h-5 w-5 accent-primary"
              type="checkbox"
              name={question.name}
              defaultChecked={Boolean(defaults?.[question.name as "heartDisease" | "asthma" | "diabetes" | "hypertension"])}
            />
          </label>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="otherConditions">Başka bir rahatsızlığınız var mı?</Label>
        <Input id="otherConditions" name="otherConditions" placeholder="Örn. böbrek rahatsızlığı" defaultValue={defaults?.otherConditions ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="allergies">Alerjiniz var mı? (ilaç, gıda vb.)</Label>
        <Input id="allergies" name="allergies" placeholder="Örn. penisilin alerjisi" defaultValue={defaults?.allergies ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="medications">Sürekli kullandığınız ilaçlar</Label>
        <Textarea id="medications" name="medications" rows={2} placeholder="Örn. kan sulandırıcı" defaultValue={defaults?.medications ?? ""} />
      </div>
    </div>
  );
}
