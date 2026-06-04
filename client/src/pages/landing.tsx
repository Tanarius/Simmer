import { useState } from "react";

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

// ─── App UI mocks ──────────────────────────────────────────────────────────

function PlannerMock() {
  const days = ["M", "T", "W", "T", "F"];
  const meals = ["Pasta", "Tacos", "Salad", "Curry", "Pizza"];
  const accents: string[] = ["#1C1410", "#C96A3A", "#1C1410", "#3D5A47", "#1C1410"];
  return (
    <div style={{ background: "#2A1F18", borderRadius: 14, padding: 20, border: "1px solid #3A2A20" }}>
      <div style={{ fontSize: 12, color: "#9A8A7A", marginBottom: 12, fontWeight: 600 }}>
        Week of Jun 2
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {days.map((d, i) => (
          <div key={i}>
            <div style={{ textAlign: "center", fontSize: 11, color: "#9A8A7A", marginBottom: 6, fontWeight: 600 }}>{d}</div>
            <div style={{
              background: accents[i],
              border: `1px solid ${i === 1 ? "rgba(201,106,58,0.4)" : i === 3 ? "rgba(61,90,71,0.4)" : "#3A2A20"}`,
              borderRadius: 8, padding: "10px 4px",
              textAlign: "center", fontSize: 11,
              color: "#F5EDE3", minHeight: 42,
              display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 500,
            }}>
              {meals[i]}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "8px 10px", background: "#1C1410", borderRadius: 8, fontSize: 11, color: "#9A8A7A" }}>
        🛒 <span style={{ color: "#C96A3A" }}>23 items</span> added to shopping list
      </div>
    </div>
  );
}

function ChefModeMock() {
  return (
    <div style={{ background: "#2A1F18", borderRadius: 14, padding: 20, border: "1px solid #3A2A20" }}>
      <div style={{ fontSize: 12, color: "#9A8A7A", marginBottom: 10, fontWeight: 600 }}>In your pantry</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {["🥕 Carrots", "🧅 Onions", "🍗 Chicken", "🧄 Garlic", "🫒 Olive oil"].map(item => (
          <span key={item} style={{ background: "#1C1410", border: "1px solid #3A2A20", borderRadius: 20, padding: "4px 10px", fontSize: 11, color: "#F5EDE3" }}>{item}</span>
        ))}
      </div>
      <div style={{ background: "linear-gradient(135deg, rgba(201,106,58,0.12), rgba(61,90,71,0.12))", borderRadius: 10, padding: 14, border: "1px solid rgba(201,106,58,0.2)" }}>
        <div style={{ fontSize: 11, color: "#C96A3A", marginBottom: 6, fontWeight: 700 }}>✨ AI Suggestion</div>
        <div style={{ fontSize: 14, color: "#F5EDE3", fontWeight: 700 }}>Garlic Butter Chicken</div>
        <div style={{ fontSize: 11, color: "#9A8A7A", marginTop: 4 }}>30 min · Uses 4 pantry items · No extra shopping</div>
      </div>
    </div>
  );
}

function HouseholdMock() {
  const members: Array<{ name: string; color: string; note: string }> = [
    { name: "Ana",  color: "#C96A3A", note: "Added Margherita Pizza" },
    { name: "Luis", color: "#3D5A47", note: "Planned Wed dinner" },
    { name: "Sofia", color: "#7B5EA7", note: "Checked off 6 items" },
  ];
  return (
    <div style={{ background: "#2A1F18", borderRadius: 14, padding: 20, border: "1px solid #3A2A20" }}>
      <div style={{ fontSize: 12, color: "#9A8A7A", marginBottom: 12, fontWeight: 600 }}>The Martinez household</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {members.map(({ name, color }) => (
          <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#F5EDE3" }}>
              {name[0]}
            </div>
            <span style={{ fontSize: 10, color: "#9A8A7A" }}>{name}</span>
          </div>
        ))}
      </div>
      {members.map(({ name, color, note }) => (
        <div key={name} style={{ fontSize: 11, color: "#9A8A7A", padding: "7px 10px", background: "#1C1410", borderRadius: 7, marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
          <span><strong style={{ color: "#F5EDE3" }}>{name}</strong> {note}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Landing page ──────────────────────────────────────────────────────────

export default function LandingPage() {
  const [annual, setAnnual] = useState(false);

  const features: Array<{
    tag: string; tagColor: string; tagBg: string;
    heading: string; body: string;
    mock: React.ReactNode; mockFirst: boolean;
  }> = [
    {
      tag: "✨ AI-powered",
      tagColor: "#C96A3A", tagBg: "rgba(201,106,58,0.12)",
      heading: "Your whole week, planned in minutes",
      body: "Drag, drop, done. Build your meal week visually and let Simmer generate your shopping list automatically.",
      mock: <PlannerMock />, mockFirst: true,
    },
    {
      tag: "✨ Chef Mode",
      tagColor: "#C96A3A", tagBg: "rgba(201,106,58,0.12)",
      heading: "Tell us what's in your fridge",
      body: "Simmer's AI looks at your pantry and suggests meals you can actually make tonight — no extra shopping required.",
      mock: <ChefModeMock />, mockFirst: false,
    },
    {
      tag: "👨‍👩‍👧‍👦 Household accounts",
      tagColor: "#3D8A5A", tagBg: "rgba(61,90,71,0.15)",
      heading: "Built for whoever's at your table",
      body: "Family of four. Two roommates. Solo but meal prepping for the week. Simmer adapts to your household, not the other way around.",
      mock: <HouseholdMock />, mockFirst: true,
    },
  ];

  const freeFeatures = [
    "Meal planning & weekly planner",
    "Recipe library (unlimited)",
    "Shopping list generation",
    "Household sharing",
    "10 AI suggestions / day",
    "30 Copilot messages / day",
  ];

  const proFeatures = [
    "Everything in Free",
    "Unlimited AI suggestions",
    "Unlimited Copilot",
    "Chef Mode — pantry-based AI meals",
    "Priority support",
    "Early access to new features",
  ];

  return (
    <>
      <style>{`
        @keyframes simmer-float {
          0%,100% { transform: translateY(0px) rotate(0deg); opacity: 0.1; }
          50%      { transform: translateY(-18px) rotate(6deg); opacity: 0.16; }
        }
        .lp-nav-btn {
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: 14px; color: #9A8A7A;
          padding: 0; transition: color 0.15s;
        }
        .lp-nav-btn:hover { color: #F5EDE3; }
        .lp-cta-primary {
          background: #C96A3A; color: #F5EDE3;
          padding: 14px 28px; border-radius: 10px;
          font-size: 16px; font-weight: 700;
          text-decoration: none; display: inline-block;
          transition: opacity 0.15s;
        }
        .lp-cta-primary:hover { opacity: 0.88; }
        .lp-cta-outline {
          background: transparent; border: 1px solid #3A2A20;
          color: #F5EDE3; padding: 14px 28px; border-radius: 10px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: border-color 0.15s, background 0.15s;
        }
        .lp-cta-outline:hover { border-color: rgba(201,106,58,0.4); background: rgba(201,106,58,0.06); }
        .lp-footer-link { color: #5A4A3A; text-decoration: none; transition: color 0.15s; }
        .lp-footer-link:hover { color: #9A8A7A; }
      `}</style>

      <div style={{ background: "#1C1410", color: "#F5EDE3", minHeight: "100vh", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* ── NAV ─────────────────────────────────────────────── */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          height: 60, padding: "0 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #2A1F18",
          background: "rgba(28,20,16,0.9)", backdropFilter: "blur(12px)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#C96A3A" }}>S</span>immer
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <button className="lp-nav-btn" onClick={() => scrollTo("features")}>Features</button>
            <button className="lp-nav-btn" onClick={() => scrollTo("pricing")}>Pricing</button>
            <a href="/#/auth" style={{ fontSize: 14, color: "#9A8A7A", textDecoration: "none" }}>Sign in</a>
            <a href="/#/auth" style={{ background: "#C96A3A", color: "#F5EDE3", padding: "8px 18px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Get started
            </a>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section style={{
          minHeight: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden", paddingTop: 60,
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, #2A1F18 0%, #1C1410 70%)",
        }}>
          {[
            { e: "🍲", top: "18%", left: "9%",   delay: "0s",   dur: "9s"  },
            { e: "🥗", top: "62%", left: "7%",   delay: "2.5s", dur: "11s" },
            { e: "🌮", top: "22%", right: "9%",  delay: "4s",   dur: "10s" },
            { e: "🍝", top: "65%", right: "7%",  delay: "1s",   dur: "8s"  },
            { e: "🍛", top: "42%", left: "4%",   delay: "3s",   dur: "12s" },
            { e: "🥘", top: "45%", right: "4%",  delay: "5.5s", dur: "9s"  },
          ].map(({ e, top, left, right, delay, dur }) => (
            <div key={e + top} style={{
              position: "absolute", fontSize: "2rem", userSelect: "none",
              animation: `simmer-float ${dur} ease-in-out infinite`,
              animationDelay: delay,
              ...(top   ? { top }   : {}),
              ...(left  ? { left }  : {}),
              ...(right ? { right } : {}),
            }}>
              {e}
            </div>
          ))}

          <div style={{ textAlign: "center", maxWidth: 660, padding: "0 24px", position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(61,90,71,0.2)", border: "1px solid rgba(61,90,71,0.4)",
              borderRadius: 20, padding: "6px 16px", fontSize: 13, color: "#3D8A5A",
              marginBottom: 28, fontWeight: 600,
            }}>
              ✨ Meal planning for real households
            </div>

            <h1 style={{
              fontSize: "clamp(42px, 9vw, 68px)", fontWeight: 900,
              lineHeight: 1.08, marginBottom: 22, letterSpacing: "-0.03em",
            }}>
              Good things<br /><span style={{ color: "#C96A3A" }}>simmer.</span>
            </h1>

            <p style={{
              fontSize: "clamp(16px, 2.5vw, 19px)", color: "#9A8A7A",
              lineHeight: 1.65, marginBottom: 38, maxWidth: 520, margin: "0 auto 38px",
            }}>
              Meal planning for real households — families, roommates, partners, whoever.
              No more "what's for dinner."
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              <a href="/#/auth" className="lp-cta-primary">Start for free</a>
              <button className="lp-cta-outline" onClick={() => scrollTo("features")}>
                See how it works
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#5A4A3A", margin: 0 }}>Free to start. No credit card required.</p>
          </div>
        </section>

        {/* ── PAIN POINTS ──────────────────────────────────────── */}
        <section style={{ padding: "90px 24px", maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {[
              { icon: "😤", heading: "Tired of 'what's for dinner?'",      body: "The same question, every single night. Simmer ends it." },
              { icon: "🛒", heading: "Grocery runs that miss half the list", body: "Your shopping list builds itself from your week's meals." },
              { icon: "🤝", heading: "Planning for one but cooking for many", body: "Simmer works for your whole household, whoever that is." },
            ].map(({ icon, heading, body }) => (
              <div key={heading} style={{ background: "#2A1F18", borderRadius: 18, padding: 30, border: "1px solid #3A2A20" }}>
                <div style={{ fontSize: 34, marginBottom: 14 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#F5EDE3", lineHeight: 1.35 }}>{heading}</h3>
                <p style={{ fontSize: 14, color: "#9A8A7A", lineHeight: 1.6, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <section id="features" style={{ padding: "60px 24px 90px", maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, textAlign: "center", marginBottom: 70, letterSpacing: "-0.025em" }}>
            Everything your kitchen needs
          </h2>

          {features.map(({ tag, tagColor, tagBg, heading, body, mock, mockFirst }, i) => {
            const copyBlock = (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ display: "inline-block", background: tagBg, color: tagColor, borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, marginBottom: 16, alignSelf: "flex-start" }}>
                  {tag}
                </div>
                <h3 style={{ fontSize: "clamp(22px, 3.5vw, 28px)", fontWeight: 800, marginBottom: 14, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                  {heading}
                </h3>
                <p style={{ fontSize: 15, color: "#9A8A7A", lineHeight: 1.75, margin: 0 }}>{body}</p>
              </div>
            );

            return (
              <div key={i} style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 52, alignItems: "center",
                marginBottom: i < features.length - 1 ? 80 : 0,
              }}>
                {mockFirst ? <>{mock}{copyBlock}</> : <>{copyBlock}{mock}</>}
              </div>
            );
          })}
        </section>

        {/* ── PRICING ──────────────────────────────────────────── */}
        <section id="pricing" style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 900, textAlign: "center", marginBottom: 10, letterSpacing: "-0.025em" }}>
            Simple, honest pricing
          </h2>
          <p style={{ textAlign: "center", color: "#9A8A7A", marginBottom: 36, fontSize: 15 }}>
            Start free, upgrade when you're ready.
          </p>

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginBottom: 44 }}>
            <span style={{ fontSize: 14, color: annual ? "#9A8A7A" : "#F5EDE3", fontWeight: 600 }}>Monthly</span>
            <button
              onClick={() => setAnnual(a => !a)}
              style={{ width: 46, height: 26, borderRadius: 13, background: annual ? "#C96A3A" : "#3A2A20", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
            >
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#F5EDE3", position: "absolute", top: 3, left: annual ? 23 : 3, transition: "left 0.2s" }} />
            </button>
            <span style={{ fontSize: 14, color: annual ? "#F5EDE3" : "#9A8A7A", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              Annual
              <span style={{ background: "#3D5A47", color: "#F5EDE3", borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>Save 33%</span>
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {/* Free */}
            <div style={{ background: "#2A1F18", borderRadius: 22, padding: 34, border: "1px solid #3A2A20", display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Free</h3>
              <div style={{ fontSize: 40, fontWeight: 900, marginBottom: 2, letterSpacing: "-0.03em" }}>$0</div>
              <div style={{ fontSize: 14, color: "#9A8A7A", marginBottom: 30 }}>forever</div>
              <div style={{ flex: 1 }}>
                {freeFeatures.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 13 }}>
                    <span style={{ color: "#3D8A5A", flexShrink: 0, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#9A8A7A", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/#/auth" style={{ display: "block", textAlign: "center", background: "#2E2018", border: "1px solid #3A2A20", color: "#F5EDE3", padding: "13px 0", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", marginTop: 30 }}>
                Get started free
              </a>
            </div>

            {/* Pro */}
            <div style={{ background: "#2A1F18", borderRadius: 22, padding: 34, border: "2px solid #C96A3A", position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "#C96A3A", color: "#F5EDE3", borderRadius: 10, padding: "4px 18px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                Most popular
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Simmer Pro</h3>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
                <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.03em" }}>{annual ? "$3.33" : "$4.99"}</div>
                <div style={{ fontSize: 14, color: "#9A8A7A" }}>/ mo</div>
              </div>
              <div style={{ fontSize: 13, color: "#9A8A7A", marginBottom: 30 }}>
                {annual ? "billed $39.99 / year" : "billed monthly"}
              </div>
              <div style={{ flex: 1 }}>
                {proFeatures.map(f => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 13 }}>
                    <span style={{ color: "#C96A3A", flexShrink: 0, fontWeight: 700, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#9A8A7A", lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/#/pricing" style={{ display: "block", textAlign: "center", background: "#C96A3A", color: "#F5EDE3", padding: "13px 0", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", marginTop: 30 }}>
                Start free trial
              </a>
              <p style={{ fontSize: 12, color: "#5A4A3A", textAlign: "center", margin: "12px 0 0" }}>7-day free trial. Cancel anytime.</p>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 90px", maxWidth: 720, margin: "0 auto" }}>
          <div style={{ background: "linear-gradient(135deg, #2A1F18 0%, #221812 100%)", borderRadius: 26, padding: "68px 40px", textAlign: "center", border: "1px solid #3A2A20" }}>
            <h2 style={{ fontSize: "clamp(30px, 6vw, 44px)", fontWeight: 900, marginBottom: 14, letterSpacing: "-0.025em" }}>
              Feed your people.
            </h2>
            <p style={{ fontSize: 16, color: "#9A8A7A", marginBottom: 36 }}>
              Join Simmer and take dinner off your plate.
            </p>
            <a href="/#/auth" className="lp-cta-primary" style={{ padding: "16px 40px", fontSize: 17, borderRadius: 12 }}>
              Get started for free
            </a>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid #2A1F18", padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, maxWidth: 1000, margin: "0 auto", fontSize: 13, color: "#5A4A3A" }}>
          <div style={{ fontWeight: 700 }}>
            <span style={{ color: "#C96A3A" }}>Simmer</span>
            <span style={{ color: "#5A4A3A" }}> — Good things simmer.</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <a href="/#/privacy" className="lp-footer-link">Privacy Policy</a>
            <a href="/#/terms"   className="lp-footer-link">Terms</a>
            <a href="/#/pricing" className="lp-footer-link">Pricing</a>
          </div>
          <div>© 2026 Simmer</div>
        </footer>

      </div>
    </>
  );
}
