"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Users, Loader2, Trash2, AlertTriangle, KeyRound } from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface Props {
  profiles: Profile[];
  currentUserId?: string;
}

export function EvaluatorsClient({ profiles: initialProfiles, currentUserId }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !fullName) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/create-evaluator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create evaluator");
      }

      toast.success(`Account created for ${email}`);
      // Optimistically update the list if possible, or just refresh
      // Since we have local state, let's refresh or fetch again. 
      // Actually router.refresh() is better if we want to stay in sync with server.
      // But user wants "without full page reload" for deletion.
      // For creation, we can also update local state if we had the new user data back.
      // The API returns data.user.
      if (data.user) {
        setProfiles(prev => [{
          id: data.user.id,
          full_name: fullName,
          role: "evaluator",
          created_at: new Date().toISOString()
        } as Profile, ...prev]);
      }
      
      setEmail("");
      setPassword("");
      setFullName("");
      // router.refresh(); // Keep it for safety but local state handles UI
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/delete-user?id=${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      
      toast.success("User deleted successfully");
      setProfiles(prev => prev.filter(p => p.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget.id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      toast.success(`Password reset for ${resetTarget.full_name || "user"}`);
      setResetTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetLoading(false);
    }
  };

  const evaluators = profiles.filter((p) => p.role === "evaluator");
  const admins = profiles.filter((p) => p.role === "admin");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)", color: "var(--bw-content-primary)" }}>Manage Evaluators</h2>
        <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
          Create evaluator accounts for panel members
        </p>
      </div>

      <Card variant="flat">
        <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)", borderBottom: "1px solid var(--bw-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
            <UserPlus size={18} style={{ color: "var(--bw-content-tertiary)" }} />
            <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Create Evaluator Account</CardTitle>
          </div>
        </CardHeader>
        <CardContent style={{ padding: "var(--bw-space-6)" }}>
          <form onSubmit={handleCreateAccount} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--bw-space-6)", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label htmlFor="invite-fullname" style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>Full Name</Label>
              <Input
                id="invite-fullname"
                placeholder="Dr. Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                pill
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label htmlFor="invite-email" style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="jane.doe@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                pill
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label htmlFor="invite-password" style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>Initial Password</Label>
              <Input
                id="invite-password"
                type="password"
                placeholder="Set a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                pill
                style={{ width: "100%" }}
              />
            </div>
            <Button
              id="invite-submit"
              type="submit"
              disabled={loading}
              style={{ height: 44, width: "100%" }}
            >
              {loading && <Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />}
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Users Table */}
      <Card variant="flat">
        <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)", borderBottom: "1px solid var(--bw-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
            <Users size={18} style={{ color: "var(--bw-content-tertiary)" }} />
            <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>All Users ({profiles.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent style={{ padding: "var(--bw-space-0) var(--bw-space-6) var(--bw-space-6)" }}>
          <div style={{ overflowX: "auto", margin: "0 calc(var(--bw-space-6) * -1)" }}>
            <Table style={{ minWidth: 600 }}>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ paddingLeft: "var(--bw-space-6)" }}>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.length === 0 && evaluators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                   [...admins, ...evaluators].map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell style={{ fontWeight: "var(--bw-fw-medium)" as any, paddingLeft: "var(--bw-space-6)" }}>
                        {profile.full_name || "—"}
                        {profile.id === currentUserId && (
                          <span style={{ marginLeft: "var(--bw-space-2)", fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", fontWeight: "normal" }}>(You)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={profile.role === "admin" ? "default" : "secondary"} style={{ textTransform: "capitalize" }}>
                          {profile.role}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ color: "var(--bw-content-secondary)", fontSize: "var(--bw-fs-sm)" }}>
                        {new Date(profile.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell style={{ textAlign: "right", paddingRight: "var(--bw-space-6)" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--bw-space-1)" }}>
                          {profile.role === "evaluator" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => { setResetTarget(profile); setNewPassword(""); }}
                              title="Reset Password"
                            >
                              <KeyRound size={16} />
                            </Button>
                          )}
                          {profile.id !== currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleteId(profile.id)}
                              style={{ color: "var(--bw-negative)" }}
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)", color: "var(--bw-negative)", marginBottom: "var(--bw-space-2)" }}>
              <AlertTriangle size={24} />
              <DialogTitle>Delete Account</DialogTitle>
            </div>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-4)" }}>
            <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-primary)", lineHeight: "var(--bw-lh-base)" }}>
              Are you sure you want to delete <strong>{profiles.find(p => p.id === deleteId)?.full_name || "this user"}</strong>?
            </p>
            <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)", marginTop: "var(--bw-space-4)", padding: "var(--bw-space-3)", background: "var(--bw-negative-bg)", borderRadius: "var(--bw-radius-sm)", border: "1px solid rgba(225, 25, 0, 0.1)" }}>
              <strong>Warning:</strong> This action is permanent and cannot be undone. All evaluation data associated with this user will be removed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              onClick={handleDeleteUser}
              disabled={deleteLoading}
              style={{ background: "var(--bw-negative)", color: "white" }}
            >
              {deleteLoading && <Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />}
              {deleteLoading ? "Deleting..." : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open: boolean) => { if (!open) { setResetTarget(null); setNewPassword(""); } }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)", marginBottom: "var(--bw-space-2)" }}>
              <KeyRound size={24} style={{ color: "var(--bw-content-tertiary)" }} />
              <DialogTitle>Reset Password</DialogTitle>
            </div>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-4)", display: "flex", flexDirection: "column", gap: "var(--bw-space-3)" }}>
            <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-primary)", lineHeight: "var(--bw-lh-base)" }}>
              Set a new password for <strong>{resetTarget?.full_name || "this user"}</strong>. They can log in immediately with it. Their evaluation data is not affected.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label htmlFor="reset-password" style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>New Password</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                pill
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetTarget(null); setNewPassword(""); }}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetLoading}
            >
              {resetLoading && <Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />}
              {resetLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
