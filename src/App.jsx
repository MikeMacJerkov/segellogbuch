import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY = "segellogbuch_v4";
const loadData = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {
      toerns: [],
      profil: null, // null = noch nicht eingerichtet
    };
  } catch { return { toerns: [], profil: null }; }
};

// ─── VBS Punkteberechnung ─────────────────────────────────────────────────────
function berechneVBSPunkte(t) {
  let p = 0;
  const km = Number(t.streckeKm) || 0;
  p += t.bootTyp === "optimist" ? km * 2 : km * 1;
  p += (Number(t.kmGegenStrom) || 0) * 2;
  p += (Number(t.motorKm) || 0) * 0.2;
  p += (Number(t.mastLegen) || 0) * 2;
  p += (Number(t.schleusen) || 0) * 4;
  if (km > 200) {
    p += 20;
    p += Math.floor((km - 200) / 100) * 10;
  }
  p += (Number(t.gemeinschaftTage) || 0) * 20;
  if (t.trailer) p += 50;
  if (t.training) {
    let tH = 0;
    if (t.abfahrt && t.ankunft) {
      const [ah, am] = t.abfahrt.split(":").map(Number);
      const [zh, zm] = t.ankunft.split(":").map(Number);
      let mins = (zh * 60 + zm) - (ah * 60 + am);
      if (mins < 0) mins += 24 * 60;
      tH = mins / 60;
    } else {
      tH = Number(t.trainingStunden) || 0;
    }
    if (tH >= 2) p += 25;
  }
  return Math.round(p * 10) / 10;
}

function punkteAufschluesselung(t) {
  const lines = [];
  const km = Number(t.streckeKm) || 0;
  const sp = t.bootTyp === "optimist" ? km * 2 : km;
  if (sp > 0) lines.push({ label: `Segeln (${km} km × ${t.bootTyp === "optimist" ? 2 : 1})`, val: sp });
  const se = (Number(t.kmGegenStrom) || 0) * 2;
  if (se > 0) lines.push({ label: `Gegen Strom (+2 × ${t.kmGegenStrom} km)`, val: se });
  const mp = (Number(t.motorKm) || 0) * 0.2;
  if (mp > 0) lines.push({ label: `Motor (${t.motorKm} km × 0,2)`, val: mp });
  const mas = (Number(t.mastLegen) || 0) * 2;
  if (mas > 0) lines.push({ label: `Mastlegen (${t.mastLegen} × 2)`, val: mas });
  const sch = (Number(t.schleusen) || 0) * 4;
  if (sch > 0) lines.push({ label: `Schleusen (${t.schleusen} × 4)`, val: sch });
  if (km > 200) {
    lines.push({ label: "Langtörn >200 km Bonus", val: 20 });
    const ex = Math.floor((km - 200) / 100);
    if (ex > 0) lines.push({ label: `+${ex} × 100 km Langtörn`, val: ex * 10 });
  }
  const gp = (Number(t.gemeinschaftTage) || 0) * 20;
  if (gp > 0) lines.push({ label: `Gemeinschaftsfahrt (${t.gemeinschaftTage} Tage × 20)`, val: gp });
  if (t.trailer) lines.push({ label: "Trailertransport", val: 50 });
  if (t.training) {
    let tH = 0;
    if (t.abfahrt && t.ankunft) {
      const [ah, am] = t.abfahrt.split(":").map(Number);
      const [zh, zm] = t.ankunft.split(":").map(Number);
      let mins = (zh * 60 + zm) - (ah * 60 + am);
      if (mins < 0) mins += 24 * 60;
      tH = Math.round(mins / 6) / 10;
    } else {
      tH = Number(t.trainingStunden) || 0;
    }
    if (tH >= 2) lines.push({ label: `Training veranstaltet (${tH.toFixed(1)}h)`, val: 25 });
  }
  return lines;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const BEAUFORT = Array.from({ length: 13 }, (_, i) => i.toString());
const BFT_LBL  = ["Windstille","Leiser Zug","Leichte Brise","Schwache Brise","Mäßige Brise","Frische Brise","Starker Wind","Steifer Wind","Stürmisch","Sturm","Schwerer Sturm","Orkanartig","Orkan"];
const WINDDIR  = ["N","NNO","NO","ONO","O","OSO","SO","SSO","S","SSW","SW","WSW","W","WNW","NW","NNW"];

// Seegang mit Meterhöhen
const SEEGANG = [
  "0 – Spiegelglatt (0 m)",
  "1 – Kräuselwellen (0–0,1 m)",
  "2 – Kleine Wellen (0,1–0,5 m)",
  "3 – Leichte See (0,5–1,25 m)",
  "4 – Mäßige See (1,25–2,5 m)",
  "5 – Grobe See (2,5–4 m)",
  "6 – Sehr grobe See (4–6 m)",
  "7 – Hohe See (6–9 m)",
  "8 – Sehr hohe See (9–14 m)",
  "9 – Außergewöhnliche See (>14 m)",
];
const WETTER  = ["☀️ Klar","🌤️ Heiter","⛅ Bewölkt","☁️ Bedeckt","🌧️ Regen","⛈️ Gewitter","🌫️ Nebel","🌨️ Schnee"];
const REVIER  = ["Binnensee","Fließgewässer","Seerevier"];

const bftColor = (n) => {
  const i = Number(n);
  if (i <= 2) return "#34d399";
  if (i <= 4) return "#60a5fa";
  if (i <= 6) return "#fbbf24";
  if (i <= 8) return "#fb923c";
  return "#f87171";
};

// Wind direction → degrees (for compass rose)
const dirDeg = (dir) => WINDDIR.indexOf(dir) * (360 / WINDDIR.length);

const emptyForm = (profil) => ({
  datum: new Date().toISOString().split("T")[0],
  abfahrt: "", ankunft: "",
  route: "",
  revier: "Binnensee",
  streckeKm: "",
  windstaerke: "3", windrichtung: "W",
  seegang: "2 – Kleine Wellen (0,1–0,5 m)", wetter: "☀️ Klar",
  motorKm: "",
  kmGegenStrom: "", mastLegen: "", schleusen: "", gemeinschaftTage: "",
  trailer: false,
  training: false, trainingStunden: "",
  // Boot-Auswahl: "0","1","2" = Profilboot-Index, "einmalig" = Freitext
  bootAuswahl: profil?.boote?.length ? "0" : "einmalig",
  bootTyp: profil?.boote?.[0]?.isOptimist ? "optimist" : "standard",
  einmaligesSchiff: "",
  notizen: "",
});

const emptyBoot = () => ({ name: "", segelnummer: "", klasse: "", isOptimist: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtNum  = (n, d = 0) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: d });
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" }) : "–";
const getMon  = (s) => new Date(s).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });

function buildChartData(toerns) {
  const map = {};
  [...toerns].reverse().forEach(t => {
    const m = getMon(t.datum);
    if (!map[m]) map[m] = { month: m, punkte: 0, km: 0 };
    map[m].punkte += t.punkte || 0;
    map[m].km     += Number(t.streckeKm) || 0;
  });
  return Object.values(map).slice(-7);
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg: "#05101f", deep: "#071828", surf: "#0b2035", card: "#0d2540",
  border: "#153654", acc: "#0ea5e9", accD: "#0c3460",
  teal: "#2dd4bf", amber: "#fbbf24", green: "#34d399",
  red: "#f87171", purple: "#a78bfa", text: "#dbeafe",
  sub: "#4d7fa8", muted: "#112235",
};

const inpS  = (err) => ({ width: "100%", boxSizing: "border-box", background: P.deep, border: `1.5px solid ${err ? P.red : P.border}`, color: P.text, borderRadius: 10, padding: "10px 13px", fontFamily: "inherit", fontSize: 14, outline: "none", WebkitAppearance: "none" });
const cardS = { background: P.card, borderRadius: 18, padding: 18, border: `1px solid ${P.border}` };
const secL  = (col) => ({ fontSize: 10, fontWeight: 700, color: col || P.sub, textTransform: "uppercase", letterSpacing: "1.2px", margin: "0 0 13px", fontFamily: "'DM Mono',monospace" });
const fldL  = (col) => ({ display: "block", fontSize: 10, fontWeight: 700, color: col || P.sub, letterSpacing: "0.9px", textTransform: "uppercase", marginBottom: 5, fontFamily: "'DM Mono',monospace" });
const btnS  = (col, outline) => outline
  ? { background: "transparent", border: `1.5px solid ${col || P.border}`, color: col || P.sub, padding: "9px 14px", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }
  : { background: col || P.acc, border: "none", color: "white", padding: "13px 20px", borderRadius: 12, fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" };
const tabS  = (a) => ({ flex: 1, background: a ? P.acc : "transparent", border: "none", color: a ? "white" : P.sub, padding: "9px 4px", borderRadius: 10, fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" });

// ─── Micro Components ─────────────────────────────────────────────────────────
function Fld({ label, err, children, col, hint }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={fldL(col)}>{label}</label>
      {children}
      {hint && !err && <p style={{ color: P.sub, fontSize: 10, marginTop: 3, fontStyle: "italic" }}>{hint}</p>}
      {err && <p style={{ color: P.red, fontSize: 10, marginTop: 3 }}>{err}</p>}
    </div>
  );
}

function Chip({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color || P.acc) + "28" : P.deep,
      border: `1.5px solid ${active ? (color || P.acc) : P.border}`,
      color: active ? (color || P.acc) : P.sub,
      padding: "6px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", transition: "all 0.15s",
    }}>{label}</button>
  );
}

function NumStepper({ value, onChange, min = 0 }) {
  const v = Number(value) || 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button onClick={() => onChange(Math.max(min, v - 1))} style={{ ...btnS(P.muted, true), padding: "8px 14px", fontSize: 16 }}>−</button>
      <input type="number" style={{ ...inpS(), textAlign: "center", fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 16 }} value={value} onChange={e => onChange(e.target.value)} inputMode="numeric" />
      <button onClick={() => onChange(v + 1)} style={{ ...btnS(P.acc, true), padding: "8px 14px", fontSize: 16 }}>+</button>
    </div>
  );
}

function KPI({ icon, label, value, sub, color }) {
  return (
    <div style={{ ...cardS, textAlign: "center", padding: "14px 6px" }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || P.acc, lineHeight: 1.1, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.5px", marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: color || P.acc, opacity: 0.75, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 9, color: P.sub, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ToggleSwitch({ value, onChange, labelOn, labelOff }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      background: value ? P.accD : P.deep,
      border: `1.5px solid ${value ? P.acc : P.border}`,
      borderRadius: 10, padding: "10px 14px", transition: "all 0.2s",
    }}>
      <div style={{ width: 40, height: 22, borderRadius: 11, background: value ? P.acc : P.muted, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: value ? 19 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: value ? P.acc : P.sub }}>
        {value ? labelOn : labelOff}
      </span>
    </div>
  );
}

// ─── Compass Rose ─────────────────────────────────────────────────────────────
function CompassRose({ direction, size = 80 }) {
  const deg = dirDeg(direction);
  const c   = size / 2;
  const r   = size / 2 - 4;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle cx={c} cy={c} r={r} fill="none" stroke={P.border} strokeWidth="1.5" />
        <circle cx={c} cy={c} r={r - 6} fill={P.deep} />
        {/* Cardinal ticks */}
        {[0, 90, 180, 270].map(d => {
          const rad = (d - 90) * Math.PI / 180;
          return <line key={d} x1={c + (r - 10) * Math.cos(rad)} y1={c + (r - 10) * Math.sin(rad)} x2={c + (r - 2) * Math.cos(rad)} y2={c + (r - 2) * Math.sin(rad)} stroke={P.sub} strokeWidth="2" />;
        })}
        {/* Cardinal labels */}
        {[["N", 0], ["O", 90], ["S", 180], ["W", 270]].map(([lbl, d]) => {
          const rad = (d - 90) * Math.PI / 180;
          return (
            <text key={lbl} x={c + (r - 18) * Math.cos(rad)} y={c + (r - 18) * Math.sin(rad) + 4}
              textAnchor="middle" fill={P.sub} fontSize="9" fontFamily="DM Mono" fontWeight="700">{lbl}</text>
          );
        })}
        {/* Wind arrow – points FROM where wind comes */}
        {(() => {
          const rad = (deg - 90) * Math.PI / 180;
          const tipX = c + (r - 12) * Math.cos(rad);
          const tipY = c + (r - 12) * Math.sin(rad);
          const tailX = c - (r - 20) * Math.cos(rad);
          const tailY = c - (r - 20) * Math.sin(rad);
          // arrowhead perp
          const perpRad = rad + Math.PI / 2;
          const hw = 5;
          return (
            <g>
              <line x1={tailX} y1={tailY} x2={tipX} y2={tipY} stroke={P.acc} strokeWidth="2.5" strokeLinecap="round" />
              <polygon
                points={`${tipX},${tipY} ${tipX - hw * 1.5 * Math.cos(rad) + hw * Math.cos(perpRad)},${tipY - hw * 1.5 * Math.sin(rad) + hw * Math.sin(perpRad)} ${tipX - hw * 1.5 * Math.cos(rad) - hw * Math.cos(perpRad)},${tipY - hw * 1.5 * Math.sin(rad) - hw * Math.sin(perpRad)}`}
                fill={P.acc}
              />
            </g>
          );
        })()}
        {/* Center dot */}
        <circle cx={c} cy={c} r={3} fill={P.acc} />
      </svg>
      <div style={{ fontSize: 13, fontWeight: 800, color: P.acc, fontFamily: "'DM Mono',monospace", letterSpacing: "1px" }}>{direction}</div>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: P.surf, border: `1px solid ${P.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: P.text, fontFamily: "'DM Mono',monospace" }}>
      <p style={{ margin: 0, fontWeight: 700, color: P.acc }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ margin: "3px 0 0", color: p.color }}>{p.name === "punkte" ? fmtNum(p.value, 0) + " Pkt" : fmtNum(p.value, 0) + " km"}</p>)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0); // 0=Verein/Email, 1=Boot1, 2=Boot2, 3=Boot3
  const [verein, setVerein]   = useState("");
  const [email, setEmail]     = useState("");
  const [boote, setBoote]     = useState([emptyBoot()]);
  const [err, setErr]         = useState("");

  const updBoot = (i, k, v) => setBoote(prev => {
    const next = [...prev];
    while (next.length <= i) next.push(emptyBoot());
    next[i] = { ...next[i], [k]: v };
    return next;
  });

  const nextStep = () => {
    if (step === 0) {
      if (!verein.trim()) { setErr("Bitte Vereinsname eingeben"); return; }
      setErr("");
      setBoote(prev => {
        const next = [...prev];
        while (next.length < 3) next.push(emptyBoot());
        return next;
      });
      setStep(1);
    } else {
      setErr(""); setStep(s => s + 1);
    }
  };

  const finish = () => {
    const filledBoote = boote.filter(b => b.name.trim() || b.segelnummer.trim() || b.klasse.trim());
    onDone({ verein: verein.trim(), email: email.trim(), boote: filledBoote });
  };

  const addBoot = () => { if (boote.length < 3) setBoote(p => [...p, emptyBoot()]); };

  const bootStep = step - 1; // which boot we are editing (0,1,2)

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.text, fontFamily: "'Crimson Pro',Georgia,serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? P.acc : P.muted, transition: "all 0.3s" }} />
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {step === 0 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>⛵</div>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.3px" }}>Willkommen im Segellogbuch</h1>
              <p style={{ color: P.sub, fontSize: 15, margin: 0, fontStyle: "italic" }}>Richte dein Profil ein – dauert nur eine Minute</p>
            </div>

            <div style={{ ...cardS, marginBottom: 12 }}>
              <p style={secL(P.acc)}>🏛️ Dein Verein</p>
              <Fld label="Vereinsname *" err={err}>
                <input type="text" placeholder="z.B. Segelclub Brandenburg e.V." style={inpS(!!err)} value={verein} onChange={e => { setVerein(e.target.value); setErr(""); }} />
              </Fld>
            </div>

            <div style={{ ...cardS, marginBottom: 24 }}>
              <p style={secL(P.teal)}>📧 E-Mail (optional)</p>
              <Fld label="E-Mail-Adresse" hint="Wird ausschließlich für den Versand deines Logbuchs am Saisonende verwendet.">
                <input type="email" placeholder="deine@email.de" style={inpS()} value={email} onChange={e => setEmail(e.target.value)} />
              </Fld>
            </div>

            <button onClick={nextStep} style={btnS()}>Weiter → Boote einrichten</button>
          </div>
        )}

        {step >= 1 && step <= 3 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>
                Boot {step} von 3
              </h2>
              <p style={{ color: P.sub, fontSize: 14, margin: 0, fontStyle: "italic" }}>
                {step === 1 ? "Trage dein erstes Boot ein" : "Möchtest du ein weiteres Boot hinzufügen?"}
              </p>
            </div>

            <div style={{ ...cardS, marginBottom: 12 }}>
              <p style={secL(P.amber)}>⛵ Boot {step}</p>
              <Fld label="Bootsname">
                <input type="text" placeholder="z.B. Stella Maris" style={inpS()} value={boote[bootStep]?.name || ""} onChange={e => updBoot(bootStep, "name", e.target.value)} />
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="Segelnummer">
                  <input type="text" placeholder="z.B. GER 1234" style={inpS()} value={boote[bootStep]?.segelnummer || ""} onChange={e => updBoot(bootStep, "segelnummer", e.target.value)} />
                </Fld>
                <Fld label="Bootsklasse">
                  <input type="text" placeholder="z.B. Bavaria 37" style={inpS()} value={boote[bootStep]?.klasse || ""} onChange={e => updBoot(bootStep, "klasse", e.target.value)} />
                </Fld>
              </div>
              <Fld label="Bootstyp">
                <ToggleSwitch
                  value={boote[bootStep]?.isOptimist || false}
                  onChange={v => updBoot(bootStep, "isOptimist", v)}
                  labelOn="Optimist (2 Pkt/km)"
                  labelOff="Standard (1 Pkt/km)"
                />
              </Fld>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {step < 3 ? (
                <>
                  <button onClick={nextStep} style={{ ...btnS(P.acc), flex: 2 }}>
                    {step === 1 ? "Weiteres Boot hinzufügen" : "Noch ein Boot hinzufügen"}
                  </button>
                  <button onClick={finish} style={{ ...btnS(P.muted), flex: 1, fontSize: 13 }}>Fertig</button>
                </>
              ) : (
                <button onClick={finish} style={btnS(P.green)}>✓ Profil speichern</button>
              )}
            </div>
            {step > 1 && <button onClick={finish} style={{ ...btnS(P.muted), marginTop: 8, fontSize: 13 }}>Überspringen & fertig</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFIL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ProfilTab({ profil, onSave }) {
  const [p, setP] = useState({ ...profil, boote: profil.boote ? [...profil.boote.map(b => ({ ...b }))] : [] });
  const [saved, setSaved] = useState(false);

  const updBoot = (i, k, v) => setP(prev => ({ ...prev, boote: prev.boote.map((b, idx) => idx === i ? { ...b, [k]: v } : b) }));
  const addBoot = () => { if (p.boote.length < 3) setP(prev => ({ ...prev, boote: [...prev.boote, emptyBoot()] })); };
  const delBoot = (i) => setP(prev => ({ ...prev, boote: prev.boote.filter((_, idx) => idx !== i) }));

  const save = () => {
    onSave(p);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 21, fontWeight: 700 }}>Mein Profil</h2>

      <div style={{ ...cardS, marginBottom: 11 }}>
        <p style={secL(P.acc)}>🏛️ Verein</p>
        <Fld label="Vereinsname">
          <input type="text" style={inpS()} value={p.verein} onChange={e => setP(prev => ({ ...prev, verein: e.target.value }))} />
        </Fld>
        <Fld label="E-Mail" hint="Wird nur für den Logbuch-Versand am Saisonende verwendet.">
          <input type="email" style={inpS()} value={p.email || ""} onChange={e => setP(prev => ({ ...prev, email: e.target.value }))} />
        </Fld>
      </div>

      <div style={{ ...cardS, marginBottom: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
          <p style={{ ...secL(P.amber), margin: 0 }}>⛵ Meine Boote</p>
          {p.boote.length < 3 && (
            <button onClick={addBoot} style={{ ...btnS(P.acc, true), fontSize: 11, padding: "6px 12px" }}>+ Boot</button>
          )}
        </div>
        {p.boote.map((b, i) => (
          <div key={i} style={{ background: P.deep, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.amber, fontFamily: "'DM Mono',monospace" }}>BOOT {i + 1}</span>
              <button onClick={() => delBoot(i)} style={{ ...btnS(P.red, true), fontSize: 11, padding: "4px 10px" }}>✕</button>
            </div>
            <Fld label="Bootsname">
              <input type="text" style={inpS()} value={b.name} onChange={e => updBoot(i, "name", e.target.value)} />
            </Fld>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Fld label="Segelnummer">
                <input type="text" style={inpS()} value={b.segelnummer} onChange={e => updBoot(i, "segelnummer", e.target.value)} />
              </Fld>
              <Fld label="Bootsklasse">
                <input type="text" style={inpS()} value={b.klasse} onChange={e => updBoot(i, "klasse", e.target.value)} />
              </Fld>
            </div>
            <ToggleSwitch value={b.isOptimist} onChange={v => updBoot(i, "isOptimist", v)} labelOn="Optimist (2 Pkt/km)" labelOff="Standard (1 Pkt/km)" />
          </div>
        ))}
        {p.boote.length === 0 && (
          <p style={{ color: P.sub, fontStyle: "italic", fontSize: 13, textAlign: "center" }}>Noch kein Boot eingetragen.</p>
        )}
      </div>

      <button onClick={save} style={btnS(saved ? P.green : P.acc)}>
        {saved ? "✓ Gespeichert!" : "💾 Profil speichern"}
      </button>
    </div>
  );
}


// ─── Export Helpers ───────────────────────────────────────────────────────────
function getSaisonZeitraum() {
  const now = new Date();
  const year = now.getFullYear();
  // Saison: 1.11 Vorjahr bis 31.10 aktuelles Jahr
  // Aber NICHT der 1.11 des aktuellen Jahres
  // → von 1.11.(year-1) bis heute, sofern heute vor dem 1.11.year
  const saisonStart = new Date(year - 1, 10, 1); // 1. Nov Vorjahr
  // If today is on or after 1.11 of current year, new season started
  const thisNov1 = new Date(year, 10, 1);
  const effectiveStart = now >= thisNov1 ? thisNov1 : saisonStart;
  return { start: effectiveStart, end: now };
}

function filterSaisonToerns(toerns) {
  const { start, end } = getSaisonZeitraum();
  return toerns
    .filter(t => {
      const d = new Date(t.datum);
      return d >= start && d <= end;
    })
    .sort((a, b) => (b.punkte || 0) - (a.punkte || 0))
    .slice(0, 50);
}

function buildCSV(toerns, profil) {
  const { start, end } = getSaisonZeitraum();
  const fmt = (d) => new Date(d).toLocaleDateString("de-DE");
  const lines = [
    `Segellogbuch Export`,
    `Verein: ${profil.verein}`,
    `Saison: ${fmt(start)} – ${fmt(end)}`,
    `Exportiert am: ${fmt(new Date())}`,
    ``,
    `Nr;Datum;Abfahrt;Ankunft;Route;Strecke (km);Motor (km);Windstaerke (Bft);Windrichtung;Seegang;Wetter;Schleusen;Mastlegen;Gemeinschaftstage;Trailer;Training;Punkte;Notizen`,
  ];
  toerns.forEach((t, i) => {
    const row = [
      i + 1,
      fmt(t.datum),
      t.abfahrt || "",
      t.ankunft || "",
      (t.route || "").replace(/;/g, ","),
      t.streckeKm || 0,
      t.motorKm || 0,
      t.windstaerke,
      t.windrichtung,
      (t.seegang || "").replace(/;/g, ","),
      (t.wetter || "").replace(/;/g, ","),
      t.schleusen || 0,
      t.mastLegen || 0,
      t.gemeinschaftTage || 0,
      t.trailer ? "Ja" : "Nein",
      t.training ? "Ja" : "Nein",
      (t.punkte || 0).toFixed(1),
      (t.notizen || "").replace(/;/g, ",").replace(/\n/g, " "),
    ];
    lines.push(row.join(";"));
  });
  lines.push(``);
  lines.push(`Gesamt Punkte;${toerns.reduce((s, t) => s + (t.punkte || 0), 0).toFixed(1)}`);
  return lines.join("\n");
}

function downloadCSV(content, filename) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData]     = useState(loadData);
  const [tab, setTab]       = useState("dashboard");
  const [form, setForm]     = useState(null); // init after profil known
  const [errs, setErrs]     = useState({});
  const [editId, setEditId] = useState(null);
  const [flash, setFlash]   = useState(false);
  const [delId, setDelId]   = useState(null);
  const [expId, setExpId]   = useState(null);
  const [exportFlash, setExportFlash] = useState(false);

  const profil = data.profil;
  const toerns = data.toerns;

  // Init form once profil is known
  useEffect(() => {
    if (profil && !form) setForm(emptyForm(profil));
  }, [profil]);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); }, [data]);

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setT = (fn) => setData(p => ({ ...p, toerns: fn(p.toerns) }));

  const handleOnboardingDone = (p) => {
    setData(prev => ({ ...prev, profil: p }));
    setForm(emptyForm(p));
  };

  const handleProfilSave = (p) => setData(prev => ({ ...prev, profil: p }));

  // Determine bootTyp from selection
  const resolvedBootTyp = () => {
    if (!form) return "standard";
    if (form.bootAuswahl === "einmalig") return form.bootTyp;
    const idx = Number(form.bootAuswahl);
    return profil?.boote?.[idx]?.isOptimist ? "optimist" : "standard";
  };

  const formForPunkte = form ? { ...form, bootTyp: resolvedBootTyp() } : {};
  const livePunkte = form ? berechneVBSPunkte(formForPunkte) : 0;

  const validate = () => {
    const e = {};
    if (!form?.datum)        e.datum = "Pflichtfeld";
    if (!form?.route?.trim()) e.route = "Pflichtfeld";
    return e;
  };

  const submit = () => {
    const e = validate(); setErrs(e);
    if (Object.keys(e).length) return;
    const bt = resolvedBootTyp();
    const entry = {
      ...form,
      bootTyp: bt,
      punkte: berechneVBSPunkte({ ...form, bootTyp: bt }),
      id: editId || Date.now().toString(),
    };
    setT(prev => editId ? prev.map(t => t.id === editId ? entry : t) : [entry, ...prev]);
    setForm(emptyForm(profil)); setEditId(null);
    setFlash(true); setTimeout(() => { setFlash(false); setTab("list"); }, 1200);
  };

  const doEdit = (t) => { setForm({ ...t }); setEditId(t.id); setErrs({}); setTab("form"); window.scrollTo(0, 0); };
  const doDel  = (id) => { setT(p => p.filter(t => t.id !== id)); setDelId(null); };

  const totalPunkte = toerns.reduce((s, t) => s + (t.punkte || 0), 0);
  const totalKm     = toerns.reduce((s, t) => s + (Number(t.streckeKm) || 0), 0);
  const totalMotKm  = toerns.reduce((s, t) => s + (Number(t.motorKm) || 0), 0);
  const avgPunkte   = toerns.length ? totalPunkte / toerns.length : 0;
  const chartData   = buildChartData(toerns);

  // Show onboarding if no profil yet
  if (!profil) return <Onboarding onDone={handleOnboardingDone} />;
  if (!form)   return null;

  return (
    <div style={{ background: P.bg, minHeight: "100vh", color: P.text, fontFamily: "'Crimson Pro',Georgia,serif", maxWidth: 480, margin: "0 auto", paddingBottom: 84 }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box} input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.4)} select option{background:#0b2035} textarea{resize:vertical} button{font-family:inherit}`}</style>

      {/* ─── HEADER ─── */}
      <header style={{ padding: "16px 18px 14px", background: `linear-gradient(180deg,${P.deep} 0%,${P.bg} 100%)`, borderBottom: `1px solid ${P.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>⛵</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px", lineHeight: 1.1 }}>Segellogbuch</div>
            <div style={{ fontSize: 11, color: P.sub, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
              {profil.verein} · {toerns.length} Törns · {fmtNum(totalPunkte, 0)} Pkt
            </div>
          </div>
        </div>
      </header>

      <div style={{ padding: "16px 16px 0" }}>

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && (
          <div>
            {/* Punkte Banner */}
            <div style={{ ...cardS, marginBottom: 12, background: `linear-gradient(135deg,${P.accD},${P.card})`, borderColor: P.acc }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ ...secL(P.acc), marginBottom: 4 }}>🏆 Gesamtpunkte</p>
                  <div style={{ fontSize: 42, fontWeight: 800, color: P.amber, fontFamily: "'DM Mono',monospace", letterSpacing: "-1px", lineHeight: 1 }}>
                    {fmtNum(totalPunkte, 1)}
                  </div>
                  <div style={{ fontSize: 11, color: P.sub, marginTop: 4, fontFamily: "'DM Mono',monospace" }}>
                    Ø {fmtNum(avgPunkte, 1)} Pkt/Törn
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: P.sub, fontStyle: "italic", maxWidth: 140 }}>
                  Bronze: 4× 1000 Pkt<br />Silber: 8× 1000 Pkt<br />Gold: 12× 1000 Pkt
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <KPI icon="🧭" label="Gesamt km" value={fmtNum(totalKm)} color={P.acc} />
              <KPI icon="⚙️" label="Motor km" value={fmtNum(totalMotKm)} color={P.amber} />
              <KPI icon="📊" label="Ø Pkt/Törn" value={fmtNum(avgPunkte, 1)} color={P.teal} />
            </div>

            {toerns.length === 0 ? (
              <div style={{ ...cardS, textAlign: "center", padding: "52px 24px" }}>
                <div style={{ fontSize: 52 }}>🌊</div>
                <p style={{ color: P.sub, marginTop: 14, fontSize: 16, fontStyle: "italic" }}>Noch keine Törns eingetragen.<br />Leinen los!</p>
                <button onClick={() => setTab("form")} style={{ ...btnS(), marginTop: 18, width: "auto", padding: "11px 30px" }}>Ersten Törn eintragen</button>
              </div>
            ) : (
              <>
                <div style={{ ...cardS, marginBottom: 12 }}>
                  <p style={secL()}>Punkte pro Monat</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={chartData} barSize={22}>
                      <CartesianGrid vertical={false} stroke={P.border} />
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: P.sub, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: P.sub, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(14,165,233,0.05)" }} />
                      <Bar dataKey="punkte" name="punkte" fill={P.amber} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ ...cardS }}>
                  <p style={secL()}>Letzte Törns</p>
                  {toerns.slice(0, 5).map((t, i) => (
                    <div key={t.id} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${P.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, paddingRight: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.route || `${t.starthafen || ""}→${t.zielhafen || ""}`}</div>
                        <div style={{ fontSize: 11, color: P.sub, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "'DM Mono',monospace" }}>
                          <span>{fmtDate(t.datum)}</span>
                          {t.streckeKm > 0 && <span>{fmtNum(t.streckeKm)} km</span>}
                          <span style={{ color: bftColor(t.windstaerke) }}>Bft {t.windstaerke}</span>
                          <span>{t.wetter}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: P.amber, fontFamily: "'DM Mono',monospace" }}>{fmtNum(t.punkte, 1)} Pkt</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ FORM ══ */}
        {tab === "form" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{editId ? "Törn bearbeiten" : "Neuer Törn"}</h2>
              {editId && <button style={btnS(P.sub, true)} onClick={() => { setForm(emptyForm(profil)); setEditId(null); setErrs({}); }}>✕ Abbrechen</button>}
            </div>

            {/* Live Punkte Vorschau */}
            {livePunkte > 0 && (
              <div style={{ ...cardS, marginBottom: 12, background: `linear-gradient(135deg,${P.accD},${P.card})`, borderColor: P.amber, textAlign: "center", padding: 14 }}>
                <div style={{ fontSize: 10, color: P.sub, fontFamily: "'DM Mono',monospace", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>Vorschau Punkte</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: P.amber, fontFamily: "'DM Mono',monospace", letterSpacing: "-1px" }}>{fmtNum(livePunkte, 1)}</div>
              </div>
            )}

            {/* Datum & Zeit */}
            <div style={{ ...cardS, marginBottom: 11 }}>
              <p style={secL(P.acc)}>📅 Datum & Zeit</p>
              <Fld label="Datum *" err={errs.datum}>
                <input type="date" style={inpS(errs.datum)} value={form.datum} onChange={e => upd("datum", e.target.value)} />
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="Abfahrt"><input type="time" style={inpS()} value={form.abfahrt} onChange={e => upd("abfahrt", e.target.value)} /></Fld>
                <Fld label="Ankunft"><input type="time" style={inpS()} value={form.ankunft} onChange={e => upd("ankunft", e.target.value)} /></Fld>
              </div>
            </div>

            {/* Boot-Auswahl */}
            <div style={{ ...cardS, marginBottom: 11 }}>
              <p style={secL(P.amber)}>⛵ Boot</p>
              <Fld label="Welches Boot?">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {profil.boote?.map((b, i) => (
                    <div key={i} onClick={() => upd("bootAuswahl", String(i))} style={{
                      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                      background: form.bootAuswahl === String(i) ? P.accD : P.deep,
                      border: `1.5px solid ${form.bootAuswahl === String(i) ? P.acc : P.border}`,
                      borderRadius: 10, padding: "10px 14px", transition: "all 0.15s",
                    }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${form.bootAuswahl === String(i) ? P.acc : P.sub}`, background: form.bootAuswahl === String(i) ? P.acc : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: form.bootAuswahl === String(i) ? P.text : P.sub }}>
                          {b.name || `Boot ${i + 1}`}
                          {b.segelnummer ? ` · ${b.segelnummer}` : ""}
                        </div>
                        <div style={{ fontSize: 11, color: P.sub, fontFamily: "'DM Mono',monospace" }}>
                          {b.klasse}{b.isOptimist ? " · Optimist (2 Pkt/km)" : " · Standard (1 Pkt/km)"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Einmaliges Schiff */}
                  <div onClick={() => upd("bootAuswahl", "einmalig")} style={{
                    display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                    background: form.bootAuswahl === "einmalig" ? P.accD : P.deep,
                    border: `1.5px solid ${form.bootAuswahl === "einmalig" ? P.acc : P.border}`,
                    borderRadius: 10, padding: "10px 14px", transition: "all 0.15s",
                  }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${form.bootAuswahl === "einmalig" ? P.acc : P.sub}`, background: form.bootAuswahl === "einmalig" ? P.acc : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: form.bootAuswahl === "einmalig" ? P.text : P.sub }}>Einmaliges / anderes Schiff</div>
                  </div>
                </div>
              </Fld>

              {form.bootAuswahl === "einmalig" && (
                <>
                  <Fld label="Schiffsname / Beschreibung">
                    <input type="text" placeholder="z.B. Vereinsboot Albatros, GER 999" style={inpS()} value={form.einmaligesSchiff} onChange={e => upd("einmaligesSchiff", e.target.value)} />
                  </Fld>
                  <Fld label="Bootstyp">
                    <div style={{ display: "flex", gap: 6 }}>
                      <Chip label="Standard (1 Pkt/km)" active={form.bootTyp === "standard"} onClick={() => upd("bootTyp", "standard")} />
                      <Chip label="Optimist (2 Pkt/km)" active={form.bootTyp === "optimist"} color={P.teal} onClick={() => upd("bootTyp", "optimist")} />
                    </div>
                  </Fld>
                </>
              )}
            </div>

            {/* Route */}
            <div style={{ ...cardS, marginBottom: 11 }}>
              <p style={secL(P.teal)}>⚓ Route & Strecke</p>
              <Fld label="Route *" err={errs.route} hint='z.B. "Wannsee → Brandenburg an der Havel"'>
                <input type="text" placeholder="Starthafen → Zielhafen" style={inpS(errs.route)} value={form.route} onChange={e => upd("route", e.target.value)} />
              </Fld>
              <Fld label="Revier">
                <div style={{ display: "flex", gap: 6 }}>
                  {REVIER.map(r => <Chip key={r} label={r} active={form.revier === r} onClick={() => upd("revier", r)} />)}
                </div>
              </Fld>
              <Fld label="Gesegelte Strecke (km)">
                <input type="number" placeholder="z.B. 25" inputMode="decimal" style={inpS()} value={form.streckeKm} onChange={e => upd("streckeKm", e.target.value)} />
              </Fld>
            </div>

            {/* Wind & Wetter */}
            <div style={{ ...cardS, marginBottom: 11 }}>
              <p style={secL(P.purple)}>🌬️ Wind & Wetter</p>

              <Fld label="Windstärke (Beaufort)">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {BEAUFORT.map(b => (
                    <button key={b} onClick={() => upd("windstaerke", b)} style={{
                      background: form.windstaerke === b ? bftColor(b) + "30" : P.deep,
                      border: `1.5px solid ${form.windstaerke === b ? bftColor(b) : P.border}`,
                      color: form.windstaerke === b ? bftColor(b) : P.sub,
                      padding: "5px 9px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "'DM Mono',monospace", minWidth: 30, textAlign: "center", transition: "all 0.15s",
                    }}>{b}</button>
                  ))}
                </div>
                {form.windstaerke !== "" && (
                  <p style={{ fontSize: 11, color: bftColor(form.windstaerke), marginTop: 5, fontStyle: "italic" }}>
                    Bft {form.windstaerke} – {BFT_LBL[Number(form.windstaerke)]}
                  </p>
                )}
              </Fld>

              {/* Windrichtung + Kompassrose nebeneinander */}
              <Fld label="Windrichtung">
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {WINDDIR.map(d => (
                        <button key={d} onClick={() => upd("windrichtung", d)} style={{
                          background: form.windrichtung === d ? P.accD : P.deep,
                          border: `1.5px solid ${form.windrichtung === d ? P.acc : P.border}`,
                          color: form.windrichtung === d ? P.acc : P.sub,
                          padding: "5px 8px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                          cursor: "pointer", fontFamily: "'DM Mono',monospace", transition: "all 0.15s",
                        }}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <CompassRose direction={form.windrichtung} size={84} />
                </div>
              </Fld>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="Seegang (Douglas)">
                  <select style={{ ...inpS(), fontSize: 12 }} value={form.seegang} onChange={e => upd("seegang", e.target.value)}>
                    {SEEGANG.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Fld>
                <Fld label="Wetter">
                  <select style={{ ...inpS(), fontSize: 13 }} value={form.wetter} onChange={e => upd("wetter", e.target.value)}>
                    {WETTER.map(w => <option key={w}>{w}</option>)}
                  </select>
                </Fld>
              </div>
            </div>

            {/* Sonderpunkte */}
            <div style={{ ...cardS, marginBottom: 11, borderColor: P.amber + "60" }}>
              <p style={secL(P.amber)}>⭐ Sonderpunkte</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Fld label="Motor-km (×0,2 Pkt)" hint="km unter Motor">
                  <input type="number" placeholder="0" inputMode="decimal" style={inpS()} value={form.motorKm} onChange={e => upd("motorKm", e.target.value)} />
                </Fld>
                <Fld label="Gegen Strom (×3 Pkt)" hint="mind. 5 km/h">
                  <input type="number" placeholder="0" inputMode="decimal" style={inpS()} value={form.kmGegenStrom} onChange={e => upd("kmGegenStrom", e.target.value)} />
                </Fld>
              </div>
              <Fld label="Schleusen (je 4 Punkte)">
                <NumStepper value={form.schleusen} onChange={v => upd("schleusen", v)} />
              </Fld>
              <Fld label="Mastlegen bei Brücken (je 2 Punkte)">
                <NumStepper value={form.mastLegen} onChange={v => upd("mastLegen", v)} />
              </Fld>
              <Fld label="Gemeinschaftsfahrt-Tage (je 20 Punkte)" hint="mind. 5 Boote, ausgeschrieben">
                <NumStepper value={form.gemeinschaftTage} onChange={v => upd("gemeinschaftTage", v)} />
              </Fld>
              <Fld label="Trailertransport (+50 Punkte)" hint="mind. 150 km vom Heimathafen">
                <ToggleSwitch value={form.trailer} onChange={v => upd("trailer", v)} labelOn="Ja – 50 Punkte extra" labelOff="Nein" />
              </Fld>
              <Fld label="Training veranstaltet (+25 Punkte)" hint="Ehrenamtliches Kinder-/Jugendtraining, mind. 2 Stunden">
                <ToggleSwitch value={form.training} onChange={v => upd("training", v)} labelOn="Ja – Training veranstaltet" labelOff="Nein" />
              </Fld>
              {form.training && (() => {
                const calcTrainingH = () => {
                  if (!form.abfahrt || !form.ankunft) return null;
                  const [ah, am] = form.abfahrt.split(":").map(Number);
                  const [zh, zm] = form.ankunft.split(":").map(Number);
                  let mins = (zh * 60 + zm) - (ah * 60 + am);
                  if (mins < 0) mins += 24 * 60; // overnight
                  return Math.round(mins / 6) / 10; // round to 1 decimal
                };
                const autoH = calcTrainingH();
                const displayH = autoH !== null ? autoH : (form.trainingStunden !== "" ? Number(form.trainingStunden) : null);
                const qualifies = displayH !== null && displayH >= 2;
                return (
                  <Fld label="Trainingsdauer" col={qualifies ? P.green : P.amber}>
                    {autoH !== null ? (
                      <div style={{ ...inpS(), borderColor: qualifies ? P.green : P.amber, background: qualifies ? P.green + "15" : P.amber + "15", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 16, color: qualifies ? P.green : P.amber }}>{autoH.toFixed(1)} h</span>
                        <span style={{ fontSize: 11, color: P.sub }}>automatisch aus Abfahrt & Ankunft</span>
                      </div>
                    ) : (
                      <div style={{ ...inpS(), borderColor: P.amber, background: P.amber + "10", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: P.amber, fontStyle: "italic" }}>⚠️ Bitte Abfahrt & Ankunft eintragen</span>
                      </div>
                    )}
                    {displayH !== null && !qualifies && (
                      <p style={{ color: P.amber, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>⚠️ {displayH.toFixed(1)}h – Mindestdauer 2h, noch keine Punkte</p>
                    )}
                    {qualifies && (
                      <p style={{ color: P.green, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>✓ {displayH.toFixed(1)}h – 25 Punkte werden vergeben</p>
                    )}
                  </Fld>
                );
              })()}
            </div>

            {/* Notizen */}
            <div style={{ ...cardS, marginBottom: 18 }}>
              <p style={secL()}>📝 Notizen</p>
              <Fld label="Logbucheintrag">
                <textarea rows={3} placeholder="z.B. Herrlicher Raumschotskurs, Delphine gesichtet..." style={{ ...inpS(), lineHeight: 1.55, fontFamily: "inherit", fontSize: 14 }} value={form.notizen} onChange={e => upd("notizen", e.target.value)} />
              </Fld>
            </div>

            <button onClick={submit} style={{ ...btnS(flash ? P.green : P.acc), marginBottom: 10 }}>
              {flash ? `✓  ${fmtNum(livePunkte, 1)} Punkte gespeichert!` : editId ? "💾  Änderungen speichern" : `⚓  Törn eintragen (${fmtNum(livePunkte, 1)} Pkt)`}
            </button>
            {!editId && (
              <button onClick={() => { setForm(emptyForm(profil)); setErrs({}); }} style={{ ...btnS(P.muted), fontSize: 13 }}>
                Zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* ══ LIST ══ */}
        {tab === "list" && (
          <div>
            {(() => {
              const saisonToerns = filterSaisonToerns(toerns);
              const { start, end } = getSaisonZeitraum();
              const fmt = (d) => new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });

              const handleExport = () => {
                const csv = buildCSV(saisonToerns, profil);
                const now = new Date();
                const fname = `Segellogbuch_${profil.verein.replace(/\s+/g,"_")}_${now.getFullYear()}.csv`;
                downloadCSV(csv, fname);

                if (profil.email) {
                  const subject = encodeURIComponent(`Segellogbuch ${profil.verein} – Saison ${now.getFullYear()}`);
                  const body = encodeURIComponent(
                    `Hallo,\n\nanbei mein Segellogbuch für die Saison ${fmt(start)} bis ${fmt(end)}.\n\nDie CSV-Datei wurde auf deinem Gerät gespeichert.\n\nTop-Ergebnisse (${saisonToerns.length} Törns, ${saisonToerns.reduce((s,t)=>s+(t.punkte||0),0).toFixed(1)} Punkte gesamt)\n\nMit segelfrischen Grüßen`
                  );
                  window.open(`mailto:${profil.email}?subject=${subject}&body=${body}`, "_self");
                }
                setExportFlash(true);
                setTimeout(() => setExportFlash(false), 2500);
              };

              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Logbuch</h2>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: P.amber, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmtNum(totalPunkte, 0)} Pkt</span>
                      <button style={btnS(P.acc, true)} onClick={() => setTab("form")}>⚓ Neu</button>
                    </div>
                  </div>

                  {/* Export Card */}
                  <div style={{ ...cardS, marginBottom: 14, borderColor: P.teal + "60", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: P.teal }}>📤 Saisonauswertung exportieren</div>
                        <div style={{ fontSize: 11, color: P.sub, marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                          Top {saisonToerns.length} Törns · {fmt(start)} – {fmt(end)}
                        </div>
                        {profil.email && (
                          <div style={{ fontSize: 10, color: P.sub, marginTop: 1, fontStyle: "italic" }}>
                            + Mail-App öffnen an {profil.email}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleExport}
                        disabled={saisonToerns.length === 0}
                        style={{ ...btnS(exportFlash ? P.green : P.teal), width: "auto", padding: "9px 18px", fontSize: 13, opacity: saisonToerns.length === 0 ? 0.4 : 1 }}
                      >
                        {exportFlash ? "✓ Gespeichert!" : "⬇ CSV exportieren"}
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

            {toerns.length === 0 ? (
              <div style={{ ...cardS, textAlign: "center", padding: "50px 20px" }}>
                <div style={{ fontSize: 48 }}>🌊</div>
                <p style={{ color: P.sub, marginTop: 12, fontStyle: "italic" }}>Noch keine Törns eingetragen.</p>
              </div>
            ) : toerns.map(t => (
              <div key={t.id} style={{ ...cardS, marginBottom: 10, cursor: "pointer" }} onClick={() => setExpId(expId === t.id ? null : t.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{t.route || `${t.starthafen || ""}→${t.zielhafen || ""}`}</div>
                    <div style={{ fontSize: 11, color: P.sub, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "'DM Mono',monospace" }}>
                      <span>{fmtDate(t.datum)}</span>
                      {t.streckeKm > 0 && <span>{fmtNum(t.streckeKm)} km</span>}
                      <span style={{ color: bftColor(t.windstaerke) }}>Bft {t.windstaerke} {t.windrichtung}</span>
                      <span>{t.wetter}</span>
                      {t.schleusen > 0 && <span>🔒 {t.schleusen}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, color: P.amber, fontFamily: "'DM Mono',monospace" }}>{fmtNum(t.punkte, 1)}</div>
                    <div style={{ fontSize: 9, color: P.sub, fontFamily: "'DM Mono',monospace" }}>Punkte</div>
                  </div>
                </div>

                {expId === t.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.border}` }}>
                    <p style={{ ...secL(P.amber), marginBottom: 8 }}>Punkte-Aufschlüsselung</p>
                    {punkteAufschluesselung(t).map((l, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: P.sub, fontFamily: "'DM Mono',monospace", padding: "3px 0", borderBottom: `1px solid ${P.muted}` }}>
                        <span>{l.label}</span>
                        <span style={{ color: P.amber, fontWeight: 700 }}>+{fmtNum(l.val, 1)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: P.amber, fontFamily: "'DM Mono',monospace", padding: "6px 0 0" }}>
                      <span>Gesamt</span><span>{fmtNum(t.punkte, 1)} Pkt</span>
                    </div>
                    {t.einmaligesSchiff && <p style={{ fontSize: 12, color: P.sub, marginTop: 8, fontFamily: "'DM Mono',monospace" }}>⛵ {t.einmaligesSchiff}</p>}
                    {t.notizen && <p style={{ fontSize: 13, fontStyle: "italic", color: P.text, lineHeight: 1.5, marginTop: 8, borderTop: `1px solid ${P.border}`, paddingTop: 8 }}>„{t.notizen}"</p>}
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                      <button onClick={e => { e.stopPropagation(); doEdit(t); }} style={{ ...btnS(P.acc, true), fontSize: 11 }}>✏️ Bearbeiten</button>
                      {delId === t.id ? (
                        <>
                          <button onClick={e => { e.stopPropagation(); doDel(t.id); }} style={{ ...btnS(P.red, true), fontSize: 11 }}>Löschen?</button>
                          <button onClick={e => { e.stopPropagation(); setDelId(null); }} style={{ ...btnS(null, true), fontSize: 11 }}>Nein</button>
                        </>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setDelId(t.id); }} style={{ ...btnS(null, true), fontSize: 11 }}>🗑️</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ══ PROFIL ══ */}
        {tab === "profil" && (
          <ProfilTab profil={profil} onSave={handleProfilSave} />
        )}
      </div>

      {/* ─── BOTTOM NAV ─── */}
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: P.deep, borderTop: `1px solid ${P.border}`, display: "flex", gap: 6, padding: "8px 14px 14px", zIndex: 100 }}>
        {[["dashboard","📊","Dashboard"],["form","⚓","Eintragen"],["list","📖","Logbuch"],["profil","👤","Profil"]].map(([v, ico, lbl]) => (
          <button key={v} onClick={() => setTab(v)} style={tabS(tab === v)}>
            <div style={{ fontSize: 18 }}>{ico}</div>
            <div style={{ marginTop: 1, fontSize: 10 }}>{lbl}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}
