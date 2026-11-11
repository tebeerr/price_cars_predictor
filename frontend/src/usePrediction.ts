import { useEffect, useRef, useState } from "react";
import { ApiError, predict, type CarInput, type PredictionResponse } from "./api";

type State = {
  data: PredictionResponse | null;
  loading: boolean;
  error: ApiError | null;
};

/**
 * Re-predicts whenever the car changes, debounced so dragging a slider
 * sends one request when the hand stops, not fifty. The previous result
 * stays on screen (dimmed) while the next one is in flight.
 */
export function usePrediction(car: CarInput | null, delay = 220) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const [nonce, setNonce] = useState(0);
  const key = car ? JSON.stringify(car) : null;
  const carRef = useRef(car);
  carRef.current = car;

  useEffect(() => {
    if (!key || !carRef.current) return;
    const controller = new AbortController();
    const target = carRef.current;
    setState((s) => ({ ...s, loading: true }));
    const timer = window.setTimeout(() => {
      predict(target, controller.signal)
        .then((data) => setState({ data, loading: false, error: null }))
        .catch((err: unknown) => {
          if ((err as Error).name === "AbortError") return;
          const error = err instanceof ApiError ? err : new ApiError(String(err), 0);
          setState((s) => ({ ...s, loading: false, error }));
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, delay, nonce]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}
