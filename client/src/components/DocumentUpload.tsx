import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Upload, File, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentUploadProps {
  expenseId?: number;
  timeEntryId?: number;
  onUploadComplete?: () => void;
}

export function DocumentUpload({ expenseId, timeEntryId, onUploadComplete }: DocumentUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const uploadMutation = trpc.documents.create.useMutation({
    onSuccess: () => {
      toast.success("Beleg erfolgreich hochgeladen");
      setFile(null);
      setDescription("");
      if (onUploadComplete) onUploadComplete();
      if (expenseId) utils.documents.listByExpense.invalidate({ expenseId });
    },
    onError: (error) => {
      toast.error(`Upload fehlgeschlagen: ${error.message}`);
      setUploading(false);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Check file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("Datei ist zu groß. Maximale Größe: 10MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Bitte wählen Sie eine Datei aus");
      return;
    }

    if (!expenseId && !timeEntryId) {
      toast.error("Keine Verknüpfung angegeben");
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(",")[1]; // Remove data:image/...;base64, prefix

        // Upload to S3 via backend
        const fileKey = `documents/${Date.now()}-${file.name}`;
        const fileUrl = `https://storage.example.com/${fileKey}`; // This should be replaced with actual S3 upload
        
        await uploadMutation.mutateAsync({
          fileName: file.name,
          fileKey,
          fileUrl,
          mimeType: file.type,
          fileSize: file.size,
          expenseId,
          timeEntryId,
        });

        setUploading(false);
      };
      reader.onerror = () => {
        toast.error("Fehler beim Lesen der Datei");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error("Upload fehlgeschlagen");
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Beleg hochladen</Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              disabled={uploading}
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
              <File className="h-4 w-4" />
              <span className="text-sm flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFile(null)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung (optional)</Label>
            <Input
              id="description"
              placeholder="z.B. Tankquittung, Hotelrechnung..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Hochladen
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DocumentListProps {
  expenseId?: number;
  timeEntryId?: number;
}

export function DocumentList({ expenseId, timeEntryId }: DocumentListProps) {
  const { data: documents, isLoading } = expenseId
    ? trpc.documents.listByExpense.useQuery({ expenseId })
    : { data: [], isLoading: false };

  const utils = trpc.useUtils();
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      toast.success("Beleg gelöscht");
      if (expenseId) utils.documents.listByExpense.invalidate({ expenseId });
    },
    onError: (error) => {
      toast.error(`Löschen fehlgeschlagen: ${error.message}`);
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Lädt...</p>;
  }

  if (!documents || documents.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Belege vorhanden</p>;
  }

  return (
    <div className="space-y-2">
      {documents.map((doc: any) => (
        <div
          key={doc.id}
          className="flex items-center gap-2 p-3 border rounded-md hover:bg-muted/50 transition-colors"
        >
          <File className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.filename}</p>
            {doc.description && (
              <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(doc.fileUrl, "_blank")}
          >
            Öffnen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Beleg wirklich löschen?")) {
                deleteMutation.mutate({ id: doc.id });
              }
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
