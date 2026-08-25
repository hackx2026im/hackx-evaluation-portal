"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileText, Video, Type, Package, FileSpreadsheet, Download, Loader2 } from "lucide-react";
import Papa from "papaparse";

export default function UploadProposalsPage() {
  const [teamName, setTeamName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [proposalUrl, setProposalUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName || !proposalUrl || !videoUrl) {
      toast.error("Team Name, Proposal PDF Link, and Pitch Video Link are required");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("proposals").insert({
      team_name: teamName,
      product_name: productName || "Untitled Product",
      description,
      proposal_url: proposalUrl,
      video_url: videoUrl,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Proposal uploaded successfully!");
    setTeamName("");
    setProductName("");
    setDescription("");
    setProposalUrl("");
    setVideoUrl("");
    router.refresh();
    setLoading(false);
  };

  const downloadTemplate = () => {
    const templateContent = "team_name,product_name,description,drive_link,yt_link\nExample Team,SmartLearn AI,An AI-powered learning system,https://drive.google.com/file/...,https://youtube.com/watch?...";
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "hackX_proposals_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        
        if (rows.length === 0) {
          toast.error("The CSV file is empty");
          setBulkLoading(false);
          return;
        }

        // Get headers from the first row to check for case-insensitive matches
        const headers = Object.keys(rows[0]);
        const findHeader = (target: string) => headers.find(h => h.toLowerCase() === target.toLowerCase());

        const teamNameHeader = findHeader("team_name");
        const driveLinkHeader = findHeader("drive_link");
        const ytLinkHeader = findHeader("yt_link");
        const productNameHeader = findHeader("product_name");
        const descriptionHeader = findHeader("description");

        if (!teamNameHeader || !driveLinkHeader || !ytLinkHeader) {
          const missing = [];
          if (!teamNameHeader) missing.push("'team_name'");
          if (!driveLinkHeader) missing.push("'drive_link'");
          if (!ytLinkHeader) missing.push("'yt_link'");
          toast.error(`Invalid CSV format. Missing required columns: ${missing.join(", ")}`);
          setBulkLoading(false);
          return;
        }

        const proposalsToInsert = [];
        const errors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 1;
          const teamName = row[teamNameHeader as string]?.trim();
          const driveLink = row[driveLinkHeader as string]?.trim();
          const ytLink = row[ytLinkHeader as string]?.trim();

          const missingFields = [];
          if (!teamName) missingFields.push("team_name");
          if (!driveLink) missingFields.push("drive_link");
          if (!ytLink) missingFields.push("yt_link");

          if (missingFields.length > 0) {
            errors.push(`Row ${rowNum}: Missing ${missingFields.join(", ")}`);
            continue;
          }

          proposalsToInsert.push({
            team_name: teamName,
            product_name: row[productNameHeader as string]?.trim() || "Untitled Product",
            description: row[descriptionHeader as string]?.trim() || "",
            proposal_url: driveLink,
            video_url: ytLink,
          });
        }

        if (errors.length > 0) {
          const errorMsg = errors.slice(0, 3).join("\n") + (errors.length > 3 ? `\n...and ${errors.length - 3} more errors` : "");
          toast.error(`Validation Failed:\n${errorMsg}`, { duration: 5000 });
          setBulkLoading(false);
          return;
        }

        const { error } = await supabase.from("proposals").insert(proposalsToInsert);

        if (error) {
          toast.error(error.message);
        } else {
          toast.success(`Successfully uploaded ${proposalsToInsert.length} proposals!`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          router.refresh();
        }
        
        setBulkLoading(false);
      },
      error: (error) => {
        toast.error(`CSV Parsing error: ${error.message}`);
        setBulkLoading(false);
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)", maxWidth: 1024, margin: "0 auto" }}>
      <div>
        <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)", color: "var(--bw-content-primary)" }}>Upload Proposals</h2>
        <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
          Add team proposals for the evaluation portal via single entry or bulk CSV.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        
        <Card variant="flat">
          <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)", borderBottom: "1px solid var(--bw-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
              <Upload size={18} style={{ color: "var(--bw-content-tertiary)" }} />
              <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Single Upload</CardTitle>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "var(--bw-space-6)" }}>
            <form onSubmit={handleSingleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <Label htmlFor="proposal-team-name">Team Name</Label>
                <div style={{ position: "relative" }}>
                  <Type size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)", pointerEvents: "none" }} />
                  <Input
                    id="proposal-team-name"
                    placeholder="Team Innovators"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    style={{ paddingLeft: 36 }}
                    pill
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <Label htmlFor="proposal-product-name">Product Name</Label>
                <div style={{ position: "relative" }}>
                  <Package size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)", pointerEvents: "none" }} />
                  <Input
                    id="proposal-product-name"
                    placeholder="SmartLearn AI"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    style={{ paddingLeft: 36 }}
                    pill
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <Label htmlFor="proposal-description">Description</Label>
                <Textarea
                  id="proposal-description"
                  placeholder="A brief description of the team's proposal..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <Label htmlFor="proposal-pdf-url">Proposal PDF Link</Label>
                <div style={{ position: "relative" }}>
                  <FileText size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)", pointerEvents: "none" }} />
                  <Input
                    id="proposal-pdf-url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={proposalUrl}
                    onChange={(e) => setProposalUrl(e.target.value)}
                    type="url"
                    required
                    style={{ paddingLeft: 36 }}
                    pill
                  />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
                <Label htmlFor="proposal-video-url">Pitch Video Link</Label>
                <div style={{ position: "relative" }}>
                  <Video size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--bw-content-disabled)", pointerEvents: "none" }} />
                  <Input
                    id="proposal-video-url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    type="url"
                    required
                    style={{ paddingLeft: 36 }}
                    pill
                  />
                </div>
              </div>
              <Button
                id="proposal-submit"
                type="submit"
                disabled={loading}
                style={{ marginTop: "var(--bw-space-2)", width: "100%" }}
              >
                {loading && <Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />}
                {loading ? "Uploading..." : "Upload Proposal"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card variant="flat" style={{ alignSelf: "start" }}>
          <CardHeader style={{ padding: "var(--bw-space-6) var(--bw-space-6) var(--bw-space-4)", borderBottom: "1px solid var(--bw-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--bw-space-3)" }}>
              <FileSpreadsheet size={18} style={{ color: "var(--bw-content-tertiary)" }} />
              <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Bulk CSV Upload</CardTitle>
            </div>
          </CardHeader>
          <CardContent style={{ padding: "var(--bw-space-6)", display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
            
            <div style={{ borderRadius: "var(--bw-radius-md)", border: "1px solid var(--bw-border)", background: "var(--bw-chip)", padding: "var(--bw-space-4)" }}>
              <h3 style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)", marginBottom: "var(--bw-space-2)" }}>Instructions</h3>
              <ul style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)", paddingLeft: "var(--bw-space-4)", marginBottom: "var(--bw-space-4)", display: "flex", flexDirection: "column", gap: "var(--bw-space-1)", listStyleType: "disc" }}>
                <li>Download the template below.</li>
                <li>Fill in the rows without modifying the header row.</li>
                <li>Mandatory fields: <span style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)" }}>team_name</span>, <span style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)" }}>drive_link</span>, and <span style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)" }}>yt_link</span>.</li>
                <li><span style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)" }}>product_name</span> and <span style={{ fontWeight: "var(--bw-fw-medium)" as any, color: "var(--bw-content-primary)" }}>description</span> are optional.</li>
                <li>Save as a .csv file and upload.</li>
              </ul>
              <Button 
                variant="secondary" 
                style={{ width: "100%" }}
                onClick={downloadTemplate}
              >
                <Download size={16} style={{ marginRight: 8 }} /> Download Demo Template
              </Button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-2)" }}>
              <Label>Select CSV File</Label>
              <Input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleBulkUpload}
                disabled={bulkLoading}
                style={{ cursor: "pointer" }}
                pill
              />
              {bulkLoading && <p style={{ fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-disabled)", marginTop: "var(--bw-space-2)", display: "flex", alignItems: "center", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}><Loader2 size={16} style={{ marginRight: 8, animation: "spin 1s linear infinite" }} />Processing and uploading data...</p>}
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  );
}
