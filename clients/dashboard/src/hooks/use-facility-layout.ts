import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCameraAlerts, getFacilityLayout } from "@/api/industrial";

/** Movers (forklifts, personnel) update on this cadence. */
const LAYOUT_REFRESH_MS = 5_000;
const ALERT_REFRESH_MS = 30_000;

/** Plan + devices + alerts for the map. Shared by Overview and Live Monitoring. */
export function useFacilityLayout(facilityId: string) {
  const layout = useQuery({
    queryKey: ["industrial", "layout", { facilityId }],
    queryFn: () => getFacilityLayout(facilityId),
    refetchInterval: LAYOUT_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
  // Same key as the alerts card so both read one cache entry.
  const alerts = useQuery({
    queryKey: ["industrial", "alerts", { facilityId }],
    queryFn: () => getCameraAlerts(facilityId),
    refetchInterval: ALERT_REFRESH_MS,
  });
  return { layout, alerts };
}
