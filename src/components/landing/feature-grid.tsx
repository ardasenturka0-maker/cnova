import { Card, CardContent } from "@/components/ui/card";
import { features } from "@/lib/marketing";

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} className="h-full">
          <CardContent className="flex h-full flex-col p-5">
            <feature.icon className="mb-4 h-6 w-6 text-primary" />
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
