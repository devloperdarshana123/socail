import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Target, ArrowLeft, ArrowRight, Info,
  ShieldCheck, Scale, Users, Globe, Lock,
  Zap, Building2, Eye, FileText, AlertCircle, CheckCircle
} from "lucide-react";
import Footer from "../components/Footer";
// ─── DATA FROM PDF ───────────────────────────────────────────────────────────

const sections = [
  {
    id: "mission",
    title: "Mission & Vision",
    icon: Target,
    content: `Erovians is built to become the most trusted, secure, and professionally governed digital platform in Europe.\n\n**Our Mission**\nTo create a transparent, lawful, and professional digital ecosystem — combining social networking, marketplace interactions, and AI-powered tools — where every User can operate with confidence, verified identity, and legal security.\n\n**Our Vision**\nWe envision a digital infrastructure where interactions are transparent, data is protected, commerce is frictionless, and governance is accountable. Operating from the Grand Duchy of Luxembourg, Erovians aims to set a new standard in platform governance — blending advanced technology with the most stringent European regulatory standards.\n\n**Our Foundation**\nErovians is built on the legal bedrock of the EU Digital Services Act (DSA), GDPR, and the EU AI Act. It is not just a product — it is a trust-based digital infrastructure designed for the modern professional economy.`,
  },
  {
    id: "what-we-are",
    title: "What Is Erovians?",
    icon: Building2,
    content: `Erovians is a Luxembourg-based platform that acts strictly as a **neutral intermediary and hosting provider** in accordance with EU law (Directive 2000/31/EC and Regulation (EU) 2022/2065 — the Digital Services Act).\n\n**Platform Type**\nErovians is simultaneously a social network, a professional marketplace, and an AI-assisted governance platform.\n\n**What We Are Not**\nErovians does not create content. It does not pre-approve User submissions. It does not endorse opinions, certify technical claims, or guarantee commercial outcomes. It does not become a party to agreements made between Users — unless explicitly stated.\n\n**Operating Jurisdiction**\nHeadquartered in the Grand Duchy of Luxembourg. All services are governed by Luxembourg law and applicable EU regulations. Cross-border users are protected by mandatory local consumer protection rules where applicable.`,
  },
  {
    id: "values",
    title: "Core Values",
    icon: ShieldCheck,
    intro: "These values are not aspirational slogans — they are embedded in every policy, every system, and every enforcement decision on the platform.",
    items: [
      {
        label: "Trust & Transparency",
        desc: "We believe in clear rules, transparent algorithms, and accountable governance. Our Trust & Reputation System ensures reliability is rewarded through verified identity, transaction history, and professional integrity — not arbitrary signals."
      },
      {
        label: "Privacy by Design",
        desc: "Data protection is not an afterthought. We implement GDPR-compliant practices from architecture through to deletion — data minimization, purpose limitation, and storage limitation are non-negotiable principles."
      },
      {
        label: "Legal Integrity",
        desc: "Every feature, every automated decision, and every moderation action is anchored in law. We operate under GDPR, the Digital Services Act, the EU AI Act, and Luxembourg commercial law — and we publish our framework publicly."
      },
      {
        label: "Proportionality",
        desc: "Enforcement is never arbitrary. Whether restricting content, suspending accounts, or applying trust indicators, every measure must be proportionate to the risk and supported by documented reasoning."
      },
      {
        label: "Innovation with Accountability",
        desc: "We leverage AI for moderation, matching, fraud detection, and platform intelligence — but with mandatory human oversight for any decision that materially affects a User's access, status, or visibility."
      }
    ]
  },
  {
    id: "what-we-do",
    title: "What We Do",
    icon: Zap,
    intro: "Erovians combines three layers of digital infrastructure into a single governed platform.",
    items: [
      {
        label: "Professional Social Network",
        desc: "A structured, ad-governed environment to connect, share professional content, and build a credible online presence — without algorithmic manipulation or dark patterns. All recommender systems are disclosed under DSA Article 27."
      },
      {
        label: "Governed Marketplace",
        desc: "A secure environment for buying and selling services or digital goods — backed by multi-level identity verification (KYC/KYB), chat-based negotiation with evidentiary traceability, and a structured dispute resolution framework."
      },
      {
        label: "AI-Assisted Platform Intelligence",
        desc: "Smart matching, automated content moderation assistance, fraud detection, trust scoring, and translation tools — all governed by the EU AI Act and GDPR Article 22, with contestation rights preserved for every significant automated decision."
      },
      {
        label: "Trust & Verification Infrastructure",
        desc: "A 5-level KYC/KYB verification system — from email confirmation through to Enhanced Due Diligence — ensures that every User on the platform can be trusted to the degree their activity requires."
      }
    ]
  },
  {
    id: "governance",
    title: "Platform Governance",
    icon: Scale,
    content: `Erovians is governed by a comprehensive 28-policy legal framework, publicly available and structured for full DSA, GDPR, and AI Act compliance.\n\n**Content Moderation**\nA hybrid system: automated detection combined with trained human review. Every moderation action includes a statement of reasons and a right of appeal (DSA Article 17 & 20).\n\n**Dispute Resolution**\nUsers are encouraged to resolve disputes internally through the platform's structured tools. Unresolved matters are referred to Luxembourg courts, or — for DSA content disputes — to certified out-of-court dispute settlement bodies.\n\n**Transparency Reporting**\nErovians maintains verifiable records of all notices received, actions taken, and appeal outcomes — and publishes transparency reports aligned with DSA obligations.\n\n**Single Point of Contact**\nFor all DSA-related communications, authorities and Users may contact: ds@erovians.com (French language designated).`,
  },
  {
    id: "users",
    title: "Who Can Use Erovians?",
    icon: Users,
    intro: "Erovians serves a range of User categories, each with specific rights, obligations, and verification requirements.",
    items: [
      {
        label: "Consumer Users",
        desc: "Natural persons acting outside a trade or profession. Protected by mandatory EU consumer rights under Directive 2011/83/EU and Directive 2005/29/EC on unfair commercial practices."
      },
      {
        label: "Business Users & Professional Sellers",
        desc: "Legal entities or professionals offering goods or services commercially. Subject to KYB verification, commercial disclosure obligations, and enhanced trust requirements."
      },
      {
        label: "Service Providers",
        desc: "Professionals offering design, fabrication, logistics, installation, consulting, or other services. Eligible for verified professional status through the Trust & Reputation System."
      },
      {
        label: "Representatives & Agents",
        desc: "Persons acting on behalf of a legal entity. Must declare their representative status and provide appropriate authorization documentation at the relevant KYC level."
      }
    ]
  },
  {
    id: "ai-data",
    title: "AI & Data Protection",
    icon: Lock,
    content: `Erovians uses artificial intelligence as a **support layer** — not as a replacement for legal, professional, or human judgment.\n\n**AI Use Cases**\nContent recommendation and ranking, fraud and anomaly detection, moderation assistance, trust and reputation analysis, search improvement, translation, summarization, and internal risk assessment.\n\n**What AI Cannot Do**\nAI outputs on Erovians do not constitute legal advice, tax advice, professional certification, contractual approval, or expert validation. Users remain solely responsible for independent verification before relying on any AI-generated output.\n\n**Your Rights**\nWhere automated decisions materially affect your account, visibility, or access — you have the right to request human review, express your point of view, and contest the outcome under GDPR Article 22.\n\n**Data We Collect**\nIdentity data, usage data, technical data (IP, device), and communication data — processed only on a lawful basis and retained for defined periods under our Data Retention Policy.`,
  },
  {
    id: "luxembourg",
    title: "Why Luxembourg?",
    icon: Globe,
    content: `Luxembourg is not a random choice — it is a deliberate strategic and legal decision.\n\n**EU Legal Hub**\nLuxembourg is home to the Court of Justice of the European Union and several EU institutions. Operating from Luxembourg places Erovians at the heart of European legal infrastructure.\n\n**Regulatory Strength**\nThe Commission Nationale pour la Protection des Données (CNPD) is Erovians' lead supervisory authority under GDPR. Luxembourg enforces EU law rigorously and consistently.\n\n**Commercial Infrastructure**\nLuxembourg offers a stable, internationally recognized legal and corporate framework — making Erovians scalable for cross-border operations across the EU and globally.\n\n**Language Commitment**\nAll binding legal documents are available in English, with French versions provided for Luxembourg operations and accessibility. In case of conflict, the English version prevails — unless expressly stated otherwise.`,
  },
];

// ─── RENDER HELPERS ──────────────────────────────────────────────────────────

function renderContent(text) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g).map((part, j) =>
      j % 2 === 1
        ? <strong key={j} style={{ color: "#0f1923", fontWeight: 650 }}>{part}</strong>
        : <span key={j}>{part}</span>
    );
    return <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>;
  });
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [expanded, setExpanded] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggle = (sid, idx) => {
    const k = `${sid}-${idx}`;
    setExpanded(p => ({ ...p, [k]: !p[k] }));
  };

  const active = sections.find(s => s.id === activeSection);
  const activeIdx = sections.findIndex(s => s.id === activeSection);
  const prev = activeIdx > 0 ? sections[activeIdx - 1] : null;
  const next = activeIdx < sections.length - 1 ? sections[activeIdx + 1] : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f7f5f0",
      color: "#0f1923",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── HERO ── */}
      <header style={{
        background: "#0f1923",
        padding: "4rem 2rem 3.5rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* subtle grid pattern */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(200,169,110,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,110,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <Link to="/" style={{
          position: "absolute",
          top: "1.5rem",
          right: "2rem",
          background: "transparent",
          border: "1px solid rgba(200,169,110,0.5)",
          color: "#c8a96e",
          padding: "0.5rem 1.2rem",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "13px",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 600,
          transition: "all 0.2s",
          cursor: "pointer",
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(200,169,110,0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        >
          Login
        </Link>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(200,169,110,0.12)",
          border: "1px solid rgba(200,169,110,0.35)",
          borderRadius: 100, padding: "5px 16px",
          fontSize: 10, color: "#c8a96e",
          letterSpacing: "0.14em", textTransform: "uppercase",
          marginBottom: "1.5rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <Building2 size={11} />
          Luxembourg · EU Compliant · DSA · GDPR · AI Act
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          About Erovians
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 580,
          margin: "0 auto 2rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          A trust-based digital infrastructure combining professional social networking,
          governed marketplace interactions, and AI-assisted tools — built on EU law.
        </p>

        {/* Stats row */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "2.5rem",
          flexWrap: "wrap",
        }}>
          {[
            { val: "28", label: "Legal Policies" },
            { val: "EU", label: "Regulatory Standard" },
            { val: "5-Level", label: "KYC Verification" },
            { val: "Luxembourg", label: "Jurisdiction" },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", color: "#c8a96e", fontWeight: 400, letterSpacing: "-0.02em" }}>{val}</div>
              <div style={{ fontSize: 11, color: "#556677", fontFamily: "system-ui, sans-serif", marginTop: 2, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── MAIN LAYOUT ── */}
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "2.5rem 1.5rem 5rem",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "280px 1fr",
        gap: "1.75rem",
        alignItems: "start",
        width: "100%",
        boxSizing: "border-box",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          position: isMobile ? "static" : "sticky",
          top: 80,
          background: "#fff",
          border: "1px solid #e2ddd4",
          borderRadius: 14,
          padding: "1.25rem 0.75rem",
          boxShadow: "0 2px 12px rgba(15,25,35,0.06)",
        }}>
          <p style={{
            fontSize: 10, color: "#aaa",
            letterSpacing: "0.13em", textTransform: "uppercase",
            marginBottom: "0.75rem", padding: "0 0.5rem",
            fontFamily: "system-ui, sans-serif",
          }}>
            NAVIGATE
          </p>

          {sections.map(({ id, title, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.7rem 0.9rem",
                  borderRadius: 9,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13.5,
                  fontFamily: "system-ui, sans-serif",
                  background: isActive ? "#0f1923" : "transparent",
                  color: isActive ? "#c8a96e" : "#555",
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: 2,
                  transition: "all 0.15s",
                }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                <span>{title}</span>
              </button>
            );
          })}

          {/* Legal badge */}
          <div style={{
            marginTop: "1.5rem",
            padding: "0.85rem 1rem",
            background: "#fafaf7",
            border: "1px solid #e8e2d8",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <ShieldCheck size={13} color="#c8a96e" />
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Legal Framework</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              28 policies · DSA · GDPR · AI Act · Luxembourg Law
            </p>
          </div>
        </aside>

        {/* ── CONTENT PANEL ── */}
        <main>
          <div style={{
            background: "#fff",
            border: "1px solid #e2ddd4",
            borderRadius: 16,
            padding: "2.5rem 3rem",
            minHeight: 460,
            boxShadow: "0 2px 16px rgba(15,25,35,0.06)",
          }}>
            {active && (
              <>
                {/* Section header */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 16,
                  marginBottom: "1.75rem", paddingBottom: "1.5rem",
                  borderBottom: "1px solid #f0ebe0",
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: "#0f1923",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {(() => { const Icon = active.icon; return <Icon size={18} color="#c8a96e" />; })()}
                  </div>
                  <div>
                    <h2 style={{
                      fontFamily: "'Georgia', serif",
                      fontSize: "1.45rem",
                      fontWeight: 400,
                      color: "#0f1923",
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}>{active.title}</h2>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#aaa", fontFamily: "system-ui, sans-serif" }}>
                      Section {activeIdx + 1} of {sections.length}
                    </p>
                  </div>
                </div>

                {/* Intro callout */}
                {active.intro && (
                  <div style={{
                    background: "#faf7f0",
                    border: "1px solid #e8d5a3",
                    borderLeft: "3px solid #c8a96e",
                    borderRadius: "0 10px 10px 0",
                    padding: "0.9rem 1.25rem",
                    marginBottom: "1.5rem",
                    color: "#5a4a2a",
                    fontSize: 13.5,
                    lineHeight: 1.8,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <Info size={14} color="#c8a96e" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{active.intro}</span>
                    </div>
                  </div>
                )}

                {/* Text content */}
                {active.content && (
                  <div style={{
                    color: "#2a3540",
                    lineHeight: 2,
                    fontSize: 14.5,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {renderContent(active.content)}
                  </div>
                )}

                {/* Accordion items */}
                {active.items && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {active.items.map((item, idx) => {
                      const k = `${active.id}-${idx}`;
                      const open = expanded[k];
                      return (
                        <div key={idx} style={{
                          background: open ? "#faf9f6" : "#fff",
                          border: `1px solid ${open ? "#d4b87a" : "#e5e0d8"}`,
                          borderRadius: 10,
                          overflow: "hidden",
                          transition: "all 0.18s",
                        }}>
                          <button
                            onClick={() => toggle(active.id, idx)}
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.85rem 1.2rem",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "#0f1923",
                              fontFamily: "system-ui, sans-serif",
                              fontSize: 13.5,
                              fontWeight: 500,
                              textAlign: "left",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: open ? "#c8a96e" : "#ccc",
                                display: "inline-block", flexShrink: 0,
                                transition: "background 0.2s",
                              }} />
                              {item.label}
                            </span>
                            <span style={{
                              fontSize: 17, color: open ? "#c8a96e" : "#bbb",
                              lineHeight: 1, fontFamily: "system-ui",
                              transition: "color 0.2s",
                            }}>
                              {open ? "−" : "+"}
                            </span>
                          </button>
                          {open && (
                            <div style={{
                              padding: "0.65rem 1.2rem 1.1rem",
                              color: "#3a4a55",
                              fontSize: 13.5,
                              lineHeight: 1.85,
                              borderTop: "1px solid #f0ebe0",
                              fontFamily: "system-ui, sans-serif",
                            }}>
                              {item.desc}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Prev / Next */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.25rem", gap: 12 }}>
            <button
              disabled={!prev}
              onClick={() => prev && setActiveSection(prev.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "#fff",
                border: "1px solid #e2ddd4",
                borderRadius: 9,
                padding: "9px 20px",
                color: prev ? "#444" : "#ccc",
                cursor: prev ? "pointer" : "default",
                fontSize: 13,
                fontFamily: "system-ui, sans-serif",
                boxShadow: prev ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <ArrowLeft size={14} />
              {prev ? prev.title : "Previous"}
            </button>

            <button
              disabled={!next}
              onClick={() => next && setActiveSection(next.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: next ? "#0f1923" : "#fff",
                border: `1px solid ${next ? "#0f1923" : "#e2ddd4"}`,
                borderRadius: 9,
                padding: "9px 20px",
                color: next ? "#c8a96e" : "#ccc",
                cursor: next ? "pointer" : "default",
                fontSize: 13,
                fontFamily: "system-ui, sans-serif",
                boxShadow: next ? "0 2px 8px rgba(15,25,35,0.15)" : "none",
              }}
            >
              {next ? next.title : "Next"}
              <ArrowRight size={14} />
            </button>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}