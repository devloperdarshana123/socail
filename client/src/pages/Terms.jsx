

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText, Users, ShieldAlert, Ban, UserCheck, Cpu,
  AlertTriangle, Scale, Gavel, Globe, RefreshCw, Info,
  ChevronDown, ChevronUp, ArrowLeft, ArrowRight, ScrollText, ShieldCheck
} from "lucide-react";
import Footer from "../components/Footer";

const sections = [
  {
    id: "overview",
    title: "Overview & Acceptance",
    Icon: FileText,
    content: `These Terms of Service ("Terms") constitute a legally binding agreement between you ("User") and Erovians, a Luxembourg-based platform operator. By creating an account or using the Platform in any way, you expressly accept these Terms and all referenced policies. **Continued use of the Platform constitutes ongoing acceptance of any updates.**

**What is the Erovians Platform?**

The Platform means the Erovians digital service including social networking features, messaging and chat tools, AI-assisted features, marketplace interactions, user-generated content systems, and all related tools and functionalities provided by Erovians.

**Key Definitions:**

**"Platform"** — The Erovians digital service including all social, messaging, AI, and marketplace features.

**"User"** — Any natural or legal person accessing or using the Platform, whether as a consumer, professional, business, or representative.

**"Content"** — Any data, text, images, files, messages, or materials submitted or made available by Users on the Platform.

**"Services"** — All functionalities provided by Erovians, including free and premium features.

**Platform Status — Neutral Intermediary**

Erovians acts solely as a **neutral intermediary and hosting provider** in accordance with Directive 2000/31/EC on electronic commerce and Regulation (EU) 2022/2065 (Digital Services Act). Erovians does not initiate, select, or modify Content transmitted or stored by Users, except as required for technical operation or legal compliance.

This means Erovians is not a party to agreements between Users, does not guarantee the accuracy or legality of User Content, and benefits from liability exemptions applicable to hosting providers — subject to compliance with its notice-and-action obligations under the DSA.

These Terms, together with all referenced policies (Privacy Policy, Cookie Policy, Code of Conduct, Content Moderation Policy, Chat Policy, UGC Policy, and others), constitute the **entire agreement** between the User and Erovians.`
  },
  {
    id: "eligibility",
    title: "Eligibility & Account",
    Icon: UserCheck,
    intro: "To create an account and use the Platform, Users must meet the following eligibility requirements. Erovians reserves the right to verify eligibility at any time and to restrict or terminate access where these requirements are not met.",
    items: [
      {
        label: "Legal Capacity",
        desc: "Users must be legally capable of entering into binding contracts under applicable law. The Platform is primarily intended for professional, business, and legally capable users. Minors are subject to restrictions under the Children / Minors Policy. Where access by minors is legally permitted, verifiable parental or guardian consent may be required. Users must meet the minimum age required under applicable law in their jurisdiction to create an account."
      },
      {
        label: "Accurate Registration Information",
        desc: "Users must provide accurate, complete, and up-to-date information when creating an account. This includes your name, email address, and any other information required during the registration process or subsequent KYC/KYB verification. Providing false, misleading, or incomplete information constitutes a material breach of these Terms and may result in immediate account suspension or termination, as well as potential legal liability."
      },
      {
        label: "Account Security & Confidentiality",
        desc: "Users are solely responsible for maintaining the confidentiality of their login credentials — including username and password — and for all activities conducted under their account. You must not share your credentials with any third party. If you suspect unauthorised access to your account or a security breach, you must notify Erovians immediately at DS@erovians.com. Erovians shall not be liable for losses arising from unauthorised use of your account where you have failed to maintain credential security."
      },
      {
        label: "User Status Declaration",
        desc: "Users must accurately declare their status when required by the Platform — whether as a Consumer User, Business User, Professional Seller, Service Provider, or Representative / Agent. Professional users must not misrepresent themselves as consumers to avoid legal obligations or platform controls. User status affects applicable consumer rights, required legal disclosures, tax and invoicing obligations, KYC/KYB requirements, access to commercial features, and dispute resolution rights."
      },
      {
        label: "One Account Policy",
        desc: "Each user is permitted to maintain one active account unless Erovians expressly authorises otherwise. Creating multiple accounts to circumvent restrictions, suspensions, or platform controls is strictly prohibited and constitutes a material breach of these Terms. Erovians may use automated and manual tools to detect duplicate accounts and may terminate all associated accounts where this policy is violated."
      },
    ]
  },
  {
    id: "permitted-use",
    title: "Permitted Use",
    Icon: Users,
    intro: "Users may use the Platform for lawful purposes in accordance with these Terms and all applicable laws. The following sets out the general framework for permitted use of the Erovians Platform.",
    items: [
      {
        label: "General Lawful Use",
        desc: "Users shall use the Platform in full compliance with applicable EU and Luxembourg laws, these Terms, and all referenced policies. Permitted uses include creating and sharing professional or personal content, engaging in social interactions, conducting marketplace activities, using messaging features for legitimate communications, and accessing AI-assisted tools for lawful purposes. Any use that harms the Platform, other users, or third parties is prohibited."
      },
      {
        label: "Professional & Commercial Use",
        desc: "Business Users and Professional Sellers may use the Platform for commercial purposes, including listing products or services, engaging in professional networking, and conducting marketplace transactions, provided they comply with applicable commercial laws, consumer protection rules, and platform policies. Commercial communications must clearly identify their commercial nature, disclose material relationships (e.g., paid promotions), and avoid misleading claims within the meaning of Directive 2005/29/EC on unfair commercial practices."
      },
      {
        label: "User-Generated Content",
        desc: "Users retain full ownership of the Content they create and publish on the Platform. By posting Content, Users grant Erovians a worldwide, non-exclusive, royalty-free, transferable and sublicensable licence to host, store, reproduce, modify (for technical purposes only), distribute, display, and analyse such Content for the purposes of operating, improving, securing, and promoting the Platform. This licence remains valid for as long as the Content is available on the Platform and for any legally required retention period. Users warrant that they own or have all lawful rights to the Content they post."
      },
      {
        label: "AI & Automated Features",
        desc: "The Platform may use automated systems, including AI, to curate content, detect risks, support moderation, personalise recommendations, assist with matching, and analyse trust and reputation signals. No guarantee is given regarding the accuracy, completeness, or outcomes of AI-generated outputs. AI outputs do not constitute legal, professional, contractual, or technical advice. Users remain solely responsible for independent verification before relying on any AI-generated output. Where AI-assisted decisions may materially affect your account or access, you have the right to request human review."
      },
      {
        label: "Platform Logs & Evidence",
        desc: "Erovians maintains technical and transactional logs — including timestamps, user identifiers, and interaction records — in accordance with Regulation (EU) 2016/679 (GDPR) and applicable evidentiary rules under Luxembourg law. Subject to applicable law, such logs may be used as evidence in disputes or legal proceedings. By using the Platform, you acknowledge that your interactions may be logged and that these records may have legal evidentiary value."
      },
    ]
  },
  {
    id: "prohibited-use",
    title: "Prohibited Use",
    Icon: Ban,
    intro: "The following activities are strictly prohibited on the Erovians Platform. Violations may result in immediate account suspension or termination, content removal, reporting to authorities, and legal action. This list is illustrative and not exhaustive.",
    items: [
      {
        label: "Illegal Content & Intellectual Property Infringement",
        desc: "Users must not publish, share, or transmit unlawful Content, including Content that infringes intellectual property rights (copyright, trademarks, designs, trade secrets), contains counterfeit goods or services, constitutes defamation, or violates any applicable law. Users must ensure they have all necessary rights, licences, or authorisations before uploading or referencing any protected material. IP complaints must be submitted through the Notice & Takedown process."
      },
      {
        label: "Identity Fraud & Misrepresentation",
        desc: "Users must not impersonate any person, organisation, or entity — whether real or fictional — or misrepresent their identity, qualifications, credentials, professional status, or affiliations. This includes falsely claiming to be a verified professional, using fake profiles, or providing false information during KYC/KYB verification. Misrepresentation constitutes fraud and may result in immediate account termination, reporting to competent authorities, and civil or criminal liability."
      },
      {
        label: "Security Attacks & Technical Abuse",
        desc: "Users must not attempt to bypass, disable, or circumvent Platform security measures, authentication systems, or access controls. Prohibited conduct includes: data scraping beyond permitted use; reverse engineering Platform code or algorithms; deploying malware, viruses, or malicious code; conducting denial-of-service attacks; attempting unauthorised access to systems, accounts, or data; exploiting vulnerabilities; and manipulating visibility, rankings, or engagement systems through spam, bots, or coordinated inauthentic behaviour."
      },
      {
        label: "Harassment, Hate Speech & Harmful Conduct",
        desc: "Users must not engage in harassment, threats, intimidation, hate speech, or discriminatory conduct based on any protected characteristic. Content that promotes violence, incites hatred, exploits minors or vulnerable persons, constitutes cyberbullying, or causes psychological harm to others is strictly prohibited. Erovians may remove such Content without prior notice and cooperate with law enforcement authorities where required. Violations may result in permanent account bans."
      },
      {
        label: "Circumvention & Off-Platform Transactions",
        desc: "Users agree not to circumvent the Platform's services, including by soliciting or conducting transactions, negotiations, or communications outside the Platform when such interactions were initiated on Erovians. This includes sharing personal contact details for the purpose of avoiding platform fees or governance controls. Any attempt to move interactions off-platform constitutes a material breach of these Terms. Erovians reserves the right to suspend accounts, restrict messaging features, and claim damages where applicable."
      },
      {
        label: "Fraudulent & Misleading Commercial Practices",
        desc: "Users must not engage in fraud, deception, or misrepresentation in the context of commercial activities on the Platform. This includes false pricing or availability claims, misleading product or service descriptions, fake reviews or endorsements, manipulation of trust scores, fabricated transaction histories, and any conduct that constitutes an unfair commercial practice within the meaning of Directive 2005/29/EC. Professional users must ensure that all commercial statements are accurate, verifiable, and not misleading."
      },
      {
        label: "Misuse of Reporting & Complaint Mechanisms",
        desc: "Users must not abuse the Platform's reporting, notice, or complaint mechanisms in bad faith. This includes submitting manifestly unfounded notices, using the reporting system to harass or target other users, or engaging in coordinated reporting campaigns (brigading). Misuse of these systems may result in deprioritisation of future reports, temporary restrictions on reporting capabilities, and account sanctions."
      },
    ]
  },
  {
    id: "content-moderation",
    title: "Content Moderation & Enforcement",
    Icon: ShieldAlert,
    intro: "Erovians operates a hybrid content moderation system combining automated detection and human review, in compliance with the Digital Services Act (Regulation (EU) 2022/2065) and applicable Luxembourg law. Moderation is applied proportionately and consistently.",
    items: [
      {
        label: "Moderation System",
        desc: "Erovians operates a hybrid moderation system combining: automated detection tools (signals, classifiers, anomaly detection) and human review by trained moderators. Automated outputs are subject to human oversight for impactful decisions, in line with GDPR Article 22 safeguards. Content may be flagged via user reports, trusted flaggers (DSA Article 22), internal detection systems, or authority notifications. High-risk cases — such as imminent harm, child safety, or severe fraud — are expedited."
      },
      {
        label: "Moderation Measures",
        desc: "Depending on the assessment, Erovians may apply graduated and proportionate measures including: no action; labelling or warning; visibility reduction (demotion); geo-restriction where jurisdiction-specific; content removal or disabling access; feature restrictions (posting, messaging); account suspension (temporary or permanent). Measures are proportionate to severity, recurrence, and risk, and may be applied cumulatively. Where required, a statement of reasons is provided in accordance with DSA Article 17."
      },
      {
        label: "Notice & Takedown",
        desc: "Any person may submit a notice regarding allegedly illegal Content through the Platform's dedicated reporting interface. A valid notice must include: a sufficiently substantiated explanation of why the Content is illegal; the exact electronic location of the Content (URL or identifier); the notifier's name and contact details (anonymity may be justified for criminal offences); and a good faith statement confirming accuracy. Erovians will acknowledge receipt without undue delay and act without undue delay upon obtaining actual knowledge of illegal Content."
      },
      {
        label: "Appeals & Human Review",
        desc: "Users may contest moderation decisions through the Platform's internal complaint-handling system, in accordance with DSA Article 20. Users may submit additional evidence and request human review for automated decisions under GDPR Article 22. Erovians reviews appeals within a reasonable timeframe and issues a reasoned outcome. Users may also escalate to certified out-of-court dispute settlement bodies where applicable under the Digital Services Act, or to the Luxembourg courts as a last resort."
      },
      {
        label: "Repeat Infringers",
        desc: "Erovians applies a repeat infringer policy in accordance with DSA Article 23. Users who repeatedly publish illegal Content or repeatedly violate Platform rules are subject to escalated enforcement measures, including long-term suspension or permanent bans. Recurrence, severity, and risk are all factors considered when applying escalated sanctions. Repeat infringer status may also affect your Trust Score and visibility on the Platform."
      },
    ]
  },
  {
    id: "liability",
    title: "Liability & Indemnification",
    Icon: AlertTriangle,
    intro: "This section sets out the scope of Erovians' liability and your obligations to indemnify Erovians in connection with your use of the Platform. These provisions apply to the maximum extent permitted by applicable law.",
    items: [
      {
        label: "Limitation of Liability",
        desc: "To the maximum extent permitted by applicable law, Erovians shall not be liable for: (a) User Content or the actions of Users on the Platform; (b) indirect, incidental, special, or consequential damages arising from use of or inability to use the Platform; (c) loss of data, loss of profit, or loss of business opportunities; (d) interruptions, errors, delays, or security incidents not resulting from Erovians' gross negligence or wilful misconduct. Nothing in these Terms excludes or limits liability where it cannot be excluded under applicable mandatory law, including consumer protection provisions."
      },
      {
        label: "No Reliance on User Content",
        desc: "Users acknowledge that Content, profiles, ratings, technical data, recommendations, AI-generated outputs, and any information made available through the Platform are provided for informational and facilitation purposes only. Unless expressly stated otherwise in a formal contractual instrument, Erovians does not certify, warrant, validate, or guarantee: the accuracy of User Content; the technical reliability of specifications, offers, prices, or availability; the legal, commercial, or professional suitability of any User, product, service, or project; or the outcome of any negotiation, transaction, or interaction. Users remain solely responsible for conducting their own due diligence."
      },
      {
        label: "Platform Intermediary Status",
        desc: "Erovians acts as a neutral intermediary and hosting provider. It is not a party to agreements between Users and does not guarantee the execution, quality, or legality of such agreements. Erovians' liability is limited in accordance with Directive 2000/31/EC and the Digital Services Act, subject to its compliance with notice-and-action obligations. Erovians is not liable for the conduct of Users, the accuracy of user-provided information, or the outcome of transactions concluded through the Platform."
      },
      {
        label: "Indemnification by Users",
        desc: "Users agree to indemnify, defend, and hold harmless Erovians, its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, losses, costs, and expenses (including reasonable legal fees) arising from: (a) your use of the Platform in violation of these Terms; (b) your Content and any claims that it infringes third-party rights; (c) your breach of any applicable law or regulation; (d) any misrepresentation made by you to Erovians or to other Users. This indemnification obligation survives the termination of your account."
      },
      {
        label: "Security Incidents",
        desc: "While Erovians implements appropriate security measures in accordance with GDPR Article 32, no system can guarantee absolute security. Erovians shall not be liable for security incidents — including data breaches, unauthorised access, or loss of data — that do not result from its own gross negligence or wilful misconduct. Users are responsible for maintaining the security of their own devices and credentials. In the event of a reportable personal data breach, Erovians will comply with its notification obligations under GDPR Articles 33 and 34."
      },
    ]
  },
  {
    id: "suspension",
    title: "Suspension & Termination",
    Icon: Gavel,
    intro: "Erovians may suspend, restrict, or terminate access to the Platform in the circumstances described below. Measures are applied proportionately and in accordance with the Digital Services Act and applicable Luxembourg law.",
    items: [
      {
        label: "Grounds for Suspension or Termination",
        desc: "Erovians may suspend, restrict, or terminate your access to the Platform where: (a) you violate these Terms or any applicable policy; (b) you publish or engage in illegal Content or activities; (c) fraud, misrepresentation, or abusive behaviour is detected; (d) there is a risk to the security, integrity, or operation of the Platform; (e) legal or regulatory obligations require action; (f) you fail to meet or maintain eligibility requirements, including KYC/KYB verification. Measures are proportionate to the severity, recurrence, and risk of the violation."
      },
      {
        label: "Types of Measures",
        desc: "Enforcement measures may include: content restriction or removal; temporary suspension of your account; permanent termination of your account; limitation of access to specific features (such as messaging or transactions); demotion or reduced visibility. Erovians may apply these measures individually or cumulatively, depending on the nature and severity of the violation. Where required under DSA Article 17, a statement of reasons will be provided, including the nature and duration of the restriction and available remedies."
      },
      {
        label: "Immediate Action Without Notice",
        desc: "Erovians reserves the right to take immediate action without prior notice where: there is a risk of serious harm to users or third parties; illegal activity is suspected; platform security is compromised; or urgent compliance with a legal order is required. In such cases, notification and statement of reasons will be provided as soon as legally permissible, subject to any restrictions imposed by competent authorities or ongoing investigations."
      },
      {
        label: "Appeals & Complaint Mechanism",
        desc: "Users may contest suspension or termination decisions through the Platform's internal complaint-handling system, in accordance with DSA Article 20. Appeals must be submitted within a reasonable time of receiving notification of the measure. Erovians will review complaints and provide a reasoned response within a reasonable timeframe. Users may also refer disputes to certified out-of-court dispute settlement bodies under the DSA, or to competent courts in Luxembourg."
      },
      {
        label: "Effect of Termination",
        desc: "Upon termination of your account — whether by you or by Erovians — the licence you granted to Erovians to host and process your Content remains valid to the extent necessary for archival, legal compliance, and dispute resolution purposes, in accordance with applicable retention periods. You will lose access to your account and all associated data. Erovians is not obligated to provide data exports following termination, unless required by law or a valid data portability request submitted before termination."
      },
    ]
  },
  {
    id: "ai-systems",
    title: "AI Systems & Automated Decisions",
    Icon: Cpu,
    intro: "Erovians uses AI and automated systems to support Platform operations. This section sets out how these systems work, their limitations, and your rights in relation to automated decisions that may affect you.",
    items: [
      {
        label: "AI Use Cases",
        desc: "AI systems on the Platform may be used for: content recommendation and ranking; user support and platform assistance; fraud and anomaly detection; moderation assistance; trust and reputation analysis; search improvement and matching; translation, summarisation or classification of content; and internal risk assessment. AI is a support layer and does not replace legal, professional, commercial, or human judgment where such judgment is required."
      },
      {
        label: "Limitations of AI Outputs",
        desc: "AI outputs may be incomplete, inaccurate, outdated, or contextually inappropriate. AI outputs produced by the Platform do not constitute: legal advice; tax advice; professional certification; contractual approval; guaranteed technical validation; or human expert judgment. Users remain solely and entirely responsible for independent verification before relying on any AI-generated output. Erovians accepts no liability for decisions made by Users based on AI outputs without independent verification."
      },
      {
        label: "Automated Decision-Making & Your Rights",
        desc: "Where automated systems may significantly affect your account access, trust status, transaction capability, verification outcome, suspension, or commercial visibility, additional safeguards apply. These are classified as 'Significant Decisions' requiring stronger protections. Under GDPR Article 22, you have the right to: request human intervention; express your point of view; contest the automated decision; and request correction of inaccurate data used in the decision. You may exercise these rights by contacting DS@erovians.com."
      },
      {
        label: "Trust & Reputation System",
        desc: "The Platform operates a Trust & Reputation System that may use automated processing and AI-assisted analysis to calculate your trust level or score based on signals including: verification level (KYC/KYB status); transaction and dispute history; moderation history; user feedback and ratings; fraud or security indicators; and platform compliance signals. Trust indicators may affect your visibility, feature access, transaction limits, and messaging capabilities. A high trust level does not constitute a guarantee of reliability or professional competence — it is a platform governance signal only."
      },
      {
        label: "Transparency & Human Oversight",
        desc: "Erovians provides meaningful information about the logic, purpose, and main parameters of AI-assisted systems, subject to the protection of security mechanisms, anti-fraud tools, and trade secrets. Human oversight is implemented where AI systems support decisions with material effects. AI-assisted decisions may be logged for accountability, dispute resolution, security, compliance audit, and system improvement purposes, in accordance with the GDPR and the Data Retention Policy."
      },
    ]
  },
  {
    id: "governing-law",
    title: "Governing Law & Changes",
    Icon: Scale,
    intro: "This section sets out the legal framework governing these Terms, the jurisdiction applicable to disputes, and the process by which Erovians may update these Terms and the Services.",
    items: [
      {
        label: "Governing Law",
        desc: "These Terms are governed by and construed in accordance with the laws of the Grand Duchy of Luxembourg, including applicable EU regulations such as Regulation (EU) 2016/679 (GDPR), Regulation (EU) 2022/2065 (Digital Services Act), and Directive 2000/31/EC on electronic commerce. Where you are a consumer, mandatory consumer protection provisions of your country of habitual residence shall apply to the extent required by applicable law."
      },
      {
        label: "Jurisdiction",
        desc: "Any dispute arising from or in connection with these Terms, the Platform, or the Services shall fall under the exclusive jurisdiction of the courts of Luxembourg, subject to mandatory consumer protection jurisdiction rules under Regulation (EU) No 1215/2012 (Brussels I Recast). For consumer Users, the mandatory jurisdiction rules of your country of habitual residence may apply. Cross-border disputes involving Users in multiple jurisdictions remain subject to Luxembourg law, subject to applicable mandatory local provisions."
      },
      {
        label: "Dispute Resolution",
        desc: "Users are encouraged to first attempt resolution through the Platform's internal mechanisms — including communication tools, structured negotiation environments, and the internal complaint system. Where internal resolution is not possible, Users may engage in mediation or use competent alternative dispute resolution (ADR) bodies, including DSA-certified out-of-court dispute settlement bodies for content moderation disputes. Erovians does not use the former EU ODR platform, which has been discontinued — references to consumer redress refer to competent national ADR bodies."
      },
      {
        label: "Changes to the Terms",
        desc: "Erovians may modify these Terms and the Services at any time. Material changes will be communicated to Users — for example, by email notification, in-platform notice, or prominent display before your next login — where required by applicable law. Minor or technical changes may be made without prior notice. Continued use of the Platform after the effective date of any changes constitutes your acceptance of the updated Terms. If you do not agree to the updated Terms, you must cease using the Platform and may request account deletion."
      },
      {
        label: "Severability",
        desc: "If any provision of these Terms is held to be invalid, unlawful, or unenforceable by a competent court or authority, that provision shall be modified to the minimum extent necessary to make it enforceable, or severed from these Terms if modification is not possible. The remaining provisions shall continue in full force and effect and shall not be affected by the invalidity or unenforceability of any single provision."
      },
      {
        label: "Language",
        desc: "The Platform may provide these Terms and other legal documents in multiple languages. Unless expressly stated otherwise, the English version shall prevail in the event of any inconsistency between language versions. A French version may be provided for accessibility, user understanding, and Luxembourg operational purposes. The DSA single point of contact (DS@erovians.com) accepts communications in French as the designated language, and also processes communications in English where operationally appropriate."
      },
    ]
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

export default function TermsPage() {
  const isMobile = window.innerWidth < 768;
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
padding: isMobile ? "1.5rem 1rem 2.5rem" : "4rem 2rem 3.5rem",
textAlign: "center",
position: "relative",
overflow: "hidden",
display: isMobile ? "flex" : "block",
flexDirection: isMobile ? "column" : "unset",
alignItems: isMobile ? "center" : "unset",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "linear-gradient(rgba(200,169,110,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,110,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }} />

        <Link to="/login" style={{
          position: isMobile ? "relative" : "absolute",
alignSelf: isMobile ? "flex-end" : "unset",
top: isMobile ? "unset" : "1.5rem",
right: isMobile ? "unset" : "2rem",
marginBottom: isMobile ? "1rem" : "0",
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
          marginBottom: isMobile ? "0.75rem" : "1.5rem",
          fontFamily: "system-ui, sans-serif",
        }}>
          <ScrollText size={11} />
          Luxembourg Law · DSA Compliant · GDPR Compliant
        </div>

        <h1 style={{
          fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
          fontWeight: 400,
          color: "#f0ebe0",
          margin: "0 0 1rem",
          letterSpacing: "-0.025em",
          fontFamily: "'Georgia', serif",
        }}>
          Terms of Service
        </h1>

        <p style={{
          color: "#8a9aaa",
          fontSize: 15,
          maxWidth: 580,
          margin: "0 auto 2rem",
          lineHeight: 1.75,
          fontFamily: "system-ui, sans-serif",
        }}>
          The complete legal framework governing your use of the Erovians Platform — your rights, responsibilities, and our mutual obligations.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "2.5rem", flexWrap: "wrap" }}>
          {[
            { val: "9", label: "Sections" },
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
        padding: isMobile ? "1.5rem 1rem 4rem" : "2.5rem 1.5rem 5rem",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "280px 1fr",
      gap: isMobile ? "1rem" : "1.75rem",
        alignItems: "start",
        width: "100%",
        boxSizing: "border-box",
      }}>

        {/* ── SIDEBAR ── */}
        <aside style={{
         position: isMobile ? "relative" : "sticky",
top: isMobile ? "auto" : 80,
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
            SECTIONS
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
              <span style={{ fontSize: 10, color: "#a07830", fontFamily: "system-ui, sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Legal Framework</span>
            </div>
            <p style={{ fontSize: 11.5, color: "#777", fontFamily: "system-ui, sans-serif", lineHeight: 1.7, margin: 0 }}>
              DSA · GDPR · AI Act · Luxembourg Law
            </p>
          </div>
        </aside>

        {/* ── CONTENT PANEL ── */}
        <main>
          <div style={{
            background: "#fff",
            border: "1px solid #e2ddd4",
            borderRadius: 16,
            // padding: "2.5rem 3rem",
            padding: isMobile ? "1.5rem 1.25rem" : "2.5rem 3rem",
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
                    {(() => { const Icon = active.Icon; return <Icon size={18} color="#c8a96e" />; })()}
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
                borderRadius: 9, padding: "9px 20px",
                color: prev ? "#444" : "#ccc",
                cursor: prev ? "pointer" : "default",
                fontSize: 13, fontFamily: "system-ui, sans-serif",
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
                borderRadius: 9, padding: "9px 20px",
                color: next ? "#c8a96e" : "#ccc",
                cursor: next ? "pointer" : "default",
                fontSize: 13, fontFamily: "system-ui, sans-serif",
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