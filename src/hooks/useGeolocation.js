/**
 * @file useGeolocation.js
 * @description React hook for opt-in geolocation-based Indian state detection.
 * Detection is user-triggered (no auto-detect on mount).
 */

import { useState, useCallback } from "react";
import {
  detectUserState,
  clearGeoCache,
  isGeolocationSupported,
} from "../lib/geolocation";
import { getStateByQid } from "../lib/indianStates";

/**
 * @typedef {'idle' | 'detecting' | 'detected' | 'denied' | 'unsupported' | 'error'} GeoStatus
 */

/**
 * Hook for managing geolocation-based state detection (opt-in).
 *
 * @returns {{
 *   state: {name: string, qid: string, languages: string[], bbox?: {north:number,south:number,east:number,west:number}} | null,
 *   status: GeoStatus,
 *   isSupported: boolean,
 *   setStateManually: (qid: string) => void,
 *   clearState: () => void,
 *   detect: () => Promise<void>,
 *   retry: () => Promise<void>,
 * }}
 */
export default function useGeolocation() {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("idle");
  const [isSupported] = useState(() => isGeolocationSupported());

  /**
   * Trigger geolocation detection explicitly (opt-in).
   */
  const detect = useCallback(async () => {
    if (!isGeolocationSupported()) {
      setStatus("unsupported");
      return;
    }

    setStatus("detecting");

    try {
      const detected = await detectUserState();

      if (detected) {
        setState(detected);
        setStatus("detected");
      } else {
        setState(null);
        setStatus("error");
      }
    } catch (err) {
      setState(null);

      // GeolocationPositionError code: 1 = PERMISSION_DENIED
      if (err && typeof err === "object" && "code" in err && err.code === 1) {
        setStatus("denied");
      } else {
        setStatus("error");
      }
    }
  }, []);

  /**
   * Override detected state with a manually selected one.
   * @param {string} qid
   */
  const setStateManually = useCallback((qid) => {
    const stateObj = getStateByQid(qid);
    if (!stateObj) return;

    setState(stateObj);
    setStatus("detected");
    clearGeoCache();
  }, []);

  /**
   * Clear current state and reset status.
   */
  const clearState = useCallback(() => {
    setState(null);
    setStatus("idle");
    clearGeoCache();
  }, []);

  /**
   * Retry detection from scratch (clears cached geo first).
   */
  const retry = useCallback(async () => {
    clearGeoCache();
    await detect();
  }, [detect]);

  return {
    state,
    status,
    isSupported,
    setStateManually,
    clearState,
    detect,
    retry,
  };
}
