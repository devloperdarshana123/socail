import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, Globe, Lock, ArrowLeft, ArrowRight,
  Info, Building2, MapPin, Users, Scale, FileText
} from "lucide-react";
import Footer from "../components/Footer";

const sections = [
  {
    id: "hq",
    title: "Headquarters",
    icon: Building2,
    content: `Erovians is proudly headquartered in the **Grand Duchy of Luxembourg**.\n\nLuxembourg is not a random choice — it is a deliberate strategic and legal decision. Operating from the heart of Europe allows Erovians to adhere to the highest standards of data protection, digital governance, and cross-border commercial compliance.\n\n**Erovians – Luxembourg**\nLuxembourg City, Grand Duchy of Luxembourg\n\n**Legal Entity**\nThe Platform is operated by a Luxembourg-based legal entity, registered with the RCS Luxembourg. Mandatory publisher information including company name, registered office, and registration number is maintained in accordance with the Luxembourg Law of 14 August 2000 on electronic commerce and Directive 2000/31/EC.\n\n**Official Contact**\nGeneral inquiries: support@erovians.com\nDSA Single Point of Contact: DS@erovians.com\nLegal correspondence: via official registered address`,
  },
  {
    id: "why-luxembourg",
    title: "Why Luxembourg?",
    icon: Scale,
    items: [
      {
        label: "EU Legal Hub",
        desc: "Luxembourg is home to the Court of Justice of the European Union and several EU institutions. Operating from Luxembourg places Erovians at the heart of European legal infrastructure — making our governance framework directly anchored in EU law."
      },
      {
        label: "CNPD — Lead Supervisory Authority",
        desc: "The Commission Nationale pour la Protection des Données (CNPD) is Erovians' lead supervisory authority under GDPR. Luxembourg enforces EU data protection law rigorously and consistently. Users may submit complaints to the CNPD where they believe their GDPR rights have been violated."
      },
      {
        label: "Commercial & Legal Infrastructure",
        desc: "Luxembourg offers a stable, internationally recognized legal and corporate framework — governed by Luxembourg commercial law, the RCS registration system, and EU-compliant corporate structures. This makes Erovians scalable for cross-border operations across the EU and globally."
      },
      {
        label: "Jurisdiction & Courts",
        desc: "All disputes arising from use of the Platform fall under the exclusive jurisdiction of Luxembourg courts, subject to mandatory consumer protection rules where applicable under Regulation (EU) No 1215/2012 (Brussels I Recast). Consumers retain the right to assert claims before courts in their country of habitual residence where required by law."
      }
    ]
  },
  {
    id: "governing-law",
    title: "Governing Law",
    icon: FileText,
    content: `The contractual relationship between Users and Erovians is governed by the laws of the **Grand Duchy of Luxembourg**.\n\n**Primary Legal Framework**\nAll platform operations, policies, and user agreements are governed by Luxembourg law and applicable EU regulations, including:\n\n— Regulation (EU) 2016/679 (GDPR)\n— Regulation (EU) 2022/2065 (Digital Services Act)\n— Regulation (EU) 2024/1689 (AI Act)\n— Directive 2000/31/EC (eCommerce Directive)\n— Directive 2005/29/EC (Unfair Commercial Practices)\n— Regulation (EU) No 1215/2012 (Brussels I Recast)\n— Rome I Regulation (EC) No 593/2008\n— Rome II Regulation (EC) No 864/2007\n\n**Consumer Protection**\nFor Consumer Users, mandatory consumer protection rules of the country of habitual residence shall apply where required by applicable law — in particular Directive 2011/83/EU on consumer rights.\n\n**Language**\nAll binding legal documents are available in English. A French version is provided for Luxembourg operations and accessibility. In case of conflict, the English version prevails unless expressly stated otherwise.`,
  },
  {
    id: "global-reach",
    title: "Global Reach",
    icon: Globe,
    intro: "While headquartered in Luxembourg, Erovians is designed for cross-border professional interactions across the EU and beyond.",
    items: [
      {
        label: "European Economic Area (EEA)",
        desc: "Full regulatory compliance across all EEA member states. Erovians adheres strictly to GDPR, the Digital Services Act, and applicable EU consumer protection frameworks for all users within the EEA."
      },
      {
        label: "International Data Transfers",
        desc: "Personal data may be transferred outside the EEA where necessary for service operation. Such transfers are conducted in accordance with Chapter V GDPR, including adequacy decisions adopted by the European Commission and standard contractual clauses (SCCs) where required."
      },
      {
        label: "Cross-Border User Interactions",
        desc: "Users acknowledge that interactions on the Platform may involve parties located in different jurisdictions. Users are solely responsible for ensuring compliance with their local laws, import/export regulations, and professional or industry regulations. Erovians does not verify compliance of cross-border transactions unless explicitly stated."
      },
      {
        label: "Geo-Restrictions & Compliance Measures",
        desc: "Erovians reserves the right to restrict access to certain services by geography, apply geo-blocking measures, or adapt services to comply with local regulations. Assessment of content legality is based on applicable EU law and, where relevant, the national law of the jurisdiction concerned."
      }
    ]
  },
  {
    id: "language-support",
    title: "Language Support",
    icon: Users,
    content: `Erovians operates with a clear language policy designed to ensure legal clarity and user accessibility.\n\n**Binding Documents**\nAll binding legal documents — including the Terms of Service, Privacy Policy, and all 28 platform policies — are available in **English**. In the event of any inconsistency between versions, the English version shall prevail unless expressly stated otherwise.\n\n**French Language**\nA French version of legal documents is provided for Luxembourg operations and user accessibility. French is also the **designated language for DSA Single Point of Contact communications** (DS@erovians.com) under Articles 11–12 of Regulation (EU) 2022/2065. Erovians may also process DSA communications in English where operationally appropriate.\n\n**Platform Availability**\nThe Erovians platform interface is currently available in English and French. Additional language support is planned as the platform scales across the EU and international markets.\n\n**Accessibility Standards**\nErovians aims to make legal and platform content accessible in accordance with WCAG principles (perceivable, operable, understandable and robust) and Directive (EU) 2019/882 (European Accessibility Act) where applicable.`,
  },
  {
    id: "data-localization",
    title: "Data & Storage",
    icon: Lock,
    content: `Erovians implements a secure, GDPR-compliant approach to data storage and localization.\n\n**Data Storage**\nErovians may store data in multiple jurisdictions for performance and resilience purposes. All storage infrastructure is subject to GDPR principles, contractual safeguards, and internal security policies.\n\n**Retention by Category**\n— Account data: up to 5 years after account closure\n— Transaction and contractual data: up to 10 years (Luxembourg accounting obligations)\n— Chat and interaction logs: up to 5 years (dispute resolution and fraud prevention)\n— Security logs: 6 to 24 months\n— KYC/KYB data: as required by AML/CFT regulations\n\n**Security Measures**\nAll retained data is protected by encryption in transit (TLS) and at rest where applicable, role-based access control (RBAC), and monitoring in accordance with Article 32 GDPR.\n\n**Your Rights**\nUsers may request access, rectification, erasure, restriction, portability, or objection to processing by contacting DS@erovians.com — handled in accordance with Articles 12–22 GDPR. Complaints may be submitted to the CNPD (Luxembourg supervisory authority).`,
  },
];

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

export default function LocationsPage() {
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
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(200,169,110,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,110,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <Link to="/login" style={{
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
          <Globe size={11} />
          Luxembourg HQ · EU Compliant · Cross-Border
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          Global Presence
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 580,
          margin: "0 auto 2rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          Headquartered in Luxembourg — operating at the heart of European law to connect professionals worldwide with the highest standards of legal governance.
        </p>

        <div style={{
          display: "flex", justifyContent: "center", gap: "2.5rem",
          flexWrap: "wrap",
        }}>
          {[
            { val: "Luxembourg", label: "Jurisdiction" },
            { val: "CNPD", label: "Lead Authority" },
            { val: "EU", label: "Regulatory Standard" },
            { val: "French / EN", label: "DSA Language" },
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

          <div style={{
            marginTop: "1.5rem",
            padding: "0.85rem 1rem",
            background: "#fafaf7",
            border: "1px solid #e8e2d8",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <ShieldCheck size={13} color="#c8a96e" />
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Cross-Border Policy</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              GDPR · DSA · Brussels I · Rome I · Luxembourg Law
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