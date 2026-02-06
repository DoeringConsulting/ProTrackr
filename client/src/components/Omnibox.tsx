import { useState, useEffect } from "react";
import { Command } from "cmdk";
import { trpc } from "@/lib/trpc";
import { Search, Users, Clock, Receipt, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface OmniboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function Omnibox({ open, onOpenChange }: OmniboxProps) {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();
  
  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query },
    { enabled: query.length > 0 }
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const handleSelect = (type: string, id: number) => {
    onOpenChange(false);
    
    switch (type) {
      case "customer":
        setLocation(`/customers?id=${id}`);
        break;
      case "timeEntry":
        setLocation(`/time-tracking?id=${id}`);
        break;
      case "expense":
        setLocation(`/expenses?id=${id}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "customer":
        return <Users className="h-4 w-4" />;
      case "timeEntry":
        return <Clock className="h-4 w-4" />;
      case "expense":
        return <Receipt className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "customer":
        return "Kunde";
      case "timeEntry":
        return "Zeiteintrag";
      case "expense":
        return "Reisekosten";
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl">
        <Command className="rounded-lg border-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Suche nach Kunden, Zeiteinträgen, Reisekosten..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />}
          </div>
          
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {query.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Geben Sie einen Suchbegriff ein...
              </div>
            )}
            
            {query.length > 0 && !isLoading && results && results.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Keine Ergebnisse gefunden
              </div>
            )}

            {results && results.length > 0 && (
              <>
                {["customer", "timeEntry", "expense"].map((type) => {
                  const typeResults = results.filter((r) => r.type === type);
                  if (typeResults.length === 0) return null;

                  return (
                    <Command.Group key={type} heading={getTypeLabel(type)} className="mb-2">
                      {typeResults.map((result) => (
                        <Command.Item
                          key={`${result.type}-${result.id}`}
                          value={`${result.type}-${result.id}-${result.title}`}
                          onSelect={() => handleSelect(result.type, result.id)}
                          className="flex items-start gap-3 px-3 py-2 cursor-pointer rounded-md hover:bg-accent aria-selected:bg-accent"
                        >
                          <div className="mt-0.5">{getIcon(result.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            {result.subtitle && (
                              <div className="text-sm text-muted-foreground truncate">
                                {result.subtitle}
                              </div>
                            )}
                            {result.metadata && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {result.metadata}
                              </div>
                            )}
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
