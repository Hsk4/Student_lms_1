import { PageHeader, Card } from "@/components/ui/nila";
import { ThemePicker } from "@/components/shell/theme-picker";

/**
 * Console preferences. The theme control lives in the panel header too; this
 * page is where the choice is explained, and where other console-level options
 * will live as they are added.
 */
export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Console preferences for this browser."
      />

      <div className="grid max-w-3xl gap-6">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Appearance
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Light and dark use the same tokens, so every panel switches
            together.
          </p>
          <ThemePicker />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Session
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out from the account menu in the header. Role and status
            changes are made by an admin on the Users page.
          </p>
        </Card>
      </div>
    </>
  );
}
