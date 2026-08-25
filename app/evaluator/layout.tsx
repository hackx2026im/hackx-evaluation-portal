import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evaluator Dashboard | hackX 11.0",
  description: "Evaluate hackX 11.0 proposals",
};

export default async function EvaluatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Navbar fullName={profile.full_name} role={profile.role} />
      <main
        style={{
          flex: 1,
          padding: "var(--bw-space-6) var(--bw-space-4)",
          background: "var(--bw-bg-secondary)",
          overflowX: "clip",   /* clip (not hidden) preserves sticky children */
          minWidth: 0,
        }}
        className="sm:px-6 md:px-8"
      >
        {/* No container here: the evaluate route is a full-width document
            workspace and sets its own width. Dashboard pages opt in. */}
        {children}
      </main>
    </div>
  );
}
