import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Building2, Shield, Trash2, UserPlus, UserX } from "lucide-react";

type AuthUser = {
  id: number;
  mandantId: number | null;
  role: string;
  email: string;
  displayName?: string | null;
};

type MandantItem = {
  id: number;
  name: string;
  mandantNr: string;
};

function getRoleLabel(role: string) {
  switch (role) {
    case "webapp_admin":
      return "WebApp-Admin";
    case "mandant_admin":
    case "admin":
      return "Mandanten-Admin";
    default:
      return "Benutzer";
  }
}

export default function AccountTab() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isCreateMandantOpen, setIsCreateMandantOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [mandantName, setMandantName] = useState("");
  const [mandantNr, setMandantNr] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "mandant_admin" | "webapp_admin">("user");
  const [mandantId, setMandantId] = useState("");

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          setAuthUser(null);
          return;
        }
        const data = await res.json();
        if (data?.user) {
          setAuthUser({
            id: data.user.id,
            mandantId: data.user.mandantId ?? null,
            role: data.user.role,
            email: data.user.email,
            displayName: data.user.displayName ?? null,
          });
        }
      } finally {
        setAuthLoading(false);
      }
    };
    loadMe();
  }, []);

  const isWebAppAdmin = authUser?.role === "webapp_admin";
  const canManageUsers = ["webapp_admin", "mandant_admin", "admin"].includes(authUser?.role || "");

  useEffect(() => {
    setRole(isWebAppAdmin ? "mandant_admin" : "user");
  }, [isWebAppAdmin]);

  const roleOptions = useMemo(
    () =>
      isWebAppAdmin
        ? [
            { value: "mandant_admin", label: "Mandanten-Admin" },
            { value: "webapp_admin", label: "WebApp-Admin" },
          ]
        : [{ value: "user", label: "Benutzer" }],
    [isWebAppAdmin]
  );

  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.usersAdmin.list.useQuery(undefined, {
    enabled: canManageUsers,
  });
  const { data: mandanten = [], isLoading: mandantenLoading } = trpc.mandantenAdmin.list.useQuery(
    undefined,
    { enabled: isWebAppAdmin }
  );

  const createMandantMutation = trpc.mandantenAdmin.create.useMutation({
    onSuccess: (created) => {
      utils.mandantenAdmin.list.invalidate();
      toast.success("Mandant erfolgreich angelegt");
      setIsCreateMandantOpen(false);
      setMandantName("");
      setMandantNr("");
      if (created?.id) {
        setMandantId(String(created.id));
      }
    },
    onError: (error) => {
      toast.error(`Fehler beim Anlegen des Mandanten: ${error.message}`);
    },
  });

  const createMutation = trpc.usersAdmin.create.useMutation({
    onSuccess: () => {
      utils.usersAdmin.list.invalidate();
      toast.success("Benutzer erfolgreich angelegt");
      setIsCreateOpen(false);
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole(isWebAppAdmin ? "mandant_admin" : "user");
      setMandantId("");
    },
    onError: (error) => {
      toast.error(`Fehler beim Anlegen: ${error.message}`);
    },
  });

  const suspendMutation = trpc.usersAdmin.suspend.useMutation({
    onSuccess: () => {
      utils.usersAdmin.list.invalidate();
      toast.success("Benutzer wurde gesperrt");
      setIsSuspendOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error(`Fehler beim Sperren: ${error.message}`);
    },
  });

  const deleteMutation = trpc.usersAdmin.delete.useMutation({
    onSuccess: () => {
      utils.usersAdmin.list.invalidate();
      toast.success("Benutzer wurde geloescht");
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error(`Fehler beim Loeschen: ${error.message}`);
    },
  });

  const handleCreateUser = () => {
    if (!email || !password) {
      toast.error("E-Mail und Passwort sind Pflichtfelder");
      return;
    }
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }

    if (isWebAppAdmin && !mandantId) {
      toast.error("Bitte zuerst einen Mandanten auswaehlen");
      return;
    }

    const targetRole = isWebAppAdmin ? role : "user";

    createMutation.mutate({
      email,
      displayName: displayName || undefined,
      password,
      role: targetRole,
      mandantId: isWebAppAdmin ? Number(mandantId) : undefined,
    });
  };

  const handleCreateMandant = () => {
    const trimmedName = mandantName.trim();
    const trimmedNr = mandantNr.trim();

    if (!trimmedName || !trimmedNr) {
      toast.error("Name und Mandantennummer sind Pflichtfelder");
      return;
    }

    createMandantMutation.mutate({
      name: trimmedName,
      mandantNr: trimmedNr,
    });
  };

  if (authLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Lade Benutzerrechte...</CardContent>
      </Card>
    );
  }

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Kein Zugriff
          </CardTitle>
          <CardDescription>
            Die Benutzerverwaltung ist nur fuer Mandanten-Admins und WebApp-Admins verfuegbar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Konto-Verwaltung</h2>
          <p className="text-muted-foreground">
            {isWebAppAdmin
              ? "Setup-Flow: Mandant anlegen, Mandanten-Admin anlegen, dann Benutzer je Mandant verwalten"
              : "Mandanten-Benutzer verwalten (anlegen, sperren, loeschen)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isWebAppAdmin && (
            <Button variant="outline" onClick={() => setIsCreateMandantOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              Mandant anlegen
            </Button>
          )}
          <Button onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {isWebAppAdmin ? "Mandanten-Admin anlegen" : "Benutzer anlegen"}
          </Button>
        </div>
      </div>

      {isWebAppAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Verbindlicher Setup-Flow</CardTitle>
            <CardDescription>
              Schritt 1: Mandant anlegen. Schritt 2: Mandanten-Admin anlegen. Schritt 3: Mandanten-Admin legt Benutzer an.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>1) Ohne Mandant keine Benutzeranlage im Mandantenkontext.</p>
            <p>2) Der erste Benutzer eines Mandanten ist der Mandanten-Admin.</p>
            <p>3) Weitere Mandanten-Benutzer werden durch den Mandanten-Admin angelegt.</p>
          </CardContent>
        </Card>
      )}

      {isWebAppAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Mandantenliste</CardTitle>
            <CardDescription>Alle vorhandenen Mandanten fuer den Setup-Schritt 1</CardDescription>
          </CardHeader>
          <CardContent>
            {mandantenLoading ? (
              <p className="text-sm text-muted-foreground">Lade Mandanten...</p>
            ) : mandanten.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Mandanten vorhanden.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Mandant</TableHead>
                    <TableHead>Mandant-Nr</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mandanten as MandantItem[]).map((mandant) => (
                    <TableRow key={mandant.id}>
                      <TableCell>{mandant.id}</TableCell>
                      <TableCell>{mandant.name}</TableCell>
                      <TableCell>{mandant.mandantNr}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Benutzerliste</CardTitle>
          <CardDescription>
            {isWebAppAdmin
              ? "Globaler WebApp-Admin-Bereich"
              : `Mandantenbereich (mandantId: ${authUser?.mandantId ?? "-"})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lade Benutzer...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Benutzer gefunden.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Mandant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === authUser?.id;
                  const isActive = Number(user.isActive ?? 1) === 1;
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.displayName || "-"}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleLabel(String(user.role))}</TableCell>
                      <TableCell>{user.mandantId}</TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "default" : "destructive"}>
                          {isActive ? "Aktiv" : "Gesperrt"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSelf || !isActive || suspendMutation.isPending}
                            onClick={() => {
                              setSelectedUser(user);
                              setIsSuspendOpen(true);
                            }}
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Sperren
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={isSelf || deleteMutation.isPending}
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Loeschen
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateMandantOpen} onOpenChange={setIsCreateMandantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Mandanten anlegen</DialogTitle>
            <DialogDescription>
              Schritt 1: Mandantenstammsatz erstellen, danach Mandanten-Admin anlegen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-mandant-name">Mandantenname *</Label>
              <Input
                id="new-mandant-name"
                value={mandantName}
                onChange={(e) => setMandantName(e.target.value)}
                placeholder="z. B. Muster GmbH"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-mandant-nr">Mandantennummer *</Label>
              <Input
                id="new-mandant-nr"
                value={mandantNr}
                onChange={(e) => setMandantNr(e.target.value)}
                placeholder="z. B. MANDANT_001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateMandantOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateMandant} disabled={createMandantMutation.isPending}>
              {createMandantMutation.isPending ? "Speichere..." : "Mandant anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isWebAppAdmin ? "Mandanten-Admin anlegen" : "Neuen Benutzer anlegen"}</DialogTitle>
            <DialogDescription>
              {isWebAppAdmin
                ? "Schritt 2: Admin-Benutzer fuer den ausgewaehlten Mandanten anlegen."
                : "Direkte Anlage im eigenen Mandanten ohne Einladungs-E-Mail."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">E-Mail *</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firma.de"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Anzeigename"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Initiales Passwort *</Label>
              <Input
                id="new-password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
              />
            </div>
            {isWebAppAdmin && (
              <>
                <div className="space-y-2">
                  <Label>Rolle *</Label>
                  <Select
                    value={role}
                    onValueChange={(value) =>
                      setRole(value as "user" | "mandant_admin" | "webapp_admin")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mandant *</Label>
                  <Select value={mandantId} onValueChange={setMandantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mandant auswaehlen" />
                    </SelectTrigger>
                    <SelectContent>
                      {(mandanten as MandantItem[]).map((mandant) => (
                        <SelectItem key={mandant.id} value={String(mandant.id)}>
                          {mandant.name} ({mandant.mandantNr})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            {!isWebAppAdmin && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Rolle fuer neue Benutzer: <span className="font-medium text-foreground">Benutzer</span>
              </div>
            )}
            {isWebAppAdmin && !mandantenLoading && mandanten.length === 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Es ist noch kein Mandant vorhanden. Bitte zuerst "Mandant anlegen".
              </div>
            )}
            {isWebAppAdmin && (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                Nach der Anlage meldet sich der Mandanten-Admin an und legt dann die Mandanten-Benutzer an.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={
                createMutation.isPending ||
                (isWebAppAdmin && (!mandantId || mandanten.length === 0))
              }
            >
              {createMutation.isPending
                ? "Speichere..."
                : isWebAppAdmin
                  ? "Mandanten-Admin anlegen"
                  : "Benutzer anlegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer sperren?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser
                ? `Der Benutzer ${selectedUser.email} wird gesperrt (Login deaktiviert).`
                : "Der Benutzer wird gesperrt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && suspendMutation.mutate({ userId: selectedUser.id })}
            >
              Sperren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser
                ? `Der Benutzer ${selectedUser.email} wird dauerhaft entfernt.`
                : "Der Benutzer wird dauerhaft entfernt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteMutation.mutate({ userId: selectedUser.id })}
            >
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
