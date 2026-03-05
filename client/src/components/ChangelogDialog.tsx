import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Bug } from "lucide-react";

interface Change {
  type: 'feature' | 'improvement' | 'fix';
  title: string;
  description: string;
}

interface Version {
  version: string;
  date: string;
  changes: Change[];
}

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: Version;
}

export function ChangelogDialog({ open, onOpenChange, version }: ChangelogDialogProps) {
  const getIcon = (type: Change['type']) => {
    switch (type) {
      case 'feature':
        return <Sparkles className="h-5 w-5 text-primary" />;
      case 'improvement':
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case 'fix':
        return <Bug className="h-5 w-5 text-[var(--badge-exclusive-text)]" />;
    }
  };

  const getBadgeVariant = (type: Change['type']) => {
    switch (type) {
      case 'feature':
        return 'default';
      case 'improvement':
        return 'secondary';
      case 'fix':
        return 'destructive';
    }
  };

  const getTypeLabel = (type: Change['type']) => {
    switch (type) {
      case 'feature':
        return 'Neu';
      case 'improvement':
        return 'Verbessert';
      case 'fix':
        return 'Behoben';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Was ist neu in Version {version.version}?
          </DialogTitle>
          <DialogDescription>
            Veröffentlicht am {new Date(version.date).toLocaleDateString('de-DE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {version.changes.map((change, index) => (
            <div key={index} className="flex gap-3 p-4 rounded-lg border bg-card">
              <div className="flex-shrink-0 mt-1">
                {getIcon(change.type)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{change.title}</h4>
                  <Badge variant={getBadgeVariant(change.type)} className="text-xs">
                    {getTypeLabel(change.type)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{change.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-[var(--badge-inclusive-bg)] rounded-lg border border-[var(--badge-inclusive-text)]/30">
          <p className="text-sm text-[var(--badge-inclusive-text)]">
            💡 <strong>Tipp:</strong> Die App aktualisiert sich automatisch. Sie müssen nichts weiter tun!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
