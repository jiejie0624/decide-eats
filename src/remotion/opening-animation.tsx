import type { CSSProperties } from "react";
import { Brain, Check, MapPin, Mic, Navigation, ShoppingBag, Sparkles } from "lucide-react";
import { AbsoluteFill, Easing, Interactive, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const openingConfig = {
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 450,
  brand: "DecideEats",
  subtitle: "Search gives you options. DecideEats gives your group a decision.",
  footer: "Built with AssemblyAI Voice Agent API",
  palette: {
    ink: "#1f2933",
    muted: "#6f7a83",
    mint: "#a7f3d0",
    aqua: "#67e8f9",
    blue: "#93c5fd",
    lavender: "#ede9fe",
    coral: "#ff8f85",
    glass: "rgba(255,255,255,0.58)",
  },
  problem: {
    title: "Too many choices.",
    subtitle: "Chats. Maps. Reviews. Budgets. Dietary needs.",
    cards: ["Group chat", "4.6 ★ Reviews", "Map tabs", "Budget?", "Halal?", "Delivery?"],
  },
  voice: {
    title: "Just say what your group wants.",
    phrases: ["nasi lemak", "halal", "便宜一点", "makan spicy", "for 3 people"],
  },
  brain: {
    title: "Agent Brain",
    steps: ["Heard craving", "Checked area", "Matched budget", "Respected dietary needs", "Ranked nearby places"],
    label: "Powered by AssemblyAI Voice Agent API",
  },
  decision: {
    eyebrow: "Tonight’s Pick",
    place: "Restoran Orchid",
    why: "Why this?",
    reason: "Close, budget-friendly, and fits the group.",
    buttons: ["Directions", "Delivery handoff"],
  },
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const glassCard: CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.76), rgba(255,255,255,0.34))",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 28px 80px rgba(83, 109, 122, 0.16), inset 0 1px 0 rgba(255,255,255,0.8)",
  backdropFilter: "blur(28px)",
};

const Text = ({ children, style }: { children: React.ReactNode; style?: CSSProperties }) => (
  <Interactive.Div name={typeof children === "string" ? children : "Text"} style={{ color: openingConfig.palette.ink, fontFamily: "Inter, SF Pro Display, Segoe UI, Arial, sans-serif", ...style }}>
    {children}
  </Interactive.Div>
);

const Background = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 18% 20%, rgba(186, 230, 253, 0.9), transparent 34%), radial-gradient(circle at 82% 18%, rgba(245, 208, 254, 0.75), transparent 30%), radial-gradient(circle at 62% 82%, rgba(167, 243, 208, 0.72), transparent 32%), linear-gradient(135deg, #f8fcff, #f6fbff 38%, #fff7fb)",
        overflow: "hidden",
      }}
    >
      <Interactive.Div
        name="Aurora mint glow"
        style={{
          position: "absolute",
          width: 780,
          height: 780,
          borderRadius: "50%",
          left: -160,
          top: 80,
          background: "rgba(103,232,249,0.32)",
          filter: "blur(74px)",
          translate: `${interpolate(frame, [0, 450], [0, 90], { ...clamp, easing: Easing.linear })}px ${interpolate(frame, [0, 450], [0, 40], { ...clamp, easing: Easing.linear })}px`,
        }}
      />
      <Interactive.Div
        name="Aurora lavender glow"
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          right: -120,
          top: -80,
          background: "rgba(237,233,254,0.86)",
          filter: "blur(80px)",
          translate: `${interpolate(frame, [0, 450], [0, -70], { ...clamp, easing: Easing.linear })}px ${interpolate(frame, [0, 450], [0, 70], { ...clamp, easing: Easing.linear })}px`,
        }}
      />
      <Interactive.Div
        name="Soft grid"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.18,
          backgroundImage: "linear-gradient(rgba(31,41,51,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(31,41,51,0.08) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at 50% 42%, black, transparent 72%)",
        }}
      />
    </AbsoluteFill>
  );
};

const FloatingProblemCards = () => {
  const frame = useCurrentFrame();
  const cards = openingConfig.problem.cards;

  return (
    <AbsoluteFill>
      {cards.map((label, index) => {
        const x = [170, 1250, 1040, 260, 1370, 520][index];
        const y = [210, 180, 690, 720, 520, 150][index];
        const drift = index % 2 === 0 ? 1 : -1;

        return (
          <Interactive.Div
            key={label}
            name={`Problem card ${label}`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: index === 2 ? 250 : 220,
              height: 86,
              borderRadius: 30,
              ...glassCard,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Inter, SF Pro Display, Segoe UI, Arial, sans-serif",
              fontSize: 27,
              fontWeight: 750,
              color: "rgba(31,41,51,0.72)",
              opacity: interpolate(frame, [0, 18, 82, 108], [0, 0.92, 0.92, 0.12], { ...clamp, easing: ease }),
              translate: `${interpolate(frame, [0, 108], [drift * -30, drift * 34], { ...clamp, easing: Easing.linear })}px ${interpolate(frame, [0, 108], [20, -26], { ...clamp, easing: Easing.linear })}px`,
              scale: interpolate(frame, [0, 28, 108], [0.94, 1, 0.96], { ...clamp, easing: ease }),
              rotate: `${[-7, 5, -4, 4, 7, -5][index]}deg`,
            }}
          >
            {label}
          </Interactive.Div>
        );
      })}
    </AbsoluteFill>
  );
};

const ProblemScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <FloatingProblemCards />
      <Interactive.Div
        name="Problem text group"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 365,
          textAlign: "center",
          opacity: interpolate(frame, [5, 28, 82, 108], [0, 1, 1, 0], { ...clamp, easing: ease }),
          translate: `0px ${interpolate(frame, [0, 28, 108], [26, 0, -18], { ...clamp, easing: ease })}px`,
        }}
      >
        <Text style={{ fontSize: 96, fontWeight: 850, letterSpacing: -3 }}>{openingConfig.problem.title}</Text>
        <Text style={{ marginTop: 24, fontSize: 36, fontWeight: 600, color: openingConfig.palette.muted }}>{openingConfig.problem.subtitle}</Text>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

const VoiceOrb = ({ sceneFrame }: { sceneFrame: number }) => {
  const { fps } = useVideoConfig();
  const rise = spring({ frame: sceneFrame, fps, config: { damping: 16, mass: 0.75, stiffness: 82 } });

  return (
    <Interactive.Div
      name="Liquid microphone orb"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 250,
        height: 250,
        marginLeft: -125,
        marginTop: -125,
        borderRadius: "50%",
        background: "radial-gradient(circle at 30% 24%, rgba(255,255,255,0.92), rgba(255,255,255,0.2) 22%, transparent 23%), linear-gradient(145deg, rgba(147,197,253,0.92), rgba(103,232,249,0.88) 46%, rgba(167,243,208,0.92))",
        border: "2px solid rgba(255,255,255,0.82)",
        boxShadow: "0 28px 100px rgba(45, 212, 191, 0.34), inset 0 1px 18px rgba(255,255,255,0.62)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: interpolate(sceneFrame, [0, 22, 102, 120], [0, 1, 1, 0.08], { ...clamp, easing: ease }),
        scale: 0.72 + rise * 0.28,
        translate: `0px ${interpolate(sceneFrame, [0, 120], [36, -12], { ...clamp, easing: ease })}px`,
      }}
    >
      {[0, 1, 2].map((ring) => (
        <Interactive.Div
          key={ring}
          name={`Voice ring ${ring + 1}`}
          style={{
            position: "absolute",
            inset: -34 - ring * 34,
            borderRadius: "50%",
            border: "2px solid rgba(103,232,249,0.34)",
            opacity: interpolate((sceneFrame + ring * 12) % 84, [0, 48, 84], [0.72, 0.22, 0], { ...clamp, easing: Easing.linear }),
            scale: interpolate((sceneFrame + ring * 12) % 84, [0, 84], [0.82, 1.26], { ...clamp, easing: Easing.linear }),
          }}
        />
      ))}
      <Mic size={82} color="white" strokeWidth={2.3} />
    </Interactive.Div>
  );
};

const VoiceScene = () => {
  const frame = useCurrentFrame();
  const sceneFrame = frame;

  return (
    <AbsoluteFill>
      <VoiceOrb sceneFrame={sceneFrame} />
      <Interactive.Div
        name="Voice title"
        style={{
          position: "absolute",
          top: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(sceneFrame, [8, 30, 92, 118], [0, 1, 1, 0], { ...clamp, easing: ease }),
          translate: `0px ${interpolate(sceneFrame, [0, 32, 120], [30, 0, -18], { ...clamp, easing: ease })}px`,
        }}
      >
        <Text style={{ fontSize: 62, fontWeight: 820, letterSpacing: -1.8 }}>{openingConfig.voice.title}</Text>
      </Interactive.Div>
      {openingConfig.voice.phrases.map((phrase, index) => (
        <Interactive.Div
          key={phrase}
          name={`Voice phrase ${phrase}`}
          style={{
            position: "absolute",
            left: [500, 1170, 420, 1270, 880][index],
            top: [650, 620, 420, 410, 735][index],
            padding: "18px 28px",
            borderRadius: 999,
            ...glassCard,
            fontFamily: "Inter, SF Pro Display, Segoe UI, Arial, sans-serif",
            fontSize: 29,
            fontWeight: 750,
            color: "rgba(31,41,51,0.72)",
            opacity: interpolate(sceneFrame, [18 + index * 6, 34 + index * 6, 94, 116], [0, 1, 1, 0], { ...clamp, easing: ease }),
            translate: `0px ${interpolate(sceneFrame, [18 + index * 6, 116], [22, -18], { ...clamp, easing: ease })}px`,
            scale: interpolate(sceneFrame, [18 + index * 6, 34 + index * 6], [0.92, 1], { ...clamp, easing: ease }),
          }}
        >
          {phrase}
        </Interactive.Div>
      ))}
    </AbsoluteFill>
  );
};

const BrainScene = () => {
  const frame = useCurrentFrame();
  const sceneFrame = frame;

  return (
    <AbsoluteFill>
      <Interactive.Div
        name="Agent Brain panel"
        style={{
          position: "absolute",
          left: 410,
          top: 190,
          width: 1100,
          height: 660,
          borderRadius: 56,
          padding: 58,
          ...glassCard,
          opacity: interpolate(sceneFrame, [0, 24, 100, 120], [0, 1, 1, 0], { ...clamp, easing: ease }),
          translate: `${interpolate(sceneFrame, [0, 34, 120], [0, 0, -26], { ...clamp, easing: ease })}px ${interpolate(sceneFrame, [0, 34, 120], [70, 0, -30], { ...clamp, easing: ease })}px`,
          scale: interpolate(sceneFrame, [0, 34], [0.96, 1], { ...clamp, easing: ease }),
        }}
      >
        <Interactive.Div name="Agent Brain header" style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Interactive.Div name="Brain icon" style={{ width: 74, height: 74, borderRadius: 28, background: "rgba(103,232,249,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Brain size={38} color="#334155" />
          </Interactive.Div>
          <div>
            <Text style={{ fontSize: 54, fontWeight: 860, letterSpacing: -1.4 }}>{openingConfig.brain.title}</Text>
            <Text style={{ marginTop: 8, fontSize: 24, fontWeight: 700, color: openingConfig.palette.muted }}>{openingConfig.brain.label}</Text>
          </div>
        </Interactive.Div>
        <Interactive.Div name="Reasoning timeline" style={{ marginTop: 58, display: "grid", gap: 26 }}>
          {openingConfig.brain.steps.map((step, index) => {
            const stepProgress = interpolate(sceneFrame, [22 + index * 11, 38 + index * 11], [0, 1], { ...clamp, easing: ease });

            return (
              <Interactive.Div
                key={step}
                name={`Brain step ${step}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  opacity: stepProgress,
                  translate: `${interpolate(sceneFrame, [20 + index * 11, 38 + index * 11], [30, 0], { ...clamp, easing: ease })}px 0px`,
                }}
              >
                <Interactive.Div
                  name={`Timeline dot ${index + 1}`}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: index === 4 ? "rgba(255,143,133,0.92)" : "linear-gradient(135deg, rgba(103,232,249,0.88), rgba(167,243,208,0.9))",
                    boxShadow: "0 0 36px rgba(45, 212, 191, 0.42)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    scale: interpolate(sceneFrame, [22 + index * 11, 38 + index * 11], [0.7, 1], { ...clamp, easing: ease }),
                  }}
                >
                  <Check size={25} color="white" strokeWidth={3} />
                </Interactive.Div>
                <Text style={{ fontSize: 38, fontWeight: 760 }}>{step}</Text>
              </Interactive.Div>
            );
          })}
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

const DecisionScene = () => {
  const frame = useCurrentFrame();
  const sceneFrame = frame;

  return (
    <AbsoluteFill>
      <Interactive.Div
        name="Decision card"
        style={{
          position: "absolute",
          left: 340,
          top: 220,
          width: 1240,
          height: 570,
          borderRadius: 58,
          padding: 58,
          ...glassCard,
          background: "linear-gradient(135deg, rgba(240,253,250,0.88), rgba(255,255,255,0.54) 62%, rgba(239,246,255,0.66))",
          opacity: interpolate(sceneFrame, [0, 24, 92, 120], [0, 1, 1, 0], { ...clamp, easing: ease }),
          scale: interpolate(sceneFrame, [0, 30], [0.94, 1], { ...clamp, easing: ease }),
          translate: `0px ${interpolate(sceneFrame, [0, 30, 120], [60, 0, -32], { ...clamp, easing: ease })}px`,
        }}
      >
        <Interactive.Div name="Decision top row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 40 }}>
          <div>
            <Text style={{ fontSize: 24, fontWeight: 850, letterSpacing: 7, textTransform: "uppercase", color: openingConfig.palette.muted }}>{openingConfig.decision.eyebrow}</Text>
            <Text style={{ marginTop: 24, fontSize: 94, fontWeight: 890, letterSpacing: -4, lineHeight: 1 }}>{openingConfig.decision.place}</Text>
          </div>
          <Interactive.Div name="Spark badge" style={{ width: 94, height: 94, borderRadius: 32, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 44px rgba(80, 103, 118, 0.14)" }}>
            <Sparkles size={42} color="#334155" />
          </Interactive.Div>
        </Interactive.Div>
        <Interactive.Div name="Decision reason" style={{ marginTop: 52, width: 760 }}>
          <Text style={{ fontSize: 32, fontWeight: 850, color: "#334155" }}>{openingConfig.decision.why}</Text>
          <Text style={{ marginTop: 14, fontSize: 34, fontWeight: 650, lineHeight: 1.32, color: "#4b5563" }}>{openingConfig.decision.reason}</Text>
        </Interactive.Div>
        <Interactive.Div name="Decision buttons" style={{ position: "absolute", right: 58, bottom: 58, display: "flex", gap: 18 }}>
          {openingConfig.decision.buttons.map((button, index) => (
            <Interactive.Div
              key={button}
              name={`Button ${button}`}
              style={{
                height: 78,
                padding: "0 30px",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: index === 0 ? "rgba(31,41,51,0.92)" : "rgba(255,255,255,0.72)",
                color: index === 0 ? "white" : openingConfig.palette.ink,
                fontFamily: "Inter, SF Pro Display, Segoe UI, Arial, sans-serif",
                fontSize: 26,
                fontWeight: 820,
                boxShadow: "0 18px 44px rgba(80,103,118,0.14)",
                opacity: interpolate(sceneFrame, [34 + index * 8, 50 + index * 8], [0, 1], { ...clamp, easing: ease }),
                translate: `0px ${interpolate(sceneFrame, [34 + index * 8, 50 + index * 8], [24, 0], { ...clamp, easing: ease })}px`,
              }}
            >
              {index === 0 ? <Navigation size={27} /> : <ShoppingBag size={27} />}
              {button}
            </Interactive.Div>
          ))}
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

const FinaleScene = () => {
  const frame = useCurrentFrame();
  const sceneFrame = frame;
  const { fps } = useVideoConfig();
  const logoScale = spring({ frame: sceneFrame, fps, config: { damping: 18, stiffness: 86, mass: 0.8 } });

  return (
    <AbsoluteFill>
      <Interactive.Div
        name="Final lockup"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          opacity: interpolate(sceneFrame, [0, 28], [0, 1], { ...clamp, easing: ease }),
        }}
      >
        <Interactive.Div
          name="Logo orb"
          style={{
            width: 150,
            height: 150,
            borderRadius: 48,
            ...glassCard,
            background: "linear-gradient(135deg, rgba(103,232,249,0.9), rgba(167,243,208,0.92), rgba(237,233,254,0.9))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 34px 90px rgba(45, 212, 191, 0.26)",
            scale: 0.82 + logoScale * 0.18,
          }}
        >
          <MapPin size={72} color="white" strokeWidth={2.3} />
        </Interactive.Div>
        <Text style={{ marginTop: 40, fontSize: 104, fontWeight: 900, letterSpacing: -4 }}>{openingConfig.brand}</Text>
        <Text style={{ marginTop: 22, width: 980, fontSize: 42, fontWeight: 680, lineHeight: 1.25, color: "#475569" }}>{openingConfig.subtitle}</Text>
        <Interactive.Div
          name="Final footer"
          style={{
            marginTop: 48,
            padding: "18px 28px",
            borderRadius: 999,
            ...glassCard,
            opacity: interpolate(sceneFrame, [34, 58], [0, 1], { ...clamp, easing: ease }),
            translate: `0px ${interpolate(sceneFrame, [34, 58], [18, 0], { ...clamp, easing: ease })}px`,
          }}
        >
          <Text style={{ fontSize: 25, fontWeight: 800, color: openingConfig.palette.muted }}>{openingConfig.footer}</Text>
        </Interactive.Div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const DecideEatsOpening = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence from={0} durationInFrames={120} layout="absolute-fill">
        <ProblemScene />
      </Sequence>
      <Sequence from={90} durationInFrames={120} layout="absolute-fill">
        <VoiceScene />
      </Sequence>
      <Sequence from={180} durationInFrames={120} layout="absolute-fill">
        <BrainScene />
      </Sequence>
      <Sequence from={270} durationInFrames={120} layout="absolute-fill">
        <DecisionScene />
      </Sequence>
      <Sequence from={360} durationInFrames={90} layout="absolute-fill">
        <FinaleScene />
      </Sequence>
    </AbsoluteFill>
  );
};
