import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleAlert, Server } from "lucide-react";
import { getSystemStatus } from "@/api/industrial";
import { CardState } from "@/components/industrial/indicators";
import { PanelCard } from "@/components/industrial/panel";
import { cn } from "@/lib/cn";

const STATUS_REFRESH_MS = 15_000;

export function SystemStatusCard({ facilityId }: { facilityId: string }) {
  const { t } = useTranslation(["overview", "common"]);
  const { data, isPending, isError } = useQuery({
    queryKey: ["industrial", "system-status", { facilityId }],
    queryFn: () => getSystemStatus(facilityId),
    refetchInterval: STATUS_REFRESH_MS,
  });

  return (
    <PanelCard title={t("systemStatus")} icon={Server}>
      {isPending ? (
        <CardState kind="loading" />
      ) : isError || !data ? (
        <CardState kind="error" />
      ) : (
        <dl className="grid grid-cols-3 gap-2">
          <Item label={t("iotDevices")} value={`${data.iotDevices.online}/${data.iotDevices.total}`} ok={data.iotDevices.online === data.iotDevices.total} />
          <Item label={t("cameras")} value={`${data.cameras.online}/${data.cameras.total}`} ok={data.cameras.online === data.cameras.total} />
          <Item
            label={t("mqtt")}
            value={data.mqtt === "active" ? t("common:status.active") : t("common:status.systemDegraded")}
            ok={data.mqtt === "active"}
          />
        </dl>
      )}
    </PanelCard>
  );
}

function Item({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const Icon = ok ? CircleCheck : CircleAlert;
  return (
    <div className="rounded-xl bg-[var(--color-muted)] px-2.5 py-2">
      <dt className="flex items-start gap-1 text-[10.5px] leading-tight text-[var(--color-muted-foreground)]">
        <Icon aria-hidden className={cn("size-3.5 shrink-0", ok ? "text-[var(--color-success)]" : "text-[var(--color-warning)]")} />
        <span>{label}</span>
      </dt>
      <dd className={cn("mt-0.5 text-[13px] font-semibold tabular-nums", ok ? "text-[var(--color-primary)]" : "text-[var(--color-warning)]")}>
        {value}
      </dd>
    </div>
  );
}
