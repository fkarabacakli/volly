import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_FACILITY_ID, getFacilities } from "@/api/industrial";

const FACILITY_PARAM = "facility";
const FACILITY_STORAGE_KEY = "fsh.dashboard.facility";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(FACILITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Active facility. The URL (`?facility=`) wins so a link is shareable;
 * otherwise the last choice (localStorage) carries across pages, since
 * sidebar links don't carry the query string.
 */
export function useFacility() {
  const [params, setParams] = useSearchParams();
  const { data: facilities = [] } = useQuery({
    queryKey: ["industrial", "facilities"],
    queryFn: getFacilities,
    staleTime: Infinity,
  });

  const requested = params.get(FACILITY_PARAM) ?? readStored() ?? DEFAULT_FACILITY_ID;
  const facilityId =
    facilities.length === 0 || facilities.some((f) => f.id === requested) ? requested : facilities[0].id;
  const facility = facilities.find((f) => f.id === facilityId) ?? null;

  const setFacilityId = useCallback(
    (id: string) => {
      try {
        window.localStorage.setItem(FACILITY_STORAGE_KEY, id);
      } catch {
        /* storage unavailable */
      }
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(FACILITY_PARAM, id);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { facilityId, facility, facilities, setFacilityId };
}
