import DashboardLayout from "@/components/DashboardLayout";

export default function TimeTracking() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold">Zeiterfassung</h1>
        <p className="text-muted-foreground mt-2">Erfassen Sie Ihre Arbeitszeiten und Reisekosten</p>
      </div>
    </DashboardLayout>
  );
}
