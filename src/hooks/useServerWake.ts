import { useEffect, useState } from "react";
import {
  getWakeDetail,
  startWakeKeepalive,
  subscribeWake,
  type WakeDetail,
} from "@/lib/wakeServer";

export function useServerWake(): WakeDetail {
  const [detail, setDetail] = useState<WakeDetail>(() => getWakeDetail());

  useEffect(() => {
    startWakeKeepalive();
    return subscribeWake((_s, next) => setDetail(next));
  }, []);

  return detail;
}
