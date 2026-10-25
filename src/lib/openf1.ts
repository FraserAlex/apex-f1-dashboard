const API_ROOT = "https://api.openf1.org/v1";

export interface Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  meeting_name: string;
  circuit_short_name: string;
  country_name: string;
  location: string;
  year: number;
  date_start: string;
  date_end: string;
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
  drivers: Driver[];
  laps: Lap[];
  weather: Weather[];
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_ROOT}/${path}`, { signal });
  if (!response.ok) {
    throw new Error(`OpenF1 returned ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function getDashboardData(signal: AbortSignal): Promise<DashboardData> {
  const sessions = await getJson<Session[]>("sessions?session_key=latest", signal);
  const session = sessions[0] ?? null;
  if (!session) {
    return { session: null, drivers: [], laps: [], weather: [] };
  }

  const sessionQuery = `session_key=${session.session_key}`;
  const [drivers, laps, weather] = await Promise.all([
    getJson<Driver[]>(`drivers?${sessionQuery}`, signal),
    getJson<Lap[]>(`laps?${sessionQuery}`, signal),
    getJson<Weather[]>(`weather?${sessionQuery}`, signal),
  ]);

  return { session, drivers, laps, weather };
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
