import DashboardLayout from "@/components/DashboardLayout";
import TaxesTab from "./settings/TaxesTab";

export default function TaxSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <TaxesTab />
      </div>
    </DashboardLayout>
  );
}
