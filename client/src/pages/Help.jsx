import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, ClipboardList, Scale, Target, Archive,
  CheckSquare, Globe, Lock, Mail, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, Info, AlertCircle, Zap, Building2,
  Users, Shield, FileText, MessageSquare, UserCheck, Eye
} from "lucide-react";
import Footer from "../components/Footer";

const sections = [
  {
    id: "getting-started",
    title: "Getting Started",
    Icon: Zap,
    items: [
      {
        label: "How do I create an account?",
        desc: "Click the 'Register' button on the homepage, fill in your details, and verify your email via the OTP sent to your inbox. You can also sign up quickly using your Google account. By creating an account, you expressly accept the Erovians Terms of Service and all referenced policies. Continued use constitutes ongoing acceptance of any updates."
      },
      {
        label: "I forgot my password",
        desc: "Go to the Login page and click 'Forgot Password'. Enter your registered email or phone number to receive a secure reset link. You are responsible for maintaining the confidentiality of your credentials and for all activities conducted under your account."
      },
      {
        label: "What are the eligibility requirements?",
        desc: "Users must be legally capable of entering into binding agreements and must provide accurate information when registering. The Platform is primarily intended for professional, business, and legally capable Users. Minors may face restrictions on commercial transactions, professional seller features, KYC/KYB processes, and contractual negotiations."
      },
      {
        label: "What User statuses exist on the platform?",
        desc: "You may act as a Consumer User (a natural person acting outside a trade or profession), a Business User or Professional Seller (a legal entity or professional acting commercially), a Service Provider (offering design, fabrication, logistics, installation, consulting, or similar services), or a Representative or Agent acting on behalf of another person or entity. You must accurately declare your status when required by the Platform."
      }
    ]
  },
  {
    id: "verification",
    title: "Identity & KYC",
    Icon: UserCheck,
    intro: "To maintain a trusted environment, Erovians uses a risk-based, multi-level verification system (KYC/KYB) in accordance with GDPR, the Digital Services Act, and applicable Luxembourg AML/CFT regulations.",
    items: [
      {
        label: "What are the KYC verification levels?",
        desc: "Level 0 — Unverified: limited access to features. Level 1 — Basic Verification: email confirmation and minimal identity data. Level 2 — Identity Verification (KYC): government-issued ID and selfie or biometric verification where strictly necessary and lawful. Level 3 — Advanced Verification (KYB / Professional): company registration documents, VAT/business identification, and proof of authority. Level 4 — Enhanced Due Diligence (EDD): applied to high-risk Users or activities, with additional documentation and manual compliance review."
      },
      {
        label: "How do I increase my Trust Score?",
        desc: "Your Trust Score is based on signals including your verification level (KYC/KYB status), account age and consistency, profile completeness, verified professional credentials, transaction history, completed orders or projects, dispute and resolution history, moderation history, and user feedback and ratings. Trust indicators are platform governance signals only — they do not constitute guarantees of legal, technical, financial, or professional reliability."
      },
      {
        label: "Can Erovians refuse or downgrade my verification?",
        desc: "Yes. Erovians reserves the right to refuse verification, limit access to services, suspend accounts, or block high-risk transactions where information is incomplete or inconsistent, fraud is suspected, legal compliance cannot be ensured, or the User refuses required verification. Verification is also not a one-time process — Erovians may periodically re-verify Users and request updated documents."
      },
      {
        label: "How is my KYC data protected?",
        desc: "Sensitive verification data is encrypted, access-restricted, and logged when accessed. It is monitored for misuse in accordance with Article 32 GDPR. Erovians may rely on third-party verification providers, who must comply with GDPR, implement adequate safeguards, and act under data processing agreements."
      }
    ]
  },
  {
    id: "marketplace",
    title: "Marketplace & Transactions",
    Icon: Building2,
    intro: "Erovians acts strictly as a neutral intermediary. It does not guarantee the execution of agreements, the quality of services or goods exchanged, or the accuracy of User-provided information.",
    items: [
      {
        label: "How do I list a service or product?",
        desc: "Navigate to your Dashboard and select 'Create Listing'. Provide a clear title, description, and pricing. You must ensure that all commercial information is accurate, not misleading within the meaning of Directive 2005/29/EC (Unfair Commercial Practices), and supported by reasonable evidence where applicable. Sponsored content, partnerships, or self-promotion must clearly identify their commercial nature."
      },
      {
        label: "Are my payments secure?",
        desc: "All transactions are processed through regulated third-party payment gateways — your financial data is never stored directly on Erovians servers. Business Users engaging in commercial activity are subject to KYB verification and may be subject to transaction monitoring and sanctions checks where applicable under the platform's risk-based framework."
      },
      {
        label: "Can I conduct deals outside the platform?",
        desc: "No. Moving transactions or negotiations off-platform when initiated on Erovians is a material breach of the Terms of Service. This includes soliciting external contact details, agreeing to off-platform payment, or circumventing platform controls or fees. Breach may result in immediate account suspension and claims for damages. All communications and negotiations should be conducted through the Platform's governed tools."
      },
      {
        label: "What happens if a transaction goes wrong?",
        desc: "Users are encouraged to first attempt resolution through the Platform's communication tools and structured negotiation environment. Erovians may provide technical logs, timestamps, and interaction metadata to support dispute resolution. If internal resolution fails, Users may engage mediation, use competent ADR bodies, or refer the matter to DSA-certified out-of-court dispute settlement bodies. Final recourse is before Luxembourg courts."
      }
    ]
  },
  {
    id: "content-moderation",
    title: "Content & Moderation",
    Icon: Shield,
    intro: "Erovians operates a hybrid content moderation system — combining automated detection with trained human review — in full compliance with the EU Digital Services Act (DSA).",
    items: [
      {
        label: "What content is prohibited on the platform?",
        desc: "Users shall not publish illegal content or infringing materials, engage in harassment, threats, or hate speech, commit fraud or misrepresentation (including false credentials or endorsements), disseminate malware or attempt to compromise platform security, manipulate visibility or engagement systems (spam, bots, coordinated inauthentic behavior), or create, share, or promote content that harms, exploits, or misleads minors or vulnerable audiences."
      },
      {
        label: "How do I report illegal or harmful content?",
        desc: "Any natural or legal person may submit a notice regarding allegedly illegal content through the Platform's reporting tools. A valid notice must include: a substantiated explanation of why the content is illegal, the exact URL or identifier of the content, your name and contact details, and a good faith statement that the information is accurate. Erovians will act without undue delay upon obtaining actual knowledge of illegal content."
      },
      {
        label: "What happens after my content is moderated?",
        desc: "If your content is restricted or removed, Erovians will provide a statement of reasons including the type of action taken, the factual and legal basis, the territorial scope if geo-restricted, and available remedies — in accordance with Article 17 of the Digital Services Act. You may contest the decision through the internal complaint-handling system (DSA Article 20) and request human review for automated decisions under GDPR Article 22."
      },
      {
        label: "What is the repeat infringer policy?",
        desc: "Erovians applies a repeat infringer policy under Article 23 of the Digital Services Act. Recurrent violations may lead to escalated sanctions including warnings, content removal, feature limitations, temporary suspension, and permanent account termination. Abuse of moderation or reporting mechanisms (such as submitting manifestly unfounded notices) may also result in account sanctions."
      }
    ]
  },
  {
    id: "privacy-data",
    title: "Privacy & Your Data",
    Icon: Lock,
    intro: "Your personal data is processed in full accordance with Regulation (EU) 2016/679 (GDPR). Erovians acts as the data controller for all processing carried out through the Platform.",
    items: [
      {
        label: "What data does Erovians collect?",
        desc: "Erovians may process identity data (name, email, ID documents for KYC), usage data (navigation, interactions, preferences), technical data (IP address, device identifiers, logs), communication data (messages, support requests, negotiation chats), KYC/KYB verification data (company documents, beneficial ownership), and Trust & Reputation signals (verification level, transaction history, feedback, dispute history)."
      },
      {
        label: "How long is my data retained?",
        desc: "Account data is retained for the duration of your account and up to 5 years after closure. Transaction and contractual data is retained for up to 10 years in line with Luxembourg accounting obligations. Chat and interaction logs are retained for up to 5 years for dispute resolution. Security logs are typically retained 6 to 24 months. KYC/KYB data is retained as required by applicable AML/CFT regulations."
      },
      {
        label: "What are my GDPR rights?",
        desc: "You have the right to access your data (Article 15), rectification (Article 16), erasure / right to be forgotten (Article 17), restriction of processing (Article 18), data portability in a machine-readable format (Article 20), and objection to processing based on legitimate interests (Article 21). Where automated decisions significantly affect you, you have the right to request human intervention and contest the outcome under Article 22 GDPR. Submit requests to DS@erovians.com."
      },
      {
        label: "How do I delete my account or data?",
        desc: "You may request deletion or restriction of processing by contacting DS@erovians.com. Requests will be handled in accordance with Articles 12–23 GDPR. Note that certain data may be retained beyond your deletion request where required by law, for legal claims, or where a legal hold is active (such as an ongoing investigation or dispute). Erovians will inform you of any applicable exceptions."
      }
    ]
  },
  {
    id: "chat-messaging",
    title: "Chat & Messaging",
    Icon: MessageSquare,
    intro: "All communications conducted via the Platform are considered structured digital interactions — potentially contractual exchanges — that are traceable and timestamped.",
    items: [
      {
        label: "Are my messages private?",
        desc: "Access to message logs is strictly limited to authorized personnel, legal obligations, and competent authorities where required by law. Erovians implements appropriate technical and organizational measures to protect communications. However, messages may be logged including content, timestamps, user identifiers, and interaction metadata, in accordance with GDPR Articles 5 and 6."
      },
      {
        label: "Can my messages be used as evidence?",
        desc: "Yes. Users expressly acknowledge that messages exchanged via the Platform may constitute evidence, logs may be used in legal proceedings, and records may support contractual interpretation or dispute resolution. This applies subject to applicable evidentiary rules under Luxembourg law, including principles of written electronic evidence. Erovians maintains technical and transactional logs with timestamps and identifiers."
      },
      {
        label: "What is prohibited in the messaging system?",
        desc: "Users shall not use the messaging system to bypass the Platform to conduct off-platform transactions, exchange personal contact details to avoid Platform controls or fees, transmit unlawful, fraudulent, or misleading information, harass, threaten, or abuse other users, or attempt to manipulate contractual discussions or misrepresent technical or commercial data. Violations may result in messaging feature restrictions or account suspension."
      },
      {
        label: "Is my chat monitored?",
        desc: "The Platform may use automated systems to detect fraud or abuse, identify prohibited behavior, and flag suspicious patterns. Such processing is conducted in accordance with GDPR Article 22, and Users may request human review where applicable. By using the messaging system, Users consent to the recording and storage of communications for security, compliance, and dispute resolution purposes."
      }
    ]
  },
  {
    id: "account-security",
    title: "Account & Security",
    Icon: ShieldCheck,
    intro: "Erovians implements appropriate technical and organizational measures to ensure security in accordance with Article 32 GDPR. Users also have personal responsibilities for account security.",
    items: [
      {
        label: "Why was my account suspended?",
        desc: "Erovians may suspend, restrict, or terminate access where: the User violates the Terms of Service or any applicable policy, the User publishes or engages in illegal content or activities, fraud, misrepresentation, or abusive behavior is detected, there is a risk to the security or integrity of the Platform, or legal or regulatory obligations require action. Where required, Erovians will provide a statement of reasons and information on available remedies."
      },
      {
        label: "How do I appeal a suspension or moderation decision?",
        desc: "Users may contest enforcement decisions through the internal complaint-handling system in accordance with Article 20 of Regulation (EU) 2022/2065 (Digital Services Act). Erovians will review complaints and provide a reasoned response within a reasonable timeframe. For automated decisions that significantly affect you, you may also request human review under GDPR Article 22. Contact DS@erovians.com with your account details and grounds for appeal."
      },
      {
        label: "How does Erovians protect my account?",
        desc: "Security measures include encryption of data in transit (TLS) and at rest where applicable, secure authentication mechanisms, role-based access control (RBAC), network security monitoring and intrusion detection, and regular vulnerability assessments. In the event of a personal data breach likely to affect your rights, Erovians will notify you without undue delay in accordance with GDPR Article 34."
      },
      {
        label: "What are my security responsibilities as a User?",
        desc: "You are responsible for maintaining the confidentiality of your credentials, securing your devices and access points, and reporting any suspected security breach to Erovians. You shall not attempt to bypass security measures, scrape data, reverse engineer the Platform, or exploit vulnerabilities. Unauthorized access attempts may result in immediate suspension and referral to competent authorities."
      }
    ]
  },
  {
    id: "ai-trust",
    title: "AI & Trust System",
    Icon: Eye,
    intro: "Erovians uses AI as a support layer governed by GDPR, the Digital Services Act, and Regulation (EU) 2024/1689 (EU AI Act). AI does not replace human or legal judgment.",
    items: [
      {
        label: "How does Erovians use AI?",
        desc: "AI systems may be used for content recommendation and ranking, user support and platform assistance, fraud and anomaly detection, moderation assistance, trust and reputation analysis, search improvement and matching, translation and summarization of content, and internal risk assessment. AI outputs do not constitute legal advice, tax advice, professional certification, contractual approval, or guaranteed technical validation."
      },
      {
        label: "Can an AI decision affect my account?",
        desc: "Where AI-assisted decisions may significantly affect your account access, trust status, transaction capability, verification outcome, suspension, or commercial visibility — additional safeguards apply. These include human oversight, documentation, and the right to contest the decision. You may request human intervention, express your point of view, and contest any automated decision that produces significant effects under GDPR Article 22."
      },
      {
        label: "What is the Trust & Reputation System?",
        desc: "The Trust & Reputation System is a governance layer designed to increase safety, reduce fraud, and support professional credibility. It uses signals such as verification level, account age, profile completeness, transaction and dispute history, moderation history, user feedback, and fraud indicators. Trust indicators may influence visibility in search, access to advanced features, transaction limits, and messaging capabilities. They are governance signals only — not guarantees of reliability."
      },
      {
        label: "Can I challenge my Trust Score?",
        desc: "Yes. Users may request correction of inaccurate data affecting their trust profile. Where a trust indicator is affected by a dispute, moderation decision, or complaint, you may use the applicable appeal or dispute mechanism. Trust calculations may involve automated processing — where such processing produces significant effects, you may request human intervention under GDPR Article 22. Users must not manipulate trust signals through fake accounts, artificial reviews, or coordinated false feedback."
      }
    ]
  }
];

function renderContent(text) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/\*\*(.*?)\*\*/g).map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: "#0f1923", fontWeight: 650 }}>{part}</strong>
        : <span key={i}>{part}</span>
    );
    return <span key={lineIdx}>{parts}{lineIdx < lines.length - 1 && <br />}</span>;
  });
}

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [expandedItems, setExpandedItems] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleItem = (sectionId, idx) => {
    const key = `${sectionId}-${idx}`;
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
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
          <Info size={11} />
          Support · FAQ · Platform Guidelines
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          Help & Support
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 580,
          margin: "0 auto 2rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          Find answers to common questions about accounts, verification, marketplace, privacy, moderation, and platform governance.
        </p>

        {/* Stats row */}
        <div style={{
          display: "flex", justifyContent: "center", gap: "2.5rem",
          flexWrap: "wrap",
        }}>
          {[
            { val: "8", label: "Topic Areas" },
            { val: "DSA", label: "Compliant" },
            { val: "GDPR", label: "Protected" },
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
            TOPICS
          </p>

          {sections.map(({ id, title, Icon }) => {
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
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>DSA Compliant</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              Articles 11–12 · GDPR · AI Act · Luxembourg Law
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
                    <active.Icon size={18} color="#c8a96e" />
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
                      const open = expandedItems[k];
                      return (
                        <div key={idx} style={{
                          background: open ? "#faf9f6" : "#fff",
                          border: `1px solid ${open ? "#d4b87a" : "#e5e0d8"}`,
                          borderRadius: 10,
                          overflow: "hidden",
                          transition: "all 0.18s",
                        }}>
                          <button
                            onClick={() => toggleItem(active.id, idx)}
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