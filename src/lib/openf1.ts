const API_ROOT = "https://api.openf1.org/v1";
const MIN_REQUEST_INTERVAL_MS = 450;
const MAX_RETRIES = 3;

export interface Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  circuit_short_name: string;
  country_name: string;
  location: string;
  year: number;
  date_start: string;
  date_end: string;
}

export interface Meeting {
  meeting_key: number;
  meeting_name: string;
}

export interface Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  country_code: string;
}

export interface Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}

export interface Weather {
  date: string;
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  wind_speed: number;
}

export interface DashboardData {
  session: Session | null;
  meeting: Meeting | null;
  drivers: Driver[];
  laps: Lap[];
  weather: Weather[];
}

class OpenF1HttpError extends Error {
  constructor(
    readonly status: number,
    statusText: string,
    readonly retryAfter: string | null,
  ) {
    super(`OpenF1 returned ${status} ${statusText}`);
    this.name = "OpenF1HttpError";
  }
}

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("The request was aborted.", "AbortError"));
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function waitForRequestSlot(signal: AbortSignal): Promise<void> {
  let releaseSlot!: () => void;
  const previousRequest = requestQueue;
  requestQueue = new Promise<void>((resolve) => {
    releaseSlot = resolve;
  });

  await previousRequest;
  try {
    const delay = Math.max(
      0,
      lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - Date.now(),
    );
    await wait(delay, signal);
    lastRequestStartedAt = Date.now();
  } finally {
    releaseSlot();
  }
}

function getRetryDelay(retryAfter: string | null, retry: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds)
      ? Date.now() + seconds * 1000
      : Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.max(0, retryAt - Date.now());
    }
  }
  return 1000 * 2 ** retry;
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  for (let retry = 0; ; retry += 1) {
    await waitForRequestSlot(signal);
    let response: Response;
    try {
      response = await fetch(`${API_ROOT}/${path}`, { signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      if (!(error instanceof TypeError) || retry >= MAX_RETRIES) {
        throw error;
      }
      await wait(1000 * 2 ** retry, signal);
      continue;
    }

    if (!response.ok) {
      const error = new OpenF1HttpError(
        response.status,
        response.statusText,
        response.headers.get("Retry-After"),
      );
      if (
        retry >= MAX_RETRIES ||
        (response.status !== 429 && response.status < 500)
      ) {
        throw error;
      }
      await wait(getRetryDelay(error.retryAfter, retry), signal);
      continue;
    }

    return (await response.json()) as T;
  }
}

export async function getDashboardData(signal: AbortSignal): Promise<DashboardData> {
  const sessions = await getJson<Session[]>("sessions?session_key=latest", signal);
  const session = sessions[0] ?? null;
  if (!session) {
    return { session: null, meeting: null, drivers: [], laps: [], weather: [] };
  }

  const sessionQuery = `session_key=${session.session_key}`;
  let meeting: Meeting | null = null;
  try {
    const meetings = await getJson<Meeting[]>(
      `meetings?meeting_key=${session.meeting_key}`,
      signal,
    );
    meeting = meetings[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    console.warn("Unable to load OpenF1 meeting details; using the session location.", error);
  }

  const drivers = await getJson<Driver[]>(`drivers?${sessionQuery}`, signal);
  const laps = await getJson<Lap[]>(`laps?${sessionQuery}`, signal);
  const weather = await getJson<Weather[]>(`weather?${sessionQuery}`, signal);

  return { session, meeting, drivers, laps, weather };
}

export function getBestLaps(laps: Lap[]): Map<number, Lap> {
  const best = new Map<number, Lap>();
  for (const lap of laps) {
    if (lap.is_pit_out_lap || lap.lap_duration == null || !Number.isFinite(lap.lap_duration)) {
      continue;
    }
    const current = best.get(lap.driver_number);
    if (!current || lap.lap_duration < (current.lap_duration ?? Infinity)) {
      best.set(lap.driver_number, lap);
    }
  }
  return best;
}
