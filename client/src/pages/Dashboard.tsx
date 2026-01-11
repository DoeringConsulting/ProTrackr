import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Calendar, Euro, FileText, Users } from "lucide-react";

export default function Dashboard() {
  const { data: customers, isLoading: customersLoading } = trpc.customers.list.useQuery();
  const { data: timeEntries, isLoading: timeEntriesLoading } = trpc.timeEntries.list.useQuery({});

  const stats = [
    {
      title: "Kunden",
      value: customers?.length ?? 0,
      icon: Users,
      description: "Aktive Kunden",
      color: "text-indigo-600",
    },
    {
      title: "Zeiteinträge",
      value: timeEntries?.length ?? 0,
      icon: Calendar,
      description: "Diesen Monat",
      color: "text-emerald-600",
    },
    {
      title: "Umsatz",
      value: "€0",
      icon: Euro,
      description: "Diesen Monat",
      color: "text-amber-600",
    },
    {
      title: "Berichte",
      value: "0",
      icon: FileText,
      description: "Ausstehend",
      color: "text-rose-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Willkommen bei Döring Consulting - Projekt & Abrechnungsmanagement
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Aktuelle Projekte</CardTitle>
              <CardDescription>Übersicht Ihrer laufenden Projekte</CardDescription>
            </CardHeader>
            <CardContent>
              {customersLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : customers && customers.length > 0 ? (
                <div className="space-y-2">
                  {customers.slice(0, 5).map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{customer.projectName}</p>
                        <p className="text-sm text-muted-foreground">{customer.provider}</p>
                      </div>
                      <span className="text-sm font-medium">
                        {customer.costModel === "exclusive" ? "Exclusive" : "Inclusive"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Kunden vorhanden</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Letzte Zeiteinträge</CardTitle>
              <CardDescription>Ihre neuesten Zeiterfassungen</CardDescription>
            </CardHeader>
            <CardContent>
              {timeEntriesLoading ? (
                <p className="text-muted-foreground">Lädt...</p>
              ) : timeEntries && timeEntries.length > 0 ? (
                <div className="space-y-2">
                  {timeEntries.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{entry.projectName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(entry.date).toLocaleDateString("de-DE")}
                        </p>
                      </div>
                      <span className="text-sm font-medium">
                        {Math.floor(entry.hours / 60)}:{String(entry.hours % 60).padStart(2, "0")}h
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Keine Zeiteinträge vorhanden</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
