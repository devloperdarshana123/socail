
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mail, ArrowLeft, ArrowRight, Info,
  ShieldCheck, Scale, Users, Globe, Lock,
  Building2, AlertCircle, FileText, MessageSquare, Phone
} from "lucide-react";
import Footer from "../components/Footer";

// ─── DATA FROM PDF ────────────────────────────────────────────────────────────

const sections = [
  {
    id: "support",
    title: "General Support",
    icon: MessageSquare,
    content: `Need help with your account, a transaction, or a platform feature? Our support team is here to assist you.\n\n**Email Support**\nFor all general inquiries, please email us at: **support@erovians.com**\n\nWe aim to respond to all standard support tickets within 24–48 hours. For faster resolution, please include your registered email address and a clear description of your issue.\n\n**What We Can Help With**\nAccount access and settings, transaction questions, verification (KYC/KYB) guidance, platform features, and technical issues.\n\n**User Responsibility**\nBefore contacting support, please review the relevant policy in our Legal Framework. Users are solely responsible for the accuracy of information they provide and for conducting their own due diligence before entering into any agreement on the Platform.`,
  },
  {
    id: "dsa",
    title: "DSA Single Point of Contact",
    icon: Scale,
    content: `Erovians maintains a dedicated contact point for all Digital Services Act (DSA) communications, in accordance with Regulation (EU) 2022/2065, Articles 11 and 12.\n\n**DSA Contact**\n**DS@erovians.com**\n\n**Designated Language**\nFrench is the designated language for DSA communications. English may be accepted where operationally appropriate.\n\n**Who Can Use This Channel**\nCompetent authorities submitting DSA-related notices, Users with complaints concerning DSA rights, Trusted Flaggers under Article 22 of Regulation (EU) 2022/2065, follow-up on content restriction or statements of reasons, and moderation decision questions.\n\n**What Happens Next**\nUpon receipt, Erovians records the date and time, identifies the sender and legal basis, classifies the request, assigns an internal owner, and acknowledges receipt where appropriate. High-risk matters are escalated to legal, data protection, or senior governance review.`,
  },
  {
    id: "privacy",
    title: "Legal & Data Protection",
    icon: Lock,
    content: `For all matters relating to personal data, GDPR rights, and privacy compliance, please use our dedicated data protection channel.\n\n**Data Protection Contact**\n**DS@erovians.com**\n\n**Your GDPR Rights**\nUnder Regulation (EU) 2016/679 (GDPR), you have the right to: access your data (Article 15), rectification (Article 16), erasure (Article 17), restriction of processing (Article 18), data portability (Article 20), and objection (Article 21).\n\n**Automated Decision Review**\nIf an automated decision has materially affected your account, visibility, or access, you have the right to request human intervention, express your point of view, and contest the outcome under GDPR Article 22.\n\n**Supervisory Authority**\nIf your concern is not resolved, you have the right to lodge a complaint with the Luxembourg data protection authority: **Commission Nationale pour la Protection des Données (CNPD)**.`,
  },
  {
    id: "moderation",
    title: "Content & Moderation",
    icon: ShieldCheck,
    content: `To report illegal content, request a statement of reasons for a moderation decision, or submit a counter-notice, please use the in-platform reporting tools or the contact channel below.\n\n**Reporting Illegal Content**\nAny natural or legal person may submit a notice regarding allegedly illegal content. A valid notice must include:\n• A substantiated explanation of why the content is illegal\n• The exact electronic location (URL or identifier)\n• Your name and contact details\n• A good faith statement that the information is accurate\n\n**After You Report**\nErovians will acknowledge receipt, assess whether the notice is complete and credible, and act without undue delay where actual knowledge of illegal content is obtained. You will receive a statement of reasons for any action taken (DSA Article 17).\n\n**Appeals**\nIf your content was restricted or removed, you may submit a counter-notice with grounds for contestation. Erovians will provide a reasoned response. You may also refer unresolved DSA content disputes to a certified out-of-court dispute settlement body.`,
  },
  {
    id: "disputes",
    title: "Dispute Resolution",
    icon: FileText,
    content: `Erovians provides structured tools for resolving disputes between Users. The platform acts strictly as a neutral intermediary and is not a party to agreements between Users.\n\n**Internal Resolution First**\nUsers are encouraged to first attempt resolution through the platform's communication tools and structured negotiation environment. Erovians may intervene in a neutral capacity where appropriate.\n\n**Evidence Available**\nIn the event of a dispute, the following platform records may be used as evidence: chat logs and timestamps, interaction metadata, transaction-related data. These are maintained in accordance with GDPR and Luxembourg evidentiary law.\n\n**Escalation Path**\nIf internal resolution fails, Users may engage mediation, use competent alternative dispute resolution (ADR) bodies, or refer the matter to DSA-certified out-of-court dispute settlement bodies for content moderation disputes. Final recourse is before the competent courts in Luxembourg, subject to mandatory consumer protection rules.\n\n**Contact for Dispute Support**\n**support@erovians.com**`,
  },
  {
    id: "business",
    title: "Business & Partnerships",
    icon: Building2,
    content: `Interested in partnering with Erovians, exploring B2B solutions, or discussing enterprise access?\n\n**Business Inquiries**\nFor enterprise solutions, API access, or strategic partnerships:\n**business@erovians.com**\n\n**KYB Verification for Businesses**\nBusiness Users are subject to Know Your Business (KYB) verification, which may include company registration documents, VAT or business identification, and proof of authority (director, representative, or authorized agent). KYB is required to access commercial features and verified professional status.\n\n**User Status Declaration**\nBusiness Users must accurately declare their status on the Platform. Professional Users must not present themselves as consumers to avoid legal obligations or platform controls. False declaration may result in account restriction, transaction blocking, or suspension.\n\n**Cross-Border Operations**\nErovians supports cross-border interactions across the EU and globally. The contractual relationship is governed by Luxembourg law. For consumer Users, mandatory consumer protection rules of the country of habitual residence apply where required by law.`,
  },
  {
    id: "legal-notice",
    title: "Legal Notice",
    icon: Globe,
    content: `**Publisher**\nThe Platform is operated by a Luxembourg-based legal entity registered with the Registre de Commerce et des Sociétés (RCS Luxembourg).\n\n**Applicable Law**\nAll services are governed by the laws of the Grand Duchy of Luxembourg. Any dispute shall fall under the exclusive jurisdiction of Luxembourg courts, subject to mandatory consumer protection rules where applicable.\n\n**Liability**\nErovians acts as a hosting provider and benefits from liability exemptions under Directive 2000/31/EC and Regulation (EU) 2022/2065 (Digital Services Act), subject to compliance with notice-and-action obligations. Erovians shall not be liable for User Content, indirect or consequential damages, or loss of data or business opportunities not resulting from gross negligence or willful misconduct.\n\n**Legal Correspondence**\nFor formal legal notices and regulatory correspondence, please direct communications to the official contact address. Erovians will acknowledge legally substantiated requests and respond within a reasonable timeframe, taking into account urgency and legal obligations.`,
  },
];

// ─── RENDER HELPER ────────────────────────────────────────────────────────────

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

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
          <Mail size={11} />
          Support · DSA Contact · Legal & Privacy · Disputes
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          Contact Erovians
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 560,
          margin: "0 auto 2.5rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          Get in touch with the right team — whether it's general support, a DSA notice,
          a data protection request, or a business inquiry.
        </p>

        {/* Quick contact cards */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "1rem",
          flexWrap: "wrap", maxWidth: 720, margin: "0 auto",
        }}>
          {[
            { label: "General Support", val: "support@erovians.com", icon: MessageSquare },
            { label: "DSA & Legal", val: "DS@erovians.com", icon: Scale },
            { label: "Business", val: "business@erovians.com", icon: Building2 },
          ].map(({ label, val, icon: Icon }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(200,169,110,0.2)",
              borderRadius: 10,
              padding: "0.85rem 1.25rem",
              textAlign: "left",
              minWidth: 200,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                <Icon size={12} color="#c8a96e" />
                <span style={{ fontSize: 10, color: "#c8a96e", fontFamily: "system-ui, sans-serif", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#d4c9b0", fontFamily: "system-ui, sans-serif" }}>{val}</div>
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
            CONTACT TOPICS
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

          {/* DSA badge */}
          <div style={{
            marginTop: "1.5rem",
            padding: "0.85rem 1rem",
            background: "#fafaf7",
            border: "1px solid #e8e2d8",
            borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <ShieldCheck size={13} color="#c8a96e" />
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>DSA Compliant</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              Single point of contact per Articles 11–12, Regulation (EU) 2022/2065
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