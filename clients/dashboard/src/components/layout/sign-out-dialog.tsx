import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { getMyProfileWithETag } from "@/api/identity";
import { useAuth } from "@/auth/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BRAND_NAME } from "@/lib/brand";

/** Sign-out confirmation, shared by the topbar user menu and the sidebar footer. */
export function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(["shell", "common"]);
  const { user, logout } = useAuth();
  // Same query key as the topbar/profile page, so this reads the shared cache.
  const { data: profile } = useQuery({
    queryKey: ["identity", "me"],
    queryFn: getMyProfileWithETag,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });
  const avatarUrl = profile?.profile.imageUrl ?? null;

  const onConfirm = () => {
    onOpenChange(false);
    logout();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("signOutTitle", { brand: BRAND_NAME })}</DialogTitle>
          <DialogDescription>{t("signOutDescription")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2.5">
            <Avatar name={user?.name ?? user?.email ?? "?"} src={avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium tracking-tight">
                {user?.name ?? user?.email ?? t("unknownUser")}
              </div>
              {user?.email && user.name && (
                <div className="truncate text-xs text-[var(--color-muted-foreground)]">
                  {user.email}
                </div>
              )}
            </div>
            <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[11px]">
              {user?.tenant ?? "—"}
            </code>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} autoFocus>
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            {t("signOut")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
