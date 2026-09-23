/** wmo weather codes, the ones open-meteo sends, turned into a label and a colored icon from
 * public/weather-icons (meteocons by bas milius, MIT, animations stripped so a full dashboard
 * doesnt move all the time and reduced motion users arent forced into it) */

type Weather = { label: string; icon: string };

// partly-cloudy-day-rain, partly-cloudy-night-rain...
const dayNight = (base: string, isDay: boolean, suffix = "") =>
  `/weather-icons/${base}-${isDay ? "day" : "night"}${suffix}.svg`;
const icon = (name: string) => `/weather-icons/${name}.svg`;

export function describeWeather(code: number, isDay = true): Weather {
  if (code <= 1) {
    return { label: code === 0 ? "Clear sky" : "Mainly clear", icon: dayNight("clear", isDay) };
  }
  if (code === 2) return { label: "Partly cloudy", icon: dayNight("partly-cloudy", isDay) };
  if (code === 3) return { label: "Overcast", icon: icon("overcast") };
  if (code === 45 || code === 48) return { label: "Fog", icon: icon("fog") };
  if (code >= 51 && code <= 55) return { label: "Drizzle", icon: icon("drizzle") };
  if (code === 56 || code === 57 || code === 66 || code === 67) {
    return { label: "Freezing rain", icon: icon("sleet") };
  }
  if (code >= 61 && code <= 65) return { label: "Rain", icon: icon("rain") };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: icon("snow") };
  if (code >= 80 && code <= 82) {
    return { label: "Rain showers", icon: dayNight("partly-cloudy", isDay, "-rain") };
  }
  if (code === 85 || code === 86) {
    return { label: "Snow showers", icon: dayNight("partly-cloudy", isDay, "-snow") };
  }
  if (code >= 95) return { label: "Thunderstorm", icon: icon("thunderstorms-rain") };
  return { label: "Unknown", icon: icon("overcast") };
}

export const tempUnit = (units: "metric" | "imperial") => (units === "imperial" ? "°F" : "°C");
export const windUnit = (units: "metric" | "imperial") => (units === "imperial" ? "mph" : "km/h");
export const rainUnit = (units: "metric" | "imperial") => (units === "imperial" ? "in" : "mm");
