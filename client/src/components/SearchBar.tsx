import { useState, useRef, useEffect } from "react";
import { Search, Users, Clock, Receipt, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";

interface SearchResult {
  type: "customer" | "timeEntry" | "expense";
  id: number;
  title: string;
  subtitle?: string;
  metadata?: string;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isLoading } = trpc.search.global.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Open dropdown when typing
  useEffect(() => {
    if (query.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [query]);

  const handleResultClick = (type: string, id: number) => {
    if (type === "customer") {
      setLocation(`/customers`);
    } else if (type === "timeEntry") {
      setLocation(`/time-tracking`);
    } else if (type === "expense") {
      setLocation(`/expenses`);
    }
    setQuery("");
    setIsOpen(false);
  };

  const clearSearch = () => {
    setQuery("");
    setIsOpen(false);
  };

  // Group results by type
  const customers = results?.filter((r) => r.type === "customer") || [];
  const timeEntries = results?.filter((r) => r.type === "timeEntry") || [];
  const expenses = results?.filter((r) => r.type === "expense") || [];
  const totalResults = results?.length || 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Suchen... (Strg+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          className="pl-9 pr-9 h-9"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full mt-2 w-full bg-popover text-popover-foreground border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Suche läuft...
            </div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Keine Ergebnisse gefunden
            </div>
          ) : (
            <div className="py-2">
              {/* Customers */}
              {customers.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Kunden ({customers.length})
                  </div>
                  {customers.map((result) => (
                    <button
                      key={`customer-${result.id}`}
                      onClick={() => handleResultClick(result.type, result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3 transition-colors"
                    >
                      <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                        {result.metadata && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.metadata}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Time Entries */}
              {timeEntries.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-2 mt-2">
                    <Clock className="h-3 w-3" />
                    Zeiteinträge ({timeEntries.length})
                  </div>
                  {timeEntries.map((result) => (
                    <button
                      key={`timeEntry-${result.id}`}
                      onClick={() => handleResultClick(result.type, result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3 transition-colors"
                    >
                      <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Expenses */}
              {expenses.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-2 mt-2">
                    <Receipt className="h-3 w-3" />
                    Reisekosten ({expenses.length})
                  </div>
                  {expenses.map((result) => (
                    <button
                      key={`expense-${result.id}`}
                      onClick={() => handleResultClick(result.type, result.id)}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-start gap-3 transition-colors"
                    >
                      <Receipt className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
