import { notifyOwner } from "./_core/notification";

export async function notifyMonthEnd(month: string, revenue: number, expenses: number) {
  const title = `Monatsabschluss ${month}`;
  const content = `Der Monat ${month} ist abgeschlossen.\n\nUmsatz: €${(revenue / 100).toFixed(2)}\nKosten: €${(expenses / 100).toFixed(2)}\nGewinn: €${((revenue - expenses) / 100).toFixed(2)}`;
  
  return await notifyOwner({ title, content });
}

export async function notifyMissingTimeEntries(date: string, daysWithoutEntries: number) {
  const title = "Fehlende Zeiterfassungen";
  const content = `Es fehlen Zeiterfassungen für ${daysWithoutEntries} Tag(e) bis ${date}. Bitte vervollständigen Sie Ihre Zeiterfassung.`;
  
  return await notifyOwner({ title, content });
}

export async function notifyUpcomingInvoiceDeadline(customer: string, deadline: string, daysLeft: number) {
  const title = "Anstehende Abrechnungsfrist";
  const content = `Die Abrechnung für ${customer} ist in ${daysLeft} Tag(en) fällig (${deadline}). Bitte erstellen Sie den Bericht rechtzeitig.`;
  
  return await notifyOwner({ title, content });
}

export async function notifyIncompleteExpenses(month: string, entriesWithoutExpenses: number) {
  const title = "Unvollständige Reisekostenabrechnungen";
  const content = `Für ${month} gibt es ${entriesWithoutExpenses} Zeiteintrag/Einträge ohne zugeordnete Reisekosten. Bitte prüfen Sie, ob Reisekosten angefallen sind.`;
  
  return await notifyOwner({ title, content });
}
