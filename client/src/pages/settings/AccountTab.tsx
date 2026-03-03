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
import { Shield, Trash2, User, UserPlus, UserX } from "lucide-react";

type AuthUser = {
  id: number;
  mandantId: number | null;
  role: string;
  email: string;
  displayName?: string | null;
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSuspendOpen, setIsSuspendOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
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

  const roleOptions = useMemo(
    () =>
      isWebAppAdmin
        ? [
            { value: "user", label: "Benutzer" },
            { value: "mandant_admin", label: "Mandanten-Admin" },
            { value: "webapp_admin", label: "WebApp-Admin" },
          ]
        : [
            { value: "user", label: "Benutzer" },
            { value: "mandant_admin", label: "Mandanten-Admin" },
          ],
    [isWebAppAdmin]
  );

  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.usersAdmin.list.useQuery(undefined, {
    enabled: canManageUsers,
  });

  const createMutation = trpc.usersAdmin.create.useMutation({
    onSuccess: () => {
      utils.usersAdmin.list.invalidate();
      toast.success("Benutzer erfolgreich angelegt");
      setIsCreateOpen(false);
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("user");
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
      toast.error("Bitte mandantId fuer den neuen Benutzer angeben");
      return;
    }

    createMutation.mutate({
      email,
      displayName: displayName || undefined,
      password,
      role: role as "user" | "admin" | "mandant_admin" | "webapp_admin",
      mandantId: isWebAppAdmin ? Number(mandantId) : undefined,
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
            Benutzer im Berechtigungsbereich verwalten (anlegen, sperren, loeschen)
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Benutzer anlegen
        </Button>
      </div>

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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Benutzer anlegen</DialogTitle>
            <DialogDescription>
              Direkte Anlage ohne Einladungs-E-Mail (gemäß Freeze-Entscheidung).
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
            <div className="space-y-2">
              <Label>Rolle *</Label>
              <Select value={role} onValueChange={setRole}>
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
            {isWebAppAdmin && (
              <div className="space-y-2">
                <Label htmlFor="new-mandant-id">mandantId *</Label>
                <Input
                  id="new-mandant-id"
                  type="number"
                  min={1}
                  value={mandantId}
                  onChange={(e) => setMandantId(e.target.value)}
                  placeholder="z. B. 1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreateUser} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Speichere..." : "Benutzer anlegen"}
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
