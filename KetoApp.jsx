import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine
} from "recharts";
import {
  Home, TrendingUp, MessageSquare, SlidersHorizontal, Plus, Camera,
  Dumbbell, ClipboardList, X, Moon, Droplet, Check, ChevronRight,
  Flame, Send, Sparkles
} from "lucide-react";

/* ============================================================
   TOKENS — "Protocol Console": a lab-instrument / dive-computer
   read on a strength-sport cockpit. Phosphor-green signal color
   nods to old telemetry displays; everything else stays quiet.
   ============================================================ */
const C = {
  bg: "#0A0C0B",
  bgVignette: "radial-gradient(120% 90% at 50% -10%, #141A17 0%, #0A0C0B 55%)",
  panel: "#121614",
  panelRaised: "#161B19",
  hairline: "#242C29",
  hairlineLit: "#33403C",
  text: "#E7ECE8",
  textMuted: "#8A9A94",
  textDim: "#546059",
  signal: "#3FCE8E",
  signalDim: "#1B4A38",
  alert: "#E2555A",
  alertDim: "#4A2225",
  caution: "#E3A93F",
  cautionDim: "#4A3B1C",
  info: "#5B8FA8",
};

const MONO = '"SF Mono","IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace';
const SANS = '-apple-system,"Segoe UI",system-ui,sans-serif';

const MOCK = {
  name: "Wandy",
  startingWeight: 94,
  goalWeight: 85,
  currentWeight: 91.25,
  bodyFat: 18.6,
  muscleMass: 70.46,
  protocolStartDate: "2026-04-28",
  rateKgPerWeek: -0.28,
  projectedDate: "Oct 14, 2026",
  sleep: 6.5,
  water: 2.1,
  waterTarget: 3.8,
  dayType: "activity",
  targets: { calories: 2100, protein: 182, fat: 155, carbs: 22 },
  totals: { calories: 1480, protein: 128, fat: 79, carbs: 11 },
  aiNote:
    "Weight and body fat both trending correctly. Sleep sits below target again — this is the fourth consecutive flag, not noise anymore.",
  meals: [
    { id: 1, time: "08:10", label: "Eggs, prosciutto, zucchini", p: 22, f: 17, c: 4, kcal: 245 },
    { id: 2, time: "13:05", label: "Steak, arugula, cucumber, cheese", p: 46, f: 17, c: 3, kcal: 363 },
    { id: 3, time: "16:30", label: "Egg white shake", p: 25, f: 1, c: 1, kcal: 110 },
  ],
  workouts: [
    { id: 1, source: "manual", label: "Leg Day — 9 exercises", detail: "Leg Press Est.1RM 201.8kg · RDL 70kg×10" },
  ],
  weightSeries: [
    { d: "06/20", w: 93.1, bf: 19.0 }, { d: "06/24", w: 92.8, bf: 18.9 },
    { d: "06/28", w: 92.4, bf: 18.8 }, { d: "07/02", w: 92.0, bf: 18.7 },
    { d: "07/06", w: 91.5, bf: 18.6 }, { d: "07/09", w: 91.25, bf: 18.6 },
  ],
  carbSeries: [
    { d: "07/03", c: 24, ceil: 22 }, { d: "07/04", c: 18, ceil: 22 },
    { d: "07/05", c: 31, ceil: 22 }, { d: "07/06", c: 15, ceil: 22 },
    { d: "07/07", c: 20, ceil: 22 }, { d: "07/08", c: 17, ceil: 22 },
    { d: "07/09", c: 11, ceil: 22 },
  ],
  sleepSeries: [
    { d: "07/03", s: 6 }, { d: "07/04", s: 7 }, { d: "07/05", s: 5.5 },
    { d: "07/06", s: 6.5 }, { d: "07/07", s: 6 }, { d: "07/08", s: 6.5 }, { d: "07/09", s: 6.5 },
  ],
};

function Panel({ children, style }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 14, padding: 16, ...style }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.16em", color: C.textDim, textTransform: "uppercase" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function Stamp({ status }) {
  const isBreach = status === "BREACH";
  const color = isBreach ? C.alert : C.signal;
  return (
    <div
      style={{
        fontFamily: MONO, fontWeight: 700, fontSize: 10.5, letterSpacing: "0.14em",
        color, border: `1px solid ${color}55`, background: (isBreach ? C.alertDim : C.signalDim) + "55",
        padding: "4px 9px", borderRadius: 5, transform: "rotate(-1.5deg)", display: "inline-block",
      }}
    >
      {status}
    </div>
  );
}

function ProtocolDial({ start, goal, current }) {
  const size = 240;
  const cx = size / 2, cy = size / 2;
  const rOuter = 104, rInner = 92;
  const sweep = 270;
  const startAngle = -225;
  const totalLoss = start - goal;
  const lost = start - current;
  const pct = Math.max(0, Math.min(1, lost / totalLoss));

  const polar = (r, angleDeg) => {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const arcPath = (r, fromDeg, toDeg) => {
    const [x1, y1] = polar(r, fromDeg);
    const [x2, y2] = polar(r, toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const ticks = [];
  const tickCount = 27;
  for (let i = 0; i <= tickCount; i++) {
    const deg = startAngle + (sweep * i) / tickCount;
    const major = i % 3 === 0;
    const [x1, y1] = polar(rInner - (major ? 10 : 5), deg);
    const [x2, y2] = polar(rInner, deg);
    const litUp = i / tickCount <= pct;
    ticks.push(
      <line
        key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={litUp ? C.signal : C.hairlineLit}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
        opacity={litUp ? 0.9 : 0.55}
      />
    );
  }

  const endDeg = startAngle + sweep * pct;
  const [needleX, needleY] = polar((rOuter + rInner) / 2, endDeg);

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={arcPath(rOuter, startAngle, startAngle + sweep)} fill="none" stroke={C.hairline} strokeWidth={1.5} />
        <path
          d={arcPath((rOuter + rInner) / 2, startAngle, endDeg)}
          fill="none" stroke={C.signal} strokeWidth={6} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${C.signal}88)` }}
        />
        {ticks}
        <circle cx={needleX} cy={needleY} r={5} fill={C.signal} style={{ filter: `drop-shadow(0 0 5px ${C.signal})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, letterSpacing: "0.1em", marginBottom: 2 }}>PROGRESS</div>
        <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: C.text, lineHeight: 1 }}>
          {(pct * 100).toFixed(0)}<span style={{ fontSize: 20, color: C.textMuted }}>%</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: C.signal, marginTop: 6 }}>
          −{lost.toFixed(2)}kg <span style={{ color: C.textDim }}>/ {totalLoss.toFixed(0)}kg</span>
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, unit }) {
  const pct = Math.min(100, (value / target) * 100);
  const over = value > target;
  const color = over ? C.alert : pct > 85 ? C.caution : C.info;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11.5, marginBottom: 5 }}>
        <span style={{ color: C.textMuted, letterSpacing: "0.05em" }}>{label}</span>
        <span style={{ color: over ? C.alert : C.text }}>
          {value}<span style={{ color: C.textDim }}> / {target}{unit}</span>
        </span>
      </div>
      <div style={{ height: 5, background: "#1B211F", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 3, transition: "width .4s ease" }} />
      </div>
    </div>
  );
}

function HomeScreen() {
  const t = MOCK.targets, tot = MOCK.totals;
  const carbStatus = tot.carbs > t.carbs ? "BREACH" : "COMPLIANT";
  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: "0.18em" }}>PROTOCOL // TKD-01</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: C.text }}>Evening, {MOCK.name}</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim, textAlign: "right" }}>
          DAY 73<br /><span style={{ color: C.info }}>{MOCK.dayType.toUpperCase()}</span>
        </div>
      </div>

      <Panel style={{ marginBottom: 14 }}>
        <ProtocolDial start={MOCK.startingWeight} goal={MOCK.goalWeight} current={MOCK.currentWeight} />
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.hairline}` }}>
          <Stat label="CURRENT" value={MOCK.currentWeight} unit="kg" />
          <Stat label="RATE" value={MOCK.rateKgPerWeek} unit="kg/wk" color={C.signal} />
          <Stat label="ETA" value={MOCK.projectedDate.split(",")[0]} unit="" mono={false} />
        </div>
      </Panel>

      <Panel style={{ marginBottom: 14 }}>
        <Eyebrow right={<Stamp status={carbStatus} />}>Macro Burn-Down</Eyebrow>
        <MacroBar label="CALORIES" value={tot.calories} target={t.calories} unit="" />
        <MacroBar label="PROTEIN" value={tot.protein} target={t.protein} unit="g" />
        <MacroBar label="FAT" value={tot.fat} target={t.fat} unit="g" />
        <MacroBar label="NET CARBS" value={tot.carbs} target={t.carbs} unit="g" />
      </Panel>

      <Panel style={{ marginBottom: 14, borderLeft: `2px solid ${C.info}` }}>
        <Eyebrow><Sparkles size={11} style={{ marginRight: 5, verticalAlign: -2 }} />Coach Note</Eyebrow>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{MOCK.aiNote}</div>
      </Panel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Panel style={{ padding: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontFamily: MONO, fontSize: 10.5 }}>
            <Moon size={12} /> SLEEP
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: C.caution, marginTop: 4 }}>{MOCK.sleep}<span style={{ fontSize: 12, color: C.textDim }}>/10</span></div>
        </Panel>
        <Panel style={{ padding: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontFamily: MONO, fontSize: 10.5 }}>
            <Droplet size={12} /> WATER
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, color: C.text, marginTop: 4 }}>{MOCK.water}<span style={{ fontSize: 12, color: C.textDim }}>/{MOCK.waterTarget}L</span></div>
        </Panel>
      </div>

      <Panel>
        <Eyebrow>Today's Log</Eyebrow>
        {MOCK.workouts.map((w) => (
          <div key={"w" + w.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.hairline}` }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: C.signalDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Dumbbell size={13} color={C.signal} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, color: C.text }}>{w.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim }}>{w.detail}</div>
            </div>
          </div>
        ))}
        {MOCK.meals.map((m) => (
          <div key={m.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.hairline}` }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "#1B2422", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Camera size={12} color={C.info} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: C.text }}>{m.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim }}>{m.time}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim }}>P{m.p} · F{m.f} · C{m.c} · {m.kcal}kcal</div>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Stat({ label, value, unit, color, mono = true }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.textDim, letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: mono ? MONO : SANS, fontSize: 14.5, color: color || C.text, fontWeight: 600 }}>
        {value}{unit && <span style={{ fontSize: 10.5, color: C.textDim }}> {unit}</span>}
      </div>
    </div>
  );
}

function TrendsScreen() {
  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: "0.18em", marginBottom: 4 }}>TELEMETRY</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 16 }}>Trends</div>

      <Panel style={{ marginBottom: 14 }}>
        <Eyebrow>Weight (kg)</Eyebrow>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={MOCK.weightSeries}>
            <CartesianGrid stroke={C.hairline} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={{ stroke: C.hairline }} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, fontFamily: MONO, fontSize: 11 }} />
            <Line type="monotone" dataKey="w" stroke={C.signal} strokeWidth={2} dot={{ r: 2.5, fill: C.signal }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel style={{ marginBottom: 14 }}>
        <Eyebrow>Net Carbs vs. Ceiling</Eyebrow>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={MOCK.carbSeries}>
            <CartesianGrid stroke={C.hairline} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={{ stroke: C.hairline }} tickLine={false} />
            <YAxis tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={false} tickLine={false} width={22} />
            <Tooltip contentStyle={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, fontFamily: MONO, fontSize: 11 }} />
            <ReferenceLine y={22} stroke={C.alert} strokeDasharray="4 4" />
            <Bar dataKey="c" radius={[3, 3, 0, 0]}>
              {MOCK.carbSeries.map((r, i) => <Cell key={i} fill={r.c > r.ceil ? C.alert : C.info} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel>
        <Eyebrow>Sleep Quality</Eyebrow>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={MOCK.sleepSeries}>
            <CartesianGrid stroke={C.hairline} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="d" tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={{ stroke: C.hairline }} tickLine={false} />
            <YAxis domain={[0, 10]} tick={{ fill: C.textDim, fontSize: 9.5 }} axisLine={false} tickLine={false} width={22} />
            <Tooltip contentStyle={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, fontFamily: MONO, fontSize: 11 }} />
            <ReferenceLine y={7.5} stroke={C.caution} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="s" stroke={C.caution} strokeWidth={2} dot={{ r: 2.5, fill: C.caution }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function CoachScreen() {
  const [messages] = useState([
    { role: "user", text: "How's my sleep trend looking?" },
    {
      role: "assistant",
      text: "Averaging 6.3/10 over the last 7 days, against a 7.5 target. This is the fourth consecutive check-in below range — chronic, not incidental. It's actively working against your deficit via cortisol and hunger signaling. Fix the room temperature before touching macros again.",
    },
  ]);
  return (
    <div style={{ padding: "18px 16px 100px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: "0.18em", marginBottom: 4 }}>LIVE CONTEXT LOADED</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 16 }}>Coach</div>
      <div style={{ flex: 1 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
            <div
              style={{
                maxWidth: "84%", fontSize: 13, lineHeight: 1.5, padding: "10px 13px", borderRadius: 12,
                background: m.role === "user" ? C.info : C.panel,
                color: m.role === "user" ? "#06110F" : C.text,
                border: m.role === "user" ? "none" : `1px solid ${C.hairline}`,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, background: C.panel, border: `1px solid ${C.hairline}`, borderRadius: 12, padding: 6 }}>
        <input
          placeholder="Ask the coach..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, padding: "6px 8px" }}
        />
        <button style={{ background: C.signal, border: "none", borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={14} color="#06150F" />
        </button>
      </div>
    </div>
  );
}

function TargetsScreen() {
  const rows = [
    { label: "REST DAY", calories: 1900, protein: 175, fat: 145, carbs: 22 },
    { label: "ACTIVITY DAY", calories: 2100, protein: 182, fat: 155, carbs: 22 },
  ];
  return (
    <div style={{ padding: "18px 16px 100px" }}>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: "0.18em", marginBottom: 4 }}>CONFIGURATION</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 16 }}>Targets</div>
      {rows.map((r) => (
        <Panel key={r.label} style={{ marginBottom: 12 }}>
          <Eyebrow>{r.label}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Calories", r.calories, ""], ["Protein", r.protein, "g"], ["Fat", r.fat, "g"], ["Net Carbs", r.carbs, "g"]].map(([l, v, u]) => (
              <div key={l} style={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.textDim, marginBottom: 3 }}>{l.toUpperCase()}</div>
                <div style={{ fontFamily: MONO, fontSize: 16, color: C.text }}>{v}<span style={{ fontSize: 10.5, color: C.textDim }}>{u}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      <button
        style={{
          width: "100%", marginTop: 4, background: "transparent", border: `1px dashed ${C.hairlineLit}`,
          borderRadius: 10, padding: "12px", color: C.info, fontFamily: MONO, fontSize: 12, letterSpacing: "0.05em",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}
      >
        <Sparkles size={13} /> RECALCULATE WITH AI
      </button>
    </div>
  );
}

function LogSheet({ onClose }) {
  const [mode, setMode] = useState(null);

  if (mode === "meal") return <MealDemo onBack={() => setMode(null)} onClose={onClose} />;
  if (mode === "workout") return <WorkoutDemo onBack={() => setMode(null)} onClose={onClose} />;
  if (mode === "checkin") return <CheckinDemo onBack={() => setMode(null)} onClose={onClose} />;

  const options = [
    { id: "meal", label: "Log Meal", sub: "Photo → editable macros", icon: Camera, color: C.info },
    { id: "workout", label: "Log Workout", sub: "Photo, manual, or Strava", icon: Dumbbell, color: C.signal },
    { id: "checkin", label: "Check-In", sub: "Scale photo or manual", icon: ClipboardList, color: C.caution },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(4,6,5,0.72)", display: "flex", alignItems: "flex-end", zIndex: 20 }}>
      <div style={{ width: "100%", background: C.panel, borderTop: `1px solid ${C.hairlineLit}`, borderRadius: "20px 20px 0 0", padding: "10px 16px 28px" }}>
        <div style={{ width: 36, height: 4, background: C.hairlineLit, borderRadius: 2, margin: "6px auto 18px" }} />
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, background: C.panelRaised,
              border: `1px solid ${C.hairline}`, borderRadius: 12, padding: "13px 14px", marginBottom: 10, cursor: "pointer",
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: o.color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <o.icon size={16} color={o.color} />
            </div>
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>{o.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.textDim }}>{o.sub}</div>
            </div>
            <ChevronRight size={15} color={C.textDim} />
          </button>
        ))}
        <button
          onClick={onClose}
          style={{ width: "100%", background: "transparent", border: "none", color: C.textMuted, fontFamily: MONO, fontSize: 11.5, padding: "8px 0", marginTop: 2 }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

function SheetHeader({ title, onBack, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 8px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.textMuted, fontFamily: MONO, fontSize: 11 }}>‹ BACK</button>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", color: C.textDim }}>{title}</div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.textMuted }}><X size={16} /></button>
    </div>
  );
}

function MealDemo({ onBack, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 20, display: "flex", flexDirection: "column" }}>
      <SheetHeader title="LOG MEAL" onBack={onBack} onClose={onClose} />
      <div style={{ padding: "8px 16px" }}>
        <div style={{ height: 150, borderRadius: 10, background: "linear-gradient(135deg,#1c2320,#121614)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Camera size={26} color={C.textDim} />
        </div>
        <Panel>
          <Eyebrow right={<span style={{ fontFamily: MONO, fontSize: 10, color: C.caution }}>CONFIDENCE: MEDIUM</span>}>AI Estimate — Editable</Eyebrow>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 10 }}>Grilled chicken, mixed greens, olive oil</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            {[["P", 38], ["F", 14], ["C", 5], ["KCAL", 290]].map(([l, v]) => (
              <div key={l} style={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, borderRadius: 7, padding: "7px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDim }}>{l}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: C.text }}>{v}</div>
              </div>
            ))}
          </div>
          <button style={{ width: "100%", marginTop: 12, background: C.signal, border: "none", borderRadius: 9, padding: "11px", color: "#06150F", fontFamily: MONO, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check size={14} /> ADD TO LOG
          </button>
        </Panel>
      </div>
    </div>
  );
}

function WorkoutDemo({ onBack, onClose }) {
  const [source, setSource] = useState("photo");
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 20, display: "flex", flexDirection: "column" }}>
      <SheetHeader title="LOG WORKOUT" onBack={onBack} onClose={onClose} />
      <div style={{ padding: "8px 16px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["photo", "manual", "strava"].map((s) => (
            <button
              key={s} onClick={() => setSource(s)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.05em",
                border: `1px solid ${source === s ? C.signal : C.hairline}`,
                background: source === s ? C.signalDim + "66" : "transparent",
                color: source === s ? C.signal : C.textMuted,
              }}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        {source === "strava" ? (
          <Panel style={{ textAlign: "center", padding: 22 }}>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>Strava Connected</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, marginBottom: 12 }}>Last sync: 2h ago — Tennis, 78min</div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.signal }}>AUTO-IMPORTED</div>
          </Panel>
        ) : (
          <Panel>
            <Eyebrow>{source === "photo" ? "AI-Extracted — Editable" : "Manual Entry"}</Eyebrow>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Leg Day — Barbell Hip Thrust, Seated Leg Curl, Leg Extension</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, marginBottom: 12 }}>3 rounds · 10 reps × 50kg · Est. 1RM tracked</div>
            <button style={{ width: "100%", background: C.signal, border: "none", borderRadius: 9, padding: "11px", color: "#06150F", fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>
              CONFIRM & LOG
            </button>
          </Panel>
        )}
      </div>
    </div>
  );
}

function CheckinDemo({ onBack, onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: C.bg, zIndex: 20, display: "flex", flexDirection: "column" }}>
      <SheetHeader title="MORNING CHECK-IN" onBack={onBack} onClose={onClose} />
      <div style={{ padding: "8px 16px" }}>
        <Panel style={{ marginBottom: 12 }}>
          <Eyebrow>Extracted From Scale Photo</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[["WEIGHT", "91.25", "kg"], ["BF%", "18.6", "%"], ["MUSCLE", "70.46", "kg"]].map(([l, v, u]) => (
              <div key={l} style={{ background: C.panelRaised, border: `1px solid ${C.hairline}`, borderRadius: 7, padding: "8px" }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDim }}>{l}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: C.text }}>{v}<span style={{ fontSize: 9, color: C.textDim }}>{u}</span></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <Eyebrow>Sleep / Energy</Eyebrow>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: C.textMuted }}>SLEEP</span><span style={{ color: C.caution }}>6.5/10</span>
            </div>
            <div style={{ height: 4, background: "#1B211F", borderRadius: 2 }}><div style={{ width: "65%", height: "100%", background: C.caution, borderRadius: 2 }} /></div>
          </div>
          <button style={{ width: "100%", background: C.signal, border: "none", borderRadius: 9, padding: "11px", color: "#06150F", fontFamily: MONO, fontSize: 12, fontWeight: 700, marginTop: 6 }}>
            SAVE CHECK-IN
          </button>
        </Panel>
      </div>
    </div>
  );
}

export default function ProtocolConsole() {
  const [tab, setTab] = useState("home");
  const [sheetOpen, setSheetOpen] = useState(false);

  const NAV = [
    { id: "home", icon: Home },
    { id: "trends", icon: TrendingUp },
    { id: "fab", icon: Plus },
    { id: "coach", icon: MessageSquare },
    { id: "targets", icon: SlidersHorizontal },
  ];

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "24px 0", background: "transparent" }}>
      <div
        style={{
          width: 390, height: 780, background: C.bgVignette, borderRadius: 44, overflow: "hidden",
          position: "relative", border: `1px solid #1c2220`, boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 0 0 6px #060706",
          fontFamily: SANS,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 26px 4px", fontFamily: MONO, fontSize: 12, color: C.textMuted }}>
          <span>9:41</span>
          <div style={{ width: 90, height: 24, background: "#000", borderRadius: 14, margin: "-6px 0" }} />
          <span>5G ▮▮▮</span>
        </div>

        <div style={{ height: "calc(100% - 40px)", overflowY: "auto" }}>
          {tab === "home" && <HomeScreen />}
          {tab === "trends" && <TrendsScreen />}
          {tab === "coach" && <CoachScreen />}
          {tab === "targets" && <TargetsScreen />}
        </div>

        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 78,
            background: "rgba(18,22,20,0.92)", backdropFilter: "blur(10px)",
            borderTop: `1px solid ${C.hairline}`, display: "flex", alignItems: "center", justifyContent: "space-around",
            padding: "0 8px 14px",
          }}
        >
          {NAV.map((n) => {
            if (n.id === "fab") {
              return (
                <button
                  key="fab"
                  onClick={() => setSheetOpen(true)}
                  style={{
                    width: 52, height: 52, borderRadius: "50%", background: C.signal, border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center", marginTop: -22,
                    boxShadow: `0 4px 18px ${C.signal}66`,
                  }}
                >
                  <Plus size={22} color="#06150F" />
                </button>
              );
            }
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                style={{ background: "transparent", border: "none", padding: 8, color: active ? C.signal : C.textDim }}
              >
                <n.icon size={20} />
              </button>
            );
          })}
        </div>

        {sheetOpen && <LogSheet onClose={() => setSheetOpen(false)} />}
      </div>
    </div>
  );
}
