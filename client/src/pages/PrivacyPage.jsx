

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, ClipboardList, Scale, Target, Archive,
  CheckSquare, Globe, Lock, Mail, ChevronDown, ChevronUp,
  ArrowLeft, ArrowRight, Info, AlertCircle
} from "lucide-react";
import Footer from "../components/Footer";

const sections = [
  {
    id: "overview",
    title: "Overview",
    Icon: ShieldCheck,
    content: `This Privacy Policy is established in accordance with **Regulation (EU) 2016/679 (GDPR)**, notably Articles 5 (principles), 6 (lawfulness), 12–22 (data subject rights), 25 (data protection by design and by default), and 32 (security of processing), as well as applicable **Luxembourg data protection laws**.

**Erovians acts as the data controller** for the processing of all personal data carried out through the Platform. This means we determine the purposes and means of processing your personal data, and we are fully accountable for how it is handled.

This Policy applies to all users of the Erovians Platform — including social network features, marketplace interactions, AI systems, messaging tools, and user-generated content. By creating an account or using the Platform, you acknowledge that your personal data will be processed in accordance with this Policy.

Our data protection framework is built on four core principles:

**Transparency** — We tell you clearly what data we collect, why we collect it, and who we share it with.

**Lawfulness** — We only process your data when we have a valid legal basis to do so under the GDPR.

**Data Minimisation** — We collect only what is strictly necessary for the purpose for which it is processed.

**Security** — We implement appropriate technical and organisational measures to protect your data at all times.

If you have questions about this Policy or wish to exercise your rights, you may contact us at **DS@erovians.com**.`
  },
  {
    id: "data-collected",
    title: "Data We Collect",
    Icon: ClipboardList,
    intro: "Erovians may collect and process the following categories of personal data depending on how you use the Platform. We collect only what is necessary for the stated purposes in accordance with the data minimisation principle under Article 5(1)(c) GDPR.",
    items: [
      { label: "Identity Data", desc: "This includes your full name, email address, username, date of birth, nationality, and any identification documents submitted for KYC (Know Your Customer) or KYB (Know Your Business) verification purposes. For higher verification levels, this may include government-issued ID documents and, where strictly necessary and lawful, biometric or facial verification data. This data is used to confirm your identity, prevent fraud, and enable secure access to Platform features." },
      { label: "Usage Data", desc: "We collect information about how you navigate and interact with the Platform — including pages visited, features used, content viewed or posted, search queries, clicks, scrolling behaviour, time spent on sections, and preference settings. This data helps us understand how users engage with Erovians so we can improve functionality, personalise your experience, and detect unusual or potentially harmful behaviour." },
      { label: "Technical Data", desc: "Technical data includes your IP address, browser type and version, operating system, device identifiers, session tokens, referral URLs, and system log files. This data is collected automatically when you access the Platform and is used for security monitoring, fraud detection, intrusion detection, and to maintain the stability and performance of our services. Logs may also be used as evidence in legal proceedings under Luxembourg evidentiary law." },
      { label: "Communication Data", desc: "This includes all messages you send or receive through the Platform's messaging system, support requests submitted to Erovians, negotiation chats, and any other real-time or asynchronous communications conducted via Platform tools. All communications are structured digital interactions that are timestamped and logged. They may constitute contractual exchanges and may be used for dispute resolution, fraud prevention, and legal compliance in accordance with our Chat Policy." },
      { label: "KYC / KYB Verification Data", desc: "For users seeking verified professional or commercial status, or engaging in higher-risk activities, we may collect company registration documents, VAT and business identification numbers, proof of authority (such as director or representative documentation), beneficial ownership information, and transactional metadata. This data is processed under a risk-based multi-level verification system (Levels 0–4) and may involve automated risk scoring, sanctions checks, and manual compliance review where applicable." },
      { label: "Trust & Reputation Data", desc: "The Platform may process signals such as your verification level, account age, profile completeness, transaction history, completed orders or projects, dispute and moderation history, user feedback and ratings, and fraud or security indicators. These signals contribute to your Trust Score or Trust Level on the Platform, which may affect your visibility, access to features, transaction limits, and messaging capabilities. Trust indicators are governance signals only and do not constitute guarantees of reliability." },
      { label: "Special Categories of Data", desc: "Special categories of personal data (as defined in Article 9 GDPR) — such as biometric data used for identity verification — are only processed where strictly necessary, where a lawful basis under Article 9(2) GDPR applies, and where appropriate safeguards are in place. Erovians does not process special category data for advertising, profiling, or commercial purposes." },
    ]
  },
  {
    id: "legal-basis",
    title: "Legal Basis for Processing",
    Icon: Scale,
    intro: "Erovians processes your personal data only where a lawful basis exists under Article 6 of the GDPR. The applicable basis depends on the specific processing activity. Where special categories of data are involved, Article 9 GDPR also applies.",
    items: [
      { label: "Consent — Article 6(1)(a) GDPR", desc: "Where you have freely given, specific, informed, and unambiguous consent for a particular processing purpose — such as receiving marketing communications, accepting non-essential cookies, or permitting your data to be used for AI model improvement — we rely on consent as our legal basis. You may withdraw your consent at any time without affecting the lawfulness of processing carried out before withdrawal. Consent withdrawal can be exercised through your account settings or by contacting DS@erovians.com." },
      { label: "Contract Performance — Article 6(1)(b) GDPR", desc: "Processing is necessary for the performance of the contract between you and Erovians — specifically, the Terms of Service you accept when creating an account. This covers all processing activities required to provide Platform features, operate messaging systems, manage your account, facilitate transactions, and deliver the services you have requested. Without this processing, we cannot provide you with access to the Platform." },
      { label: "Legal Obligation — Article 6(1)(c) GDPR", desc: "Certain processing activities are required for Erovians to comply with applicable legal obligations under EU and Luxembourg law. This includes compliance with anti-money laundering (AML) and counter-terrorism financing (CFT) regulations, responding to lawful requests from competent authorities, fulfilling tax and accounting record-keeping obligations, and meeting notification requirements under the GDPR in the event of a data breach. We cannot exempt you from processing that is legally required." },
      { label: "Legitimate Interests — Article 6(1)(f) GDPR", desc: "Where processing is necessary for our legitimate interests — or those of a third party — and where those interests are not overridden by your rights and freedoms, we rely on this basis. Legitimate interests include: fraud detection and prevention, platform security and abuse monitoring, improving Platform features and reliability, maintaining logs for dispute resolution and evidentiary purposes, and sharing data with regulated partners under appropriate safeguards. We conduct a balancing test before relying on this basis." },
      { label: "Special Category Data — Article 9 GDPR", desc: "Where Erovians processes special categories of personal data — such as biometric data used for identity verification at KYC Level 2 — this is done only where an explicit legal basis under Article 9(2) GDPR applies, such as explicit consent (Article 9(2)(a)) or where processing is necessary for reasons of substantial public interest. Appropriate technical and organisational safeguards are applied in all cases, and the data is not used beyond the specific stated purpose." },
    ]
  },
  {
    id: "purposes",
    title: "Why We Use Your Data",
    Icon: Target,
    intro: "Erovians processes personal data for specific, explicit, and legitimate purposes as required by Article 5(1)(b) GDPR. Data is never used for purposes incompatible with those stated below.",
    items: [
      { label: "Platform Operation & Service Delivery", desc: "We use your data to provide, maintain, and operate all features of the Erovians Platform — including account management, social networking features, messaging tools, marketplace interactions, search and recommendations, AI-assisted matching, and content display. Without this processing, we cannot deliver the services you have requested. This includes managing your user profile, verifying your account status, processing interactions and transactions, and maintaining your session." },
      { label: "Security, Fraud Detection & Prevention", desc: "We use technical data, usage data, communication data, and trust signals to detect and prevent fraud, abuse, impersonation, unauthorised access, and other security threats. This includes automated anomaly detection, behavioral analysis, transaction monitoring, sanctions and watchlist checks where applicable, and incident response. Security logs may be retained for 6 to 24 months for these purposes. Where a personal data breach occurs, we comply with our notification obligations under GDPR Articles 33 and 34." },
      { label: "Legal Compliance & Regulatory Obligations", desc: "We process your data to fulfil our obligations under applicable EU and Luxembourg law — including the GDPR, the Digital Services Act (DSA), anti-money laundering regulations, Luxembourg commercial and evidentiary law, and sector-specific regulations. This includes maintaining records required for audit, cooperating with competent authorities upon lawful request, filing required reports, and responding to court orders. We may share data with regulatory bodies or law enforcement where legally required to do so." },
      { label: "User Communication & Support", desc: "We use your contact and communication data to respond to your queries, support requests, moderation appeals, and account-related notifications. This includes sending transactional emails regarding your account, security alerts, policy update notices, and responses to disputes or complaints. Where you have given consent, we may also send platform updates or promotional communications. You may opt out of non-essential communications at any time." },
      { label: "Content Moderation & Trust Governance", desc: "We process usage data, interaction logs, and content metadata to operate our content moderation system in compliance with the Digital Services Act. This includes automated detection of potentially illegal or policy-violating content, human review by trained moderators, issuing statements of reasons, managing appeals, and reporting to trusted flaggers and authorities where required. Moderation data may also contribute to your Trust Score and affect your visibility on the Platform." },
      { label: "AI-Assisted Features & Recommendations", desc: "Where AI systems are used for content recommendation, fraud detection, moderation assistance, search improvement, or trust analysis, your usage data and interaction history may be processed to personalise and improve these features. AI outputs do not constitute legal, professional, or contractual advice. Where AI-assisted decisions may materially affect you — such as account restriction or trust scoring — additional safeguards apply, including the right to request human review under GDPR Article 22." },
      { label: "Dispute Resolution & Evidentiary Purposes", desc: "Chat logs, timestamps, transaction records, and interaction metadata are retained and may be used to support dispute resolution between users, or in legal proceedings under Luxembourg evidentiary law. Erovians acts as a neutral intermediary and does not guarantee dispute outcomes. Data retained for this purpose is protected by appropriate technical and organisational measures and is subject to strict access controls." },
    ]
  },
  {
    id: "retention",
    title: "Data Retention",
    Icon: Archive,
    intro: "Erovians retains personal data only for as long as necessary for the purposes for which it is processed, in accordance with the storage limitation principle under Article 5(1)(e) GDPR. Retention periods vary by data category and applicable legal obligations.",
    items: [
      { label: "Account Data", desc: "Personal data associated with your account — including your name, email, profile information, and account settings — is retained for the full duration of your active account. Following account closure or deletion, account data is retained for up to 5 years for legal, evidentiary, and compliance purposes. This period reflects obligations under Luxembourg civil and commercial law, and allows Erovians to respond to disputes, regulatory enquiries, or legal claims that may arise after account closure." },
      { label: "Transaction & Contractual Data", desc: "Data relating to transactions, negotiations, commercial interactions, and contractual exchanges conducted through the Platform is retained for up to 10 years from the date of the transaction or agreement. This retention period reflects Luxembourg accounting obligations, commercial law requirements, and tax record-keeping duties. Transaction logs may also be used as evidence in legal disputes or regulatory proceedings during this period." },
      { label: "Chat & Interaction Logs", desc: "Messages, negotiation chats, and interaction metadata exchanged through the Platform's messaging system are retained for up to 5 years. This period supports dispute resolution between users, fraud prevention, and the evidentiary use of communications under Luxembourg law. Users are informed of this logging when using messaging features. Access to message logs is strictly limited to authorised personnel, legal obligations, and competent authorities where required by law." },
      { label: "Security & System Logs", desc: "Technical and security logs — including IP addresses, access records, session data, and system events — are typically retained for 6 to 24 months, depending on risk level, system requirements, and applicable cybersecurity obligations. These logs are used for fraud detection, incident investigation, vulnerability assessment, and legal compliance. Retention may be extended where required by an ongoing investigation or legal hold." },
      { label: "KYC / KYB Verification Data", desc: "Identity verification documents, biometric data (where applicable), business registration documents, and AML/CFT-related records are retained for as long as required by applicable anti-money laundering regulations, fraud prevention obligations, and audit requirements. Retention follows Article 5(1)(e) GDPR and the specific requirements of the verification level applied. Access to KYC data is encrypted, access-restricted, and logged when accessed." },
      { label: "Deletion, Anonymisation & Legal Holds", desc: "Upon expiration of the applicable retention period, personal data is either permanently deleted or irreversibly anonymised where retention for statistical or analytical purposes is justified. Deletion processes are implemented in accordance with your right to erasure under Article 17 GDPR, subject to legal retention exceptions. Where a dispute, investigation, or legal proceeding is ongoing, Erovians may activate a legal hold to preserve relevant records beyond standard retention periods. Users may request deletion or restriction of processing, subject to applicable legal obligations." },
    ]
  },
  {
    id: "your-rights",
    title: "Your Rights",
    Icon: CheckSquare,
    intro: "Under the GDPR (Articles 12–22), you have the following rights in relation to your personal data. Erovians will respond to all valid requests within one month, extendable by a further two months where necessary due to complexity. Requests can be submitted to DS@erovians.com. We may need to verify your identity before processing your request.",
    items: [
      { label: "Right of Access — Article 15 GDPR", desc: "You have the right to obtain confirmation of whether Erovians processes personal data about you, and if so, to receive a copy of that data along with information about: the purposes of processing, the categories of data processed, recipients or categories of recipients, the applicable retention period, and your other rights under the GDPR. The first copy is provided free of charge. Additional copies may be subject to a reasonable administrative fee. Your request must not adversely affect the rights and freedoms of others." },
      { label: "Right to Rectification — Article 16 GDPR", desc: "If any personal data we hold about you is inaccurate or incomplete, you have the right to request that we correct or complete it without undue delay. You may update some of your personal data directly through your account settings. Where rectification is not possible through self-service, you may contact us at DS@erovians.com. Rectification requests will be processed promptly and we will inform relevant third parties where the data has been shared, where feasible." },
      { label: "Right to Erasure — Article 17 GDPR", desc: "You have the right to request deletion of your personal data — also known as the 'right to be forgotten' — where: the data is no longer necessary for the purposes it was collected; you withdraw consent and there is no other lawful basis; you object to processing and there are no overriding legitimate grounds; the data has been unlawfully processed; or deletion is required to comply with a legal obligation. This right is not absolute — we may retain data where required by law, for legal claims, or for compliance with a legal obligation. We will inform you of any applicable exceptions." },
      { label: "Right to Restriction — Article 18 GDPR", desc: "You may request that we restrict the processing of your personal data in specific circumstances: if you contest the accuracy of the data (while we verify it); if processing is unlawful but you prefer restriction over erasure; if we no longer need the data but you require it for legal claims; or if you have objected to processing pending verification of our legitimate grounds. During restriction, we will only store your data and will not process it further without your consent, except for legal claims, protection of third parties, or reasons of important public interest." },
      { label: "Right to Data Portability — Article 20 GDPR", desc: "Where processing is based on consent or contract, and is carried out by automated means, you have the right to receive the personal data you have provided to us in a structured, commonly used, and machine-readable format (such as JSON or CSV). You also have the right to request that we transmit this data directly to another controller where technically feasible. This right applies to data you have actively provided — it does not cover data derived or inferred by Erovians, or data processed under other legal bases." },
      { label: "Right to Object — Article 21 GDPR", desc: "You have the right to object at any time to processing of your personal data where we rely on legitimate interests (Article 6(1)(f)) or public interest as our legal basis — including profiling based on those grounds. Upon receiving your objection, we will cease processing unless we can demonstrate compelling legitimate grounds that override your interests, rights, and freedoms, or where processing is necessary for legal claims. You also have an absolute right to object to processing for direct marketing purposes, including profiling related to direct marketing." },
      { label: "Rights Related to Automated Decision-Making — Article 22 GDPR", desc: "Where Erovians uses automated systems — including AI-assisted tools — to make decisions that produce legal or similarly significant effects on you (such as account restriction, trust scoring, or verification outcomes), you have the right to: request human intervention in the decision; express your point of view; contest the automated decision; and request correction of inaccurate data used in the decision. Erovians implements human oversight for significant automated decisions and maintains an internal appeal mechanism for contesting such decisions." },
      { label: "Right to Lodge a Complaint — Article 77 GDPR", desc: "If you believe that Erovians has processed your personal data in violation of the GDPR, you have the right to lodge a complaint with the competent supervisory authority. In Luxembourg, this is the Commission Nationale pour la Protection des Données (CNPD), which can be contacted at www.cnpd.lu. You may also contact the supervisory authority in your country of residence or place of work. Filing a complaint does not affect your right to seek judicial remedies." },
    ]
  },
  {
    id: "international",
    title: "International Transfers",
    Icon: Globe,
    content: `Erovians is based in the Grand Duchy of Luxembourg and primarily processes your personal data within the European Economic Area (EEA). However, for operational purposes — including the use of third-party cloud infrastructure, service providers, or processing partners — your personal data may be transferred to countries outside the EEA.

**Legal Framework — Chapter V GDPR (Articles 44–50)**

All international transfers of personal data are governed by Chapter V of the GDPR. Erovians does not transfer personal data to a third country unless one of the following safeguards is in place:

**Adequacy Decisions** — Where the European Commission has determined that a third country provides an adequate level of data protection, transfers may take place without further safeguards. Erovians monitors the current list of adequacy decisions and applies them where applicable.

**Standard Contractual Clauses (SCCs)** — Where no adequacy decision exists, Erovians uses the Standard Contractual Clauses approved by the European Commission (as updated in June 2021) in contracts with processors and sub-processors located in third countries. These clauses impose legally binding data protection obligations on the recipient.

**Appropriate Safeguards** — In specific cases, Erovians may rely on other appropriate safeguards under Article 46 GDPR, such as binding corporate rules or approved codes of conduct, where applicable.

**Data Localisation & Access Controls**

Erovians may store data across multiple jurisdictions for performance, resilience, and redundancy purposes. Regardless of where data is stored, access is strictly governed by internal security policies, GDPR principles, and contractual safeguards with all processing partners.

You have the right to request information about the specific safeguards applied to any international transfer of your data. Please contact us at **DS@erovians.com** for further details.`
  },
  {
    id: "security",
    title: "How We Protect Your Data",
    Icon: Lock,
    intro: "Erovians implements appropriate technical and organisational measures to ensure a level of security appropriate to the risk of processing, in accordance with Article 32 GDPR. Security is integrated into our systems by design and by default, in line with Article 25 GDPR.",
    items: [
      { label: "Encryption", desc: "All data transmitted between your device and the Erovians Platform is encrypted using TLS (Transport Layer Security). Personal data stored at rest is encrypted where technically appropriate, with particular attention to sensitive categories such as KYC documents, biometric data, and identity records. Encryption keys are managed securely and access is strictly controlled." },
      { label: "Access Control & Role-Based Permissions", desc: "Access to personal data and sensitive systems is strictly limited using role-based access control (RBAC). Only authorised personnel with a legitimate operational need may access personal data, and all access is logged and periodically reviewed. Access rights are revoked immediately upon change of role, departure, or when no longer required. KYC data, message records, trust scores, and security logs are subject to the most restrictive access controls." },
      { label: "Security Monitoring & Intrusion Detection", desc: "The Platform maintains continuous security monitoring, including network traffic analysis, anomaly detection, intrusion detection systems, and vulnerability scanning. Security events are logged and reviewed by authorised personnel. Where suspicious activity is detected, our incident response procedures are activated. Regular vulnerability assessments and security reviews are conducted to identify and address risks proactively." },
      { label: "Data Protection by Design & by Default", desc: "Security and privacy considerations are integrated into the design of all new features and systems from the outset, in accordance with Article 25 GDPR. This includes data minimisation (collecting only what is necessary), limiting access rights to the minimum required, using secure system configurations as the default, and conducting Data Protection Impact Assessments (DPIAs) before launching high-risk processing activities." },
      { label: "Third-Party & Processor Security", desc: "Where Erovians engages third-party service providers who process personal data on our behalf, those providers are required to implement appropriate security standards, comply with applicable data protection regulations, operate under a Data Processing Agreement (DPA) as required by Article 28 GDPR, and support audit and security requirements. We conduct due diligence on processors before engagement and monitor their compliance on an ongoing basis." },
      { label: "Incident Response & Breach Notification", desc: "Erovians maintains documented procedures for detecting, assessing, containing, and mitigating security incidents. In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, Erovians will notify the CNPD (Luxembourg supervisory authority) within 72 hours of becoming aware of the breach, in accordance with Article 33 GDPR. Where the breach is likely to result in a high risk to you personally, we will also notify you directly without undue delay, in accordance with Article 34 GDPR." },
      { label: "Business Continuity & Recovery", desc: "Erovians maintains backup systems, recovery procedures, and system redundancy where applicable to ensure service continuity and data availability. Recovery objectives are defined internally and reviewed periodically. Backup data is subject to the same security standards as primary data, including encryption and access controls." },
    ]
  },
  {
    id: "contact",
    title: "Contact & Complaints",
    Icon: Mail,
    content: `**How to Contact Erovians**

If you wish to exercise any of your rights under the GDPR, have a question about this Privacy Policy, or want to raise a concern about how your personal data is being processed, please contact us at:

**DSA & Data Protection Contact Point**
Email: **DS@erovians.com**
Accepted languages: French (primary), English (where operationally appropriate)
Platform: Erovians, operated by a Luxembourg-based legal entity

We will acknowledge your request without undue delay and respond within **one month** of receipt. Where your request is complex or numerous, we may extend this period by a further two months and will inform you accordingly.

**What to include in your request:**
Please include your full name, email address associated with your account, a clear description of your request or concern, and any supporting information that may help us process your request efficiently.

**Verification of Identity**
For requests relating to access, erasure, portability, or other rights affecting your personal data, we may need to verify your identity before processing the request. This is to protect your data from unauthorised access and ensures that we only disclose information to the rightful data subject.

**Right to Lodge a Complaint — CNPD**

If you are not satisfied with our response, or believe that Erovians has processed your personal data in violation of the GDPR, you have the right to lodge a complaint with the competent data protection supervisory authority:

**Commission Nationale pour la Protection des Données (CNPD)**
Luxembourg Data Protection Authority
Website: www.cnpd.lu

You may also contact the supervisory authority in your country of habitual residence or place of work if you are located in another EU Member State. Filing a complaint with a supervisory authority does not affect your right to seek judicial remedies before the competent courts.

**Governing Law**

This Privacy Policy and all data processing carried out by Erovians is governed by the laws of the **Grand Duchy of Luxembourg** and applicable EU regulations, including Regulation (EU) 2016/679 (GDPR) and Regulation (EU) 2022/2065 (Digital Services Act).`
  },
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

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [expandedItems, setExpandedItems] = useState({});

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
          <ShieldCheck size={11} />
          GDPR Compliant · Luxembourg Law · DSA Compliant
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          Privacy Policy
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 580,
          margin: "0 auto 2rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          How Erovians collects, uses, protects, and retains your personal data — in full compliance with the GDPR and Luxembourg law.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
          {[
            { val: "9", label: "Sections" },
            { val: "GDPR", label: "Art. 5–22" },
            { val: "DSA", label: "Compliant" },
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
        gridTemplateColumns: "280px 1fr",
        gap: "1.75rem",
        alignItems: "start",
        width: "100%",
        boxSizing: "border-box",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
          position: "sticky",
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
          }}>SECTIONS</p>

          {sections.map(({ id, title, Icon }) => {
            const isActive = activeSection === id;
            return (
              <button key={id} onClick={() => setActiveSection(id)} style={{
                width: "100%", textAlign: "left",
                padding: "0.7rem 0.9rem", borderRadius: 9,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13.5, fontFamily: "system-ui, sans-serif",
                background: isActive ? "#0f1923" : "transparent",
                color: isActive ? "#c8a96e" : "#555",
                fontWeight: isActive ? 600 : 400,
                marginBottom: 2, transition: "all 0.15s",
              }}>
                <Icon size={14} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.5 }} />
                <span>{title}</span>
              </button>
            );
          })}

          <div style={{
            marginTop: "1.5rem", padding: "0.85rem 1rem",
            background: "#fafaf7", border: "1px solid #e8e2d8", borderRadius: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <ShieldCheck size={13} color="#c8a96e" />
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Data Protection</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              GDPR · CNPD · DSA · Luxembourg Law
            </p>
          </div>
        </aside>

        {/* ── CONTENT PANEL ── */}
        <main>
          <div style={{
            background: "#fff", border: "1px solid #e2ddd4",
            borderRadius: 16, padding: "2.5rem 3rem",
            minHeight: 460, boxShadow: "0 2px 16px rgba(15,25,35,0.06)",
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
                    {(() => { const Icon = active.Icon; return <Icon size={18} color="#c8a96e" />; })()}
                  </div>
                  <div>
                    <h2 style={{
                      fontFamily: "'Georgia', serif", fontSize: "1.45rem",
                      fontWeight: 400, color: "#0f1923", margin: 0, letterSpacing: "-0.02em",
                    }}>{active.title}</h2>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#aaa", fontFamily: "system-ui, sans-serif" }}>
                      Section {activeIdx + 1} of {sections.length}
                    </p>
                  </div>
                </div>

                {active.intro && (
                  <div style={{
                    background: "#faf7f0", border: "1px solid #e8d5a3",
                    borderLeft: "3px solid #c8a96e", borderRadius: "0 10px 10px 0",
                    padding: "0.9rem 1.25rem", marginBottom: "1.5rem",
                    color: "#5a4a2a", fontSize: 13.5, lineHeight: 1.8,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                      <Info size={14} color="#c8a96e" style={{ flexShrink: 0, marginTop: 3 }} />
                      <span>{active.intro}</span>
                    </div>
                  </div>
                )}

                {active.content && (
                  <div style={{ color: "#2a3540", lineHeight: 2, fontSize: 14.5, fontFamily: "system-ui, sans-serif" }}>
                    {renderContent(active.content)}
                  </div>
                )}

                {active.items && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {active.items.map((item, idx) => {
                      const k = `${active.id}-${idx}`;
                      const open = expandedItems[k];
                      return (
                        <div key={idx} style={{
                          background: open ? "#faf9f6" : "#fff",
                          border: `1px solid ${open ? "#d4b87a" : "#e5e0d8"}`,
                          borderRadius: 10, overflow: "hidden", transition: "all 0.18s",
                        }}>
                          <button onClick={() => toggleItem(active.id, idx)} style={{
                            width: "100%", display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "0.85rem 1.2rem",
                            background: "transparent", border: "none", cursor: "pointer",
                            color: "#0f1923", fontFamily: "system-ui, sans-serif",
                            fontSize: 13.5, fontWeight: 500, textAlign: "left",
                          }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: "50%",
                                background: open ? "#c8a96e" : "#ccc",
                                display: "inline-block", flexShrink: 0, transition: "background 0.2s",
                              }} />
                              {item.label}
                            </span>
                            <span style={{
                              fontSize: 17, color: open ? "#c8a96e" : "#bbb",
                              lineHeight: 1, fontFamily: "system-ui", transition: "color 0.2s",
                            }}>
                              {open ? "−" : "+"}
                            </span>
                          </button>
                          {open && (
                            <div style={{
                              padding: "0.65rem 1.2rem 1.1rem", color: "#3a4a55",
                              fontSize: 13.5, lineHeight: 1.85,
                              borderTop: "1px solid #f0ebe0", fontFamily: "system-ui, sans-serif",
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
            <button disabled={!prev} onClick={() => prev && setActiveSection(prev.id)} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#fff", border: "1px solid #e2ddd4", borderRadius: 9,
              padding: "9px 20px", color: prev ? "#444" : "#ccc",
              cursor: prev ? "pointer" : "default", fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              boxShadow: prev ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
            }}>
              <ArrowLeft size={14} />
              {prev ? prev.title : "Previous"}
            </button>
            <button disabled={!next} onClick={() => next && setActiveSection(next.id)} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: next ? "#0f1923" : "#fff",
              border: `1px solid ${next ? "#0f1923" : "#e2ddd4"}`,
              borderRadius: 9, padding: "9px 20px",
              color: next ? "#c8a96e" : "#ccc",
              cursor: next ? "pointer" : "default", fontSize: 13,
              fontFamily: "system-ui, sans-serif",
              boxShadow: next ? "0 2px 8px rgba(15,25,35,0.15)" : "none",
            }}>
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