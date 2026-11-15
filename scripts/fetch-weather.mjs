// Hourly: fetch the 7-day Open-Meteo forecast for Guntersville into data/weather.json.
import { normalizeOpenMeteo, weatherLooksBroken } from '../js/lib/weather.js';
import { writeDataSafely } from './lib/write-data.mjs';

const URL = 'https://api.open-meteo.com/v1/forecast?latitude=34.40&longitude=-86.27&hourly=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America/Chicago&forecast_days=7';

let data = { hours: [], days: [] };
let error;
try {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  data = normalizeOpenMeteo(await res.json());
  if (weatherLooksBroken(data)) error = 'Open-Meteo returned no usable hours (missing temperature/wind)';
} catch (e) {
  error = `Open-Meteo: ${e.message}`;
}
const r = writeDataSafely('data/weather.json', { source: 'Open-Meteo', ...data }, { isEmpty: weatherLooksBroken, error });
console.log(r.written ? `weather.json: ${data.hours.length} hours` : `weather.json kept: ${r.reason}`);
