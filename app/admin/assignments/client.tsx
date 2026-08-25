"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, X, Plus } from "lucide-react";
import type { Proposal, Profile, ProposalAssignment } from "@/lib/types/database";

interface Props {
  proposals: Proposal[];
  evaluators: Pick<Profile, "id" | "full_name" | "role">[];
  assignments: ProposalAssignment[];
}

export function AssignmentsClient({ proposals, evaluators, assignments }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEvaluatorId, setBulkEvaluatorId] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Reassign / Multi-assign dialog state
  const [assignProposal, setAssignProposal] = useState<Proposal | null>(null);
  const [assignEvaluatorId, setAssignEvaluatorId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  // Remove confirmation state
  const [removeConfirm, setRemoveConfirm] = useState<{ proposalId: string, evaluatorId: string } | null>(null);

  const evaluatorMap = useMemo(() => {
    return new Map(evaluators.map((e) => [e.id, e.full_name]));
  }, [evaluators]);

  const filteredProposals = useMemo(() => {
    if (!searchQuery) return proposals;
    const q = searchQuery.toLowerCase();
    return proposals.filter(
      (p) =>
        p.team_name.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q)
    );
  }, [proposals, searchQuery]);

  // Map proposal to its assigned evaluators
  const assigneesByProposal = useMemo(() => {
    const map: Record<string, string[]> = {};
    assignments.forEach(a => {
      if (!map[a.proposal_id]) map[a.proposal_id] = [];
      map[a.proposal_id].push(a.evaluator_id);
    });
    return map;
  }, [assignments]);

  // Map evaluator workload (number of proposals assigned)
  const evaluatorWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    evaluators.forEach(e => counts[e.id] = 0);
    assignments.forEach(a => {
      if (counts[a.evaluator_id] !== undefined) {
        counts[a.evaluator_id]++;
      }
    });
    return counts;
  }, [evaluators, assignments]);

  // Stats
  const assignedCount = proposals.filter((p) => (assigneesByProposal[p.id]?.length || 0) > 0).length;
  const unassignedCount = proposals.length - assignedCount;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredProposals.length > 0 && filteredProposals.every(p => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProposals.forEach(p => next.delete(p.id));
      } else {
        filteredProposals.forEach(p => next.add(p.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssign = async () => {
    if (!bulkEvaluatorId) {
      toast.error("Please select an evaluator to assign to.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("No proposals selected.");
      return;
    }
    setBulkLoading(true);
    
    // Use the currently visible filtered proposals that are selected
    // to avoid accidentally assigning proposals that were selected but then filtered out
    const activeSelectedIds = Array.from(selectedIds).filter(id => 
      proposals.some(p => p.id === id)
    );

    if (activeSelectedIds.length === 0) {
      toast.error("No valid proposals selected.");
      setBulkLoading(false);
      return;
    }
    
    const assignmentsToInsert = activeSelectedIds.map(id => ({
      proposal_id: id,
      evaluator_id: bulkEvaluatorId
    }));

    const { error } = await supabase
      .from("proposal_assignments")
      .upsert(assignmentsToInsert);

    if (error) {
      toast.error(error.message);
    } else {
      const evaluatorName = evaluatorMap.get(bulkEvaluatorId);
      toast.success(
        `${activeSelectedIds.length} proposal(s) assigned to ${evaluatorName ?? "evaluator"}.`
      );
      setSelectedIds(new Set());
      setBulkEvaluatorId("");
      router.refresh();
    }
    setBulkLoading(false);
  };

  const handleUnassignAll = async (proposalIds: string[]) => {
    const { error } = await supabase
      .from("proposal_assignments")
      .delete()
      .in("proposal_id", proposalIds);
      
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${proposalIds.length} proposal(s) completely unassigned.`);
      setSelectedIds(new Set());
      router.refresh();
    }
  };

  const confirmRemoveAssignee = (proposalId: string, evaluatorId: string) => {
    setRemoveConfirm({ proposalId, evaluatorId });
  };

  const handleRemoveAssignee = async () => {
    if (!removeConfirm) return;
    const { proposalId, evaluatorId } = removeConfirm;
    
    const { error } = await supabase
      .from("proposal_assignments")
      .delete()
      .eq("proposal_id", proposalId)
      .eq("evaluator_id", evaluatorId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Assignee removed.");
      setRemoveConfirm(null);
      router.refresh();
    }
  };

  const handleAddAssignee = async () => {
    if (!assignProposal) return;
    if (!assignEvaluatorId) {
      toast.error("Please select an evaluator.");
      return;
    }
    setAssignLoading(true);
    
    const { error } = await supabase
      .from("proposal_assignments")
      .upsert([{ proposal_id: assignProposal.id, evaluator_id: assignEvaluatorId }], { onConflict: 'proposal_id,evaluator_id' });

    if (error) {
      toast.error(error.message);
    } else {
      const evaluatorName = evaluatorMap.get(assignEvaluatorId);
      toast.success(`${evaluatorName ?? "Evaluator"} assigned to proposal.`);
      setAssignProposal(null);
      setAssignEvaluatorId("");
      router.refresh();
    }
    setAssignLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)", color: "var(--bw-content-primary)" }}>Assign Proposals</h2>
        <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
          Assign proposals to evaluators. You can assign multiple evaluators to the same proposal.
        </p>
      </div>


      {/* Main Table */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--bw-space-4)" }}>
            <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>All Proposals</CardTitle>
            <div style={{ position: "relative", width: "100%", maxWidth: 260 }}>
              <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)" }} />
              <Input
                type="search"
                placeholder="Search team or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
                pill
              />
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ paddingTop: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                      checked={
                        filteredProposals.length > 0 &&
                        filteredProposals.every(p => selectedIds.has(p.id))
                      }
                      onChange={toggleSelectAll}
                      aria-label="Select all proposals"
                    />
                  </TableHead>
                  <TableHead>Team &amp; Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} style={{ height: 96, textAlign: "center", color: "var(--bw-content-disabled)" }}>
                      No proposals found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProposals.map((proposal) => {
                    const assigneeIds = assigneesByProposal[proposal.id] || [];
                    const isAssigned = assigneeIds.length > 0;
                    
                    return (
                      <TableRow
                        key={proposal.id}
                        style={{ backgroundColor: selectedIds.has(proposal.id) ? "var(--bw-hover-light)" : "transparent" }}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                            checked={selectedIds.has(proposal.id)}
                            onChange={() => toggleSelect(proposal.id)}
                            aria-label={`Select ${proposal.team_name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div style={{ fontWeight: "var(--bw-fw-medium)" as any }}>{proposal.team_name}</div>
                          <div style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>
                            {proposal.product_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={proposal.is_graded ? "default" : "secondary"}>
                            {proposal.is_graded ? "Graded" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {isAssigned ? (
                              assigneeIds.map(id => {
                                const eName = evaluatorMap.get(id);
                                return (
                                  <Badge key={id} variant="secondary" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                    {eName || 'Unknown'}
                                    <button onClick={() => confirmRemoveAssignee(proposal.id, id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--bw-content-tertiary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                      <X size={12} />
                                    </button>
                                  </Badge>
                                );
                              })
                            ) : (
                              <span style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-disabled)", fontStyle: "italic" }}>
                                Unassigned
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "var(--bw-space-2)" }}>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setAssignProposal(proposal);
                                setAssignEvaluatorId("");
                              }}
                            >
                              <Plus size={14} style={{ marginRight: 4 }} />
                              Add Assignee
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div style={{
          position: "fixed",
          bottom: "var(--bw-space-6)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: "var(--bw-space-3)",
          borderRadius: "var(--bw-radius-pill)",
          border: "1px solid var(--bw-border)",
          background: "var(--bw-bg-primary)",
          boxShadow: "var(--bw-shadow-200)",
          padding: "var(--bw-space-2) var(--bw-space-4)",
          animation: "bw-slide-in-left var(--bw-duration-normal) var(--bw-easing) reverse" // Note: reverse slide-in-left isn't great here, but keeping it simple
        }}>
          <span style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any, whiteSpace: "nowrap" }}>
            {selectedIds.size} selected
          </span>
          <div style={{ width: 1, height: 16, background: "var(--bw-border)" }} />
          <select
            style={{
              height: 32,
              borderRadius: "var(--bw-radius-pill)",
              border: "1px solid var(--bw-border)",
              background: "var(--bw-bg-primary)",
              color: "var(--bw-content-primary)",
              padding: "0 var(--bw-space-3)",
              fontSize: "var(--bw-fs-sm)",
              outline: "none",
            }}
            value={bulkEvaluatorId}
            onChange={(e) => setBulkEvaluatorId(e.target.value)}
            aria-label="Select evaluator"
          >
            <option value="">Select evaluator...</option>
            {evaluators.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({evaluatorWorkload[e.id] || 0} assigned)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleBulkAssign}
            disabled={bulkLoading || !bulkEvaluatorId}
          >
            {bulkLoading && <Loader2 size={14} style={{ marginRight: 6, animation: "spin 1s linear infinite" }} />}
            Add Assignee
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleUnassignAll(Array.from(selectedIds))}
          >
            Clear Assignments
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={clearSelection}>
            <X size={14} />
          </Button>
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog
        open={!!assignProposal}
        onOpenChange={(open) => {
          if (!open) {
            setAssignProposal(null);
            setAssignEvaluatorId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontSize: "var(--bw-fs-h4)" }}>
              Add Assignee to Proposal
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-4)", display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
            <div>
              <p style={{ fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any }}>{assignProposal?.team_name}</p>
              <p style={{ fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-secondary)" }}>
                {assignProposal?.product_name}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label>Select Evaluator</Label>
              <select
                style={{
                  height: 40,
                  borderRadius: "var(--bw-radius-md)",
                  border: "1px solid var(--bw-border)",
                  background: "var(--bw-bg-primary)",
                  color: "var(--bw-content-primary)",
                  padding: "0 var(--bw-space-3)",
                  fontSize: "var(--bw-fs-sm)",
                  outline: "none",
                  width: "100%",
                }}
                value={assignEvaluatorId}
                onChange={(e) => setAssignEvaluatorId(e.target.value)}
              >
                <option value="">Select an evaluator...</option>
                {evaluators.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} ({evaluatorWorkload[e.id] || 0} assigned)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignProposal(null)}>Cancel</Button>
            <Button onClick={handleAddAssignee} disabled={assignLoading || !assignEvaluatorId}>
              {assignLoading && <Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />}
              Assign Evaluator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={!!removeConfirm} onOpenChange={(open) => !open && setRemoveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Assignment</DialogTitle>
          </DialogHeader>
          <div style={{ padding: "0 var(--bw-space-6) var(--bw-space-4)" }}>
            <p style={{ fontSize: "var(--bw-fs-sm)" }}>
              Are you sure you want to remove <strong>{removeConfirm ? evaluatorMap.get(removeConfirm.evaluatorId) : ""}</strong> from this proposal?
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveConfirm(null)}>Cancel</Button>
            <Button 
              onClick={handleRemoveAssignee}
              style={{ background: "var(--bw-negative)", color: "white" }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
