"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AdminSettingsClient({ initialDeadline }: { initialDeadline: string }) {
  const [deadline, setDeadline] = useState(
    initialDeadline
      ? new Date(initialDeadline).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    
    // We update the DB
    // Note: If the setting doesn't exist, this will fail if we only use update. Upsert is better.
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: "evaluation_deadline", value: new Date(deadline).toISOString() });

    setSaving(false);

    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved successfully.");
      router.refresh();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-6)" }}>
      <div>
        <h2 style={{ fontFamily: "var(--bw-font-heading)", fontSize: "var(--bw-fs-h1-fluid)", fontWeight: "var(--bw-fw-bold)" as any, lineHeight: "var(--bw-lh-tight)" }}>System Settings</h2>
        <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-sm)", color: "var(--bw-content-secondary)" }}>
          Configure global platform parameters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle style={{ fontSize: "var(--bw-fs-h4)" }}>Evaluation Deadline</CardTitle>
        </CardHeader>
        <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--bw-space-4)", maxWidth: 400 }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--bw-fs-sm)", fontWeight: "var(--bw-fw-medium)" as any, marginBottom: "var(--bw-space-2)" }}>Deadline Date & Time</label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p style={{ marginTop: "var(--bw-space-2)", fontSize: "var(--bw-fs-xs)", color: "var(--bw-content-tertiary)" }}>
              This value will be displayed on the Evaluator dashboard to show the remaining time for the evaluation period.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> : <Save size={16} style={{ marginRight: 8 }} />}
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
