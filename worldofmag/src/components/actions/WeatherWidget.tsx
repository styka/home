"use client"

import { useState } from "react"

const FORECASTS = [
  "🌤 Słonecznie z przerwami na egzystencjalny niepokój. Max 19°C.",
  "🌧 Deszcz, bo czemu nie. Weź parasolkę i zły humor.",
  "⛈ Burza geniuszu. Ryzyko przebłysków produktywności.",
  "🌈 Po burzy tęcza. Albo kolejna burza. Poczekaj i sprawdź.",
  "❄️ Śnieg w maju? W tym klimacie wszystko możliwe.",
  "🌫 Mgła. Idealna na rozmyślanie o sensie życia.",
  "🌪 Trąba powietrzna entuzjazmu. Przelotna, ale intensywna.",
  "☀️ Słońce przez cały dzień. Podejrzanie dobrze jak na Polskę.",
  "🌥 Zachmurzenie umiarkowane, nastrój — też.",
  "🌩 Piorun natchnienia. Zapisz zanim minie.",
]

export function WeatherWidget() {
  const [forecast, setForecast] = useState(() => FORECASTS[Math.floor(Math.random() * FORECASTS.length)])

  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 16px",
        fontSize: 13,
        color: "var(--text-primary)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => setForecast(FORECASTS[Math.floor(Math.random() * FORECASTS.length)])}
      title="Kliknij aby odświeżyć prognozę"
    >
      {forecast}
    </div>
  )
}
