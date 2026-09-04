import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Scale, Shield, FileText, Users, Bot, Globe, ChevronDown, ChevronUp,
  BookOpen, AlertTriangle, Eye, Cookie, Database, UserCheck,
  Ban, Cpu, Zap, MessageSquare, Handshake, Map, Flag, BarChart2,
  UserCog, Layers, Baby, Accessibility, Building2, Search, ChevronRight,
  ShieldCheck, Archive, Mail, Info
} from "lucide-react";
import Footer from "../components/Footer";

const categories = [
  {
    id: "platform",
    label: "Platform Rules",
    icon: Scale,
    policies: [
      {
        id: "tos", icon: FileText, title: "Terms of Service",
        summary: "The foundational agreement governing your use of the Erovians platform.",
        sections: [
          { h: "Platform Status (Intermediary)", c: "Erovians acts solely as a neutral intermediary and hosting provider in accordance with Directive 2000/31/EC and Regulation (EU) 2022/2065 (Digital Services Act). It does not initiate, select, or modify Content transmitted or stored, except as required for technical operation or legal compliance." },
          { h: "Eligibility & Account", c: "Users must be legally capable and provide accurate information. Users are responsible for maintaining the confidentiality of credentials and for all activities under their account." },
          { h: "Permitted & Prohibited Use", c: "Users shall use the Platform in compliance with applicable laws. Prohibited: publishing unlawful content or infringing materials, impersonating any person, bypassing security or scraping data, manipulating visibility or ranking systems, or moving transactions off-platform to avoid fees or controls." },
          { h: "User-Generated Content (UGC)", c: "Users retain ownership of their Content. By posting, Users grant Erovians a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, distribute, and process such Content for operating and improving the Services, per Directive 2000/31/EC and Regulation (EU) 2022/2065." },
          { h: "Limitation of Liability", c: "Erovians shall not be liable for: User Content or actions of Users, indirect or consequential damages, loss of data or profit, interruptions or errors not resulting from gross negligence. Nothing excludes liability where it cannot be excluded under applicable law." },
          { h: "Indemnification", c: "Users agree to indemnify and hold harmless Erovians, its officers and affiliates from any claims, damages, or expenses arising from their use of the Platform or breach of these Terms." },
          { h: "Governing Law", c: "These Terms are governed by the laws of the Grand Duchy of Luxembourg. Any dispute shall fall under the exclusive jurisdiction of Luxembourg courts, subject to mandatory consumer protection rules where applicable." },
          { h: "Language", c: "The Platform may provide legal documents in multiple languages. Unless expressly stated otherwise, the English version shall prevail in the event of inconsistency. A French version may be provided for accessibility and Luxembourg operations." },
        ]
      },
      {
        id: "conduct", icon: Users, title: "Code of Conduct",
        summary: "Binding behavioral standards for a safe and professional environment.",
        sections: [
          { h: "General Principles", c: "Users shall: act lawfully and in good faith, respect the rights and dignity of others, provide accurate and verifiable information especially for professional content, and avoid conduct that harms the integrity or reputation of the Platform." },
          { h: "Professional Integrity & Accuracy", c: "Professional, technical, or commercial information must be accurate and not misleading within Directive 2005/29/EC, supported by reasonable evidence where applicable, and presented without deceptive omission or exaggeration." },
          { h: "Prohibited Conduct", c: "Forbidden: publishing illegal content, harassment or hate speech, fraud or misrepresentation, conducting illegal trade, disseminating malware, manipulating visibility or engagement systems, bypassing platform safeguards, or moving negotiations off-platform." },
          { h: "Commercial Communications", c: "Users engaging in commercial communications must clearly disclose the commercial nature of content (advertising, sponsorships, partnerships), avoid misleading claims, and comply with consumer protection rules." },
          { h: "Enforcement & Sanctions", c: "Violations may result in: warnings, content removal or restriction, feature limitations, temporary suspension, or permanent account termination. A statement of reasons is provided per Article 17 DSA where required." },
          { h: "Appeals & Remedies", c: "Users may contest enforcement measures via the internal complaint-handling system in accordance with Article 20 of Regulation (EU) 2022/2065." },
        ]
      },
      {
        id: "social", icon: Globe, title: "Social Media Policy",
        summary: "Rules governing posts, comments, media, and all social interactions.",
        sections: [
          { h: "Platform Role & Status", c: "Erovians acts as a hosting and intermediary provider. It does not create or pre-approve user Content, does not guarantee accuracy or legality of Content, and does not endorse user opinions. Liability is limited under Directive 2000/31/EC and the DSA." },
          { h: "User Responsibility & Compliance", c: "Users are solely responsible for their Content and must comply with intellectual property laws, consumer protection rules, advertising transparency requirements (identification of sponsored content), and applicable criminal laws." },
          { h: "Commercial Communications & Transparency", c: "Where Content constitutes a commercial communication, Users must: clearly identify the commercial nature, disclose material relationships (paid promotion), and avoid misleading claims regarding products, services, or capabilities." },
          { h: "Recommender Systems & Visibility", c: "Content visibility may be influenced by recommender systems per Article 27 of Regulation (EU) 2022/2065, using signals such as relevance, interaction history, and compliance indicators. No guarantee of reach, ranking, or engagement is provided." },
          { h: "Prohibited Content & Behaviors", c: "Users shall not: publish illegal or infringing content, engage in harassment or abusive conduct, disseminate harmful misinformation, manipulate visibility or engagement systems, or solicit off-platform transactions to circumvent platform rules." },
          { h: "Enforcement Measures", c: "Violations may result in: content removal or restriction, demotion or reduced visibility, feature limitations, or account suspension or termination. A statement of reasons will be provided per Article 17 DSA where required." },
        ]
      },
    ]
  },
  {
    id: "privacy", label: "Privacy & Data", icon: Shield,
    policies: [
      {
        id: "privacy-pol", icon: Eye, title: "Privacy Policy",
        summary: "How Erovians collects, processes, and protects your personal data under GDPR.",
        sections: [
          { h: "Legal Framework", c: "Established under GDPR (Regulation EU 2016/679), notably Articles 5 (principles), 6 (lawfulness), 12–22 (data subject rights), 25 (data protection by design and by default), and 32 (security of processing), as well as applicable Luxembourg data protection laws." },
          { h: "Data Controller", c: "Erovians acts as the data controller for the processing of personal data carried out through the Platform." },
          { h: "Categories of Data Collected", c: "Erovians may process: Identity data (name, email, KYC/KYB identification details), Usage data (navigation, interactions, preferences), Technical data (IP address, device identifiers, logs), and Communication data (messages, support requests)." },
          { h: "Legal Basis for Processing", c: "Processing is based on: consent (Article 6(1)(a) GDPR), performance of a contract (Article 6(1)(b)), legal obligations (Article 6(1)(c)), and legitimate interests (Article 6(1)(f)). Special categories processed under Article 9 GDPR where applicable." },
          { h: "Purposes of Processing", c: "Data is processed for: operation and improvement of the Platform, security and fraud detection, legal compliance and regulatory obligations, and user communication and support." },
          { h: "Your Rights", c: "Users have the right to: access (Article 15), rectification (Article 16), erasure (Article 17), restriction (Article 18), portability (Article 20), and objection (Article 21). Requests may be submitted to DS@erovians.com." },
          { h: "International Transfers", c: "Data transfers outside the EEA are governed by Chapter V GDPR (Articles 44–50), including adequacy decisions and standard contractual clauses (SCCs)." },
          { h: "Security Measures", c: "Erovians implements appropriate technical and organizational measures under Article 32 GDPR, including encryption in transit (TLS), role-based access control, and regular vulnerability assessments." },
        ]
      },
      {
        id: "cookie", icon: Cookie, title: "Cookie Policy",
        summary: "How cookies and tracking technologies are used and managed on the platform.",
        sections: [
          { h: "Legal Framework", c: "Complies with Directive 2002/58/EC (ePrivacy Directive), Article 5(3), and GDPR including Articles 4(11), 6, 7, 12, and 13." },
          { h: "Cookie Categories", c: "Essential Cookies: required for operation and security — no prior consent needed. Functional Cookies: remember user preferences and language settings — consent required. Analytics Cookies: measure audience and performance — consent required. Marketing/Advertising Cookies: targeted advertising and retargeting — prior consent required." },
          { h: "Consent Mechanism", c: "Prior consent is required before placing non-essential cookies. The consent interface allows Users to: accept all, reject all, configure by category, and withdraw consent at any time. Consent must be freely given, specific, informed, and unambiguous." },
          { h: "Proof of Consent", c: "Erovians records: consent status, timestamp, cookie/policy version, user or consent identifier, and categories accepted or refused." },
          { h: "Third-Party Cookies", c: "Where third-party cookies are used, Erovians identifies the provider, purpose, retention period, and applicable transfer safeguards." },
        ]
      },
      {
        id: "retention", icon: Archive, title: "Data Retention Policy",
        summary: "How long your data is stored and when it is deleted or anonymized.",
        sections: [
          { h: "Principles", c: "Erovians retains personal data only for as long as necessary for the purposes for which it is processed, including service operation, security, legal compliance, and dispute resolution — per Article 5(1)(e) GDPR (storage limitation)." },
          { h: "Retention Periods by Category", c: "Account data: up to 5 years after closure. Transaction and contractual data: up to 10 years. Chat and interaction logs: up to 5 years. Security logs: 6 to 24 months. KYC/KYB data: as required by AML/CFT regulations." },
          { h: "Deletion & Anonymization", c: "Upon expiration, data is permanently deleted or irreversibly anonymized. Deletion processes follow Article 17 GDPR (right to erasure), subject to legal exceptions." },
          { h: "Legal Holds", c: "Data may be retained beyond standard periods for: ongoing investigations, litigation or dispute resolution, or compliance with legal obligations." },
          { h: "User Requests", c: "Users may request deletion or restriction of processing per Articles 12–23 GDPR, subject to applicable legal retention obligations." },
        ]
      },
      {
        id: "dpia", icon: AlertTriangle, title: "DPIA / Risk Assessment Policy",
        summary: "How Erovians identifies, assesses, and mitigates privacy and security risks.",
        sections: [
          { h: "Purpose", c: "Defines how Erovians identifies, assesses, and mitigates privacy, security, AI, fraud, and platform governance risks before and during platform operation, supporting GDPR accountability under Articles 5, 24, 25, 32, 35, and 36." },
          { h: "Activities Requiring Assessment", c: "A DPIA or risk assessment may be required for: KYC/KYB verification, biometric or facial verification, trust and reputation scoring, automated moderation, fraud detection, large-scale logging of communications, profiling or automated decision-making, and AI-assisted recommendations." },
          { h: "DPIA Procedure", c: "A DPIA shall include: description of processing operations, purposes and legal bases, necessity and proportionality assessment, risk identification, mitigation measures, residual risk evaluation, governance approval, and review date." },
          { h: "Prior Consultation", c: "Where a DPIA indicates high residual risk that cannot be adequately mitigated, Erovians may consult the competent supervisory authority (CNPD) before processing, per Article 36 GDPR." },
        ]
      },
    ]
  },
  {
    id: "content", label: "Content & Moderation", icon: BookOpen,
    policies: [
      {
        id: "moderation", icon: ShieldCheck, title: "Content Moderation Policy",
        summary: "DSA-compliant review and enforcement framework for all platform content.",
        sections: [
          { h: "Objectives", c: "Erovians aims to: remove or restrict illegal Content without undue delay, mitigate risks to Users and the public, ensure fair, proportionate and consistent decisions, and provide traceability and auditability of all actions taken." },
          { h: "Moderation Model (Hybrid)", c: "Erovians operates a hybrid system: automated detection (signals, classifiers, anomaly detection) combined with human review (trained moderators). Automated outputs are subject to human oversight for impactful decisions, in line with GDPR safeguards." },
          { h: "Graduated Response Measures", c: "Depending on assessment, Erovians may apply: no action, labeling or warning, visibility reduction (demotion), geo-restriction, content removal or disabling access, feature restrictions (posting, messaging), or account suspension or termination. Measures are proportionate and may be applied cumulatively." },
          { h: "Statements of Reasons", c: "Where Content is restricted or removed, Erovians provides: type of action, factual and legal basis, territorial scope if geo-restricted, and available remedies — per Article 17 DSA." },
          { h: "User Rights & Appeals", c: "Users may: contest decisions via the internal complaint system (Article 20 DSA), submit additional evidence, and request human review for automated decisions (GDPR Article 22). Erovians reviews appeals and issues a reasoned outcome." },
          { h: "Repeat Infringers", c: "Recurrent violations may lead to escalated sanctions including long-term suspension or permanent bans, per Article 23 DSA." },
        ]
      },
      {
        id: "takedown", icon: Flag, title: "Notice & Takedown Policy",
        summary: "How to report illegal content and how Erovians processes notices.",
        sections: [
          { h: "Notice Submission", c: "Any natural or legal person may submit a notice regarding allegedly illegal Content. A valid notice must include: a substantiated explanation of why the Content is illegal, exact electronic location (URL/identifier), the notifier's name and contact details, and a good-faith statement confirming the information is accurate." },
          { h: "Assessment & Qualification", c: "Erovians assesses whether: the notice is complete and credible, the Content is prima facie illegal under applicable law, and urgent action is required to prevent harm. Additional information may be requested where necessary." },
          { h: "Action Without Undue Delay", c: "Upon obtaining knowledge of illegal Content, Erovians will act without undue delay to: remove the Content, disable access, or restrict its visibility. Measures are proportionate to the nature and severity of the violation." },
          { h: "Counter-Notice & Appeal", c: "Affected Users may submit a counter-notice with: identification of the affected Content, grounds for contestation, and supporting evidence. Erovians provides a reasoned decision within a reasonable timeframe." },
          { h: "Trusted Flaggers", c: "Notices submitted by entities designated as trusted flaggers under Regulation (EU) 2022/2065 may be prioritized in processing." },
        ]
      },
      {
        id: "ugc", icon: Layers, title: "User Generated Content (UGC) Policy",
        summary: "Content ownership, licensing, and user responsibilities on the platform.",
        sections: [
          { h: "Ownership of Content", c: "Users retain full ownership of the Content they create and publish on the Platform. However, publication on the Platform implies a necessary operational license for Erovians to operate and distribute the Platform." },
          { h: "License Granted to Erovians", c: "By submitting Content, Users grant Erovians a worldwide, non-exclusive, royalty-free, transferable and sublicensable license to: host, store, reproduce, modify (for technical purposes only), distribute, display, and analyze Content for operating, improving, securing, and promoting the Platform." },
          { h: "User Warranties", c: "Users warrant that: they own or have lawful rights to the Content, it does not infringe intellectual property rights (copyright, trademarks, design rights), it does not violate applicable laws, and it does not contain misleading or fraudulent information." },
          { h: "Prohibited Content", c: "Users must not publish Content that is: illegal under applicable law, infringing third-party rights, defamatory, abusive, or harmful, constituting unfair commercial practices, or containing malicious code or security threats." },
          { h: "Persistence & Archiving", c: "Even after deletion by the User, Content may be retained in backups, logs, or where required for legal compliance or dispute resolution — per GDPR and applicable retention obligations." },
        ]
      },
    ]
  },
  {
    id: "trust", label: "Trust & Safety", icon: UserCheck,
    policies: [
      {
        id: "kyc", icon: UserCheck, title: "KYC / Verification Policy",
        summary: "Identity and business verification framework to ensure trust and prevent fraud.",
        sections: [
          { h: "Purpose", c: "The KYC (Know Your Customer) and KYB (Know Your Business) framework aims to: ensure trust between Users, prevent fraud and identity theft, enable secure transactions and interactions, and support legal compliance, auditability, and dispute resolution." },
          { h: "Verification Levels", c: "Level 0 – Unverified: limited feature access. Level 1 – Basic: email confirmation and minimal identity data. Level 2 – Identity KYC: government-issued ID, selfie or biometric verification where lawful. Level 3 – Advanced KYB: company registration, VAT/business ID, proof of authority. Level 4 – Enhanced Due Diligence: additional documentation, manual compliance review, source-of-funds or sanctions screening where applicable." },
          { h: "Fraud Prevention & Risk Scoring", c: "Erovians may implement automated and manual risk assessment mechanisms including: behavioral analysis, anomaly detection, transaction monitoring, sanctions or watchlist checks, and trust or risk scoring. Such processing may involve automated decision-making under Article 22 GDPR, with the right to request human review where applicable." },
          { h: "Ongoing Monitoring", c: "Verification is not one-time. Erovians may: periodically re-verify Users, request updated documents, monitor activity for suspicious behavior, and downgrade verification status where information becomes outdated or unreliable." },
          { h: "Refusal & Restrictions", c: "Erovians reserves the right to refuse verification, limit service access, suspend accounts, or block high-risk transactions where: information is incomplete or inconsistent, fraud is suspected, or legal compliance cannot be ensured." },
          { h: "User Rights", c: "Users have the right to: access their data, request correction or deletion subject to legal retention obligations, object to certain processing, and request human review where automated decisions significantly affect them — per Articles 12–22 GDPR." },
        ]
      },
      {
        id: "suspension", icon: Ban, title: "Account Suspension Policy",
        summary: "Grounds, process, and appeals for account restrictions or termination.",
        sections: [
          { h: "Grounds for Suspension or Termination", c: "Erovians may suspend, restrict, or terminate access where: (a) the User violates Terms of Service or any applicable policy, (b) the User engages in illegal content or activities, (c) fraud, misrepresentation, or abusive behavior is detected, (d) there is a risk to platform security or integrity, or (e) legal or regulatory obligations require action." },
          { h: "Types of Measures", c: "Measures include: content restriction or removal, temporary suspension of account, permanent termination, and limitation of access to specific features (e.g., messaging, transactions). Applied proportionally based on severity, recurrence, and risk." },
          { h: "Notification & Statement of Reasons", c: "Where required under DSA, Erovians provides: a statement of reasons, the nature and duration of the restriction, and available remedies or appeal options. Notification may be limited where legally restricted or where it would compromise investigations." },
          { h: "Repeat Infringers", c: "Users who repeatedly violate Platform rules may be subject to escalated enforcement including permanent bans, per Article 23 of Regulation (EU) 2022/2065." },
          { h: "Immediate Action", c: "Erovians reserves the right to take immediate action without prior notice where: there is a risk of harm, illegal activity is suspected, or platform security is compromised." },
          { h: "Appeals", c: "Users may contest decisions through the internal complaint-handling system per Article 20 DSA. Erovians shall review complaints and provide a reasoned response within a reasonable timeframe." },
        ]
      },
      {
        id: "trust-rep", icon: Zap, title: "Trust & Reputation System Policy",
        summary: "How trust scores and reputation indicators work on the platform.",
        sections: [
          { h: "Purpose", c: "A strategic governance layer designed to increase safety, reduce fraud, support professional credibility, and improve interaction quality. It must operate in a transparent, proportionate, and legally compliant manner — not as an arbitrary punishment tool." },
          { h: "Trust Signals Used", c: "Signals include: KYC/KYB verification level, account age and consistency, profile completeness, verified professional credentials, transaction history, dispute and resolution history, moderation history, user feedback and ratings, and fraud/abuse/security signals." },
          { h: "No Guarantee", c: "A high trust level does NOT mean Erovians guarantees: the User's solvency, quality of products or services, legality of future conduct, accuracy of all statements, or the successful completion of any transaction. Users must conduct their own due diligence." },
          { h: "Automated Processing & Human Review", c: "Trust calculations may involve automated processing, profiling, or AI-assisted analysis. Where such processing produces significant effects, Users may request human intervention and contest the outcome per Article 22 GDPR." },
          { h: "Anti-Manipulation", c: "Users must not manipulate trust signals by: creating fake accounts, generating artificial reviews, coordinating false feedback, abusing dispute systems, or misleading verification processes. Violations lead to account sanctions." },
        ]
      },
      {
        id: "children", icon: Baby, title: "Children / Minors Policy",
        summary: "Rules protecting minors and governing access for under-age users.",
        sections: [
          { h: "Minimum Age", c: "The Platform is primarily intended for professional, business, and legally capable Users. Users must meet the minimum age and legal capacity required under applicable law to create an account and use Platform services." },
          { h: "Parental or Guardian Consent", c: "Where access by minors is legally permitted but requires consent, Erovians may require verifiable consent from a parent or legal guardian before granting access." },
          { h: "Restrictions for Minors", c: "Minors may be restricted from: commercial transactions, professional seller features, KYC/KYB processes, contractual negotiations, and exposure to inappropriate or high-risk content." },
          { h: "Content Protection", c: "Users must not publish Content that exploits, endangers, targets, manipulates, or harms minors. Erovians may remove Content and report serious risks to competent authorities where required." },
          { h: "Advertising & Profiling", c: "Erovians shall not knowingly target minors with inappropriate advertising or profiling practices prohibited by applicable law." },
        ]
      },
    ]
  },
  {
    id: "ai", label: "AI & Automation", icon: Bot,
    policies: [
      {
        id: "ai-usage", icon: Bot, title: "AI Usage Policy",
        summary: "How artificial intelligence is used on the platform and its limitations.",
        sections: [
          { h: "Legal Framework", c: "Established in accordance with GDPR (Articles 5, 6, 13–15 and 22), Regulation (EU) 2022/2065 (DSA), and Regulation (EU) 2024/1689 (Artificial Intelligence Act)." },
          { h: "AI Use Cases", c: "AI systems may be used for: content recommendation and ranking, user support and platform assistance, fraud and anomaly detection, moderation assistance, trust and reputation analysis, search improvement and matching, translation, summarization or classification of content, and internal risk assessment." },
          { h: "Prohibited or Restricted Uses", c: "Erovians shall not deploy AI systems for unlawful, deceptive, discriminatory, or manipulative purposes. AI systems shall not be used to bypass Users' rights under GDPR, DSA, or consumer protection rules." },
          { h: "Transparency", c: "Users shall be informed where they interact with AI systems or where AI materially supports decisions affecting their Platform experience. Meaningful information about the logic, purpose, and parameters of AI-assisted systems is provided, subject to security and trade secret protections." },
          { h: "Limitations of AI Outputs", c: "AI outputs may be incomplete, inaccurate, outdated, or contextually inappropriate. They do NOT constitute: legal advice, tax advice, professional certification, contractual approval, or human expert judgment. Users remain responsible for independent verification before relying on AI-generated outputs." },
          { h: "Data Use for AI", c: "User data may be processed for AI functionality only where a lawful GDPR basis exists. Where Erovians intends to use User data for model training or fine-tuning beyond service operation, such use shall be disclosed and based on an appropriate legal basis, including consent where required." },
        ]
      },
      {
        id: "automated", icon: Cpu, title: "Automated Decision Policy",
        summary: "Your rights regarding automated decisions that affect your account or visibility.",
        sections: [
          { h: "Scope", c: "Automated systems may be used to: influence content visibility or ranking, detect and prevent fraud, support moderation decisions, assess trust, risk, or reputation indicators, recommend users or content, and restrict features where risk signals justify intervention." },
          { h: "Decision Categories", c: "Assistive Decisions: internal recommendations without direct legal effects. Operational Decisions: affect visibility, ranking, alerts, or feature access. Significant Decisions: materially affect account access, trust status, transaction capability, verification outcome, or suspension — require stronger safeguards and human review." },
          { h: "Your Rights (Article 22 GDPR)", c: "Where Article 22 GDPR applies, Users have the right to: request human intervention, express their point of view, contest the decision, and request correction of inaccurate data used in the decision." },
          { h: "Review Procedure", c: "Users may request review through the appeal or support channel. Erovians assesses: the decision concerned, the data used, the applicable policy basis, and whether human correction, reversal, or confirmation is justified." },
          { h: "Safeguards", c: "Erovians implements: human oversight for significant decisions, periodic review of automated systems, proportionality checks, bias and error monitoring, audit logs, and appeal and correction mechanisms." },
        ]
      },
    ]
  },
  {
    id: "legal-comp", label: "Legal & Compliance", icon: FileText,
    policies: [
      {
        id: "legal-notice", icon: Building2, title: "Legal Notice",
        summary: "Publisher information and liability framework under Luxembourg law.",
        sections: [
          { h: "Legal Framework", c: "This Legal Notice complies with the Luxembourg Law of 14 August 2000 on electronic commerce and Directive 2000/31/EC." },
          { h: "Publisher Identification", c: "The Platform is operated by a Luxembourg-based legal entity. Mandatory information includes: company name, registered office, registration number (RCS Luxembourg), and VAT number where applicable." },
          { h: "Liability Regime", c: "Erovians acts as a hosting provider and benefits from liability exemptions under Directive 2000/31/EC, subject to compliance with notice-and-action obligations." },
          { h: "Contact Information", c: "Users may contact Erovians via official email address and legal correspondence address for any publisher-related enquiries." },
        ]
      },
      {
        id: "dispute", icon: Handshake, title: "Dispute Resolution",
        summary: "How disputes between users and with the platform are handled.",
        sections: [
          { h: "Scope", c: "Applies to all disputes arising from: use of the Platform, interactions between Users, Content published or exchanged, communications via the Platform, and any pre-contractual or contractual negotiations conducted through Erovians." },
          { h: "Erovians' Role", c: "Erovians acts strictly as an intermediary and shall not be considered a party to agreements concluded between Users unless explicitly stated. Erovians does not guarantee execution of agreements, quality of exchanged goods/services, or accuracy of User-provided information." },
          { h: "Internal Dispute Resolution", c: "Users are encouraged to first attempt resolution through the Platform. Erovians may provide: communication tools, structured negotiation environments, technical logs for fact clarification, and may intervene in a neutral capacity where appropriate." },
          { h: "Evidentiary Framework", c: "Chat logs, timestamps, interaction metadata, and transaction-related data may be used as evidence — maintained per GDPR and usable in legal proceedings under Luxembourg evidentiary law." },
          { h: "Mediation & Judicial Proceedings", c: "Users may engage ADR bodies or DSA-certified out-of-court dispute settlement bodies. Unresolved disputes may be submitted to Luxembourg courts, subject to mandatory consumer jurisdiction rules." },
        ]
      },
      {
        id: "crossborder", icon: Map, title: "Cross-Border Policy",
        summary: "How the platform handles international users, data transfers, and jurisdiction.",
        sections: [
          { h: "Applicable Law", c: "Unless otherwise required by mandatory provisions, the contractual relationship is governed by Luxembourg law. For consumer Users, mandatory consumer protection rules of the country of habitual residence shall apply where required by law." },
          { h: "International Data Transfers", c: "Personal data may be transferred outside the EEA where necessary for service operation, conducted per Chapter V GDPR including: adequacy decisions adopted by the European Commission, standard contractual clauses (SCCs), and appropriate safeguards where required." },
          { h: "User Responsibility", c: "Users are solely responsible for ensuring compliance with: local laws, import/export regulations, and professional or industry regulations applicable to their cross-border interactions and transactions on the Platform." },
          { h: "Geo-Restrictions", c: "Erovians reserves the right to: restrict access to certain services by geography, apply geo-blocking measures, and adapt services to comply with local regulations." },
        ]
      },
      {
        id: "ip", icon: BookOpen, title: "Intellectual Property Policy",
        summary: "Rules governing copyright, trademarks, designs, and IP complaints.",
        sections: [
          { h: "User Responsibility", c: "Users must ensure they have all rights, licenses, authorizations, or permissions required to upload, share, sell, display, or reference any protected material including photographs, CAD/DXF/STEP/STL files, logos, trademarks, designs, models, and engineering documentation." },
          { h: "Prohibited IP Conduct", c: "Users shall not: upload infringing works, use third-party trademarks deceptively, sell counterfeit goods or services, misappropriate designs or technical files, claim authorship over works they do not own, or remove copyright or watermark information without authorization." },
          { h: "IP Complaints", c: "Rights holders may submit IP complaints through the Notice & Takedown process, including: identification of the protected work, proof of ownership, location of allegedly infringing Content, legal basis for the complaint, and contact details of the claimant." },
          { h: "No Legal Validation by Erovians", c: "Erovians does not validate ownership, originality, copyright status, trademark clearance, or design protection of User materials. Users must perform their own intellectual property due diligence." },
        ]
      },
      {
        id: "dsa-contact", icon: Mail, title: "DSA Single Point of Contact",
        summary: "How to reach Erovians for Digital Services Act communications.",
        sections: [
          { h: "Contact Point", c: "The DSA single point of contact for Erovians is: DS@erovians.com. The designated language for DSA communications is French. Erovians may also process communications in English where operationally appropriate." },
          { h: "Scope of Communications", c: "The DSA contact point may be used for: notices from competent authorities, legally substantiated DSA requests, user complaints concerning DSA-related rights, moderation decision questions, trusted flagger communications, and content restriction or statement-of-reasons follow-up." },
          { h: "Intake Procedure", c: "Upon receipt of a DSA communication, Erovians shall: record the date and time of receipt, identify the sender and legal basis, classify the request type, assign an internal owner, and preserve relevant evidence." },
          { h: "Response & Escalation", c: "Requests may be escalated to: legal review, data protection review, security review, moderation review, or senior governance approval for high-risk matters. Erovians responds within a reasonable timeframe based on urgency and legal obligations." },
        ]
      },
      {
        id: "dsa-trans", icon: BarChart2, title: "DSA Transparency Reporting",
        summary: "How Erovians reports on moderation activity and DSA compliance.",
        sections: [
          { h: "Reporting Scope", c: "Transparency reports may include: number of notices received, source of notices (Users, trusted flaggers, authorities, internal systems), categories of alleged illegal Content, actions taken, average processing times, number and outcome of appeals, account suspensions, use of automated moderation tools, and cooperation with authorities." },
          { h: "Data Quality & Auditability", c: "Reports shall be based on logged and verifiable data. Erovians shall implement internal controls to ensure consistency, completeness, and integrity of reporting metrics." },
          { h: "Confidentiality", c: "Transparency reports shall not disclose: personal data beyond what is lawful and necessary, trade secrets, security-sensitive information, or information that could facilitate abuse of moderation or fraud systems." },
          { h: "Publication", c: "Where legally required, Erovians shall publish transparency reports in an accessible format. Where not legally required, Erovians may publish voluntary summaries for audit and compliance readiness." },
        ]
      },
      {
        id: "user-status", icon: UserCog, title: "User Status & Role Declaration",
        summary: "How consumer, business, and professional users are distinguished on the platform.",
        sections: [
          { h: "User Categories", c: "Users may act as: Consumer User (natural person acting outside a trade or profession), Business User (legal entity or professional acting for commercial purposes), Professional Seller (trader offering goods or services professionally), Service Provider (offering professional services such as design, fabrication, logistics, or consulting), or Representative/Agent (acting on behalf of another person)." },
          { h: "Declaration Requirement", c: "Users must accurately declare their status when required. Professional Users must not present themselves as consumers to avoid legal obligations or platform controls." },
          { h: "Consequences of Status", c: "User status may affect: applicable consumer rights, required legal disclosures, tax and invoicing obligations, KYC/KYB requirements, access to commercial features, and dispute resolution rights." },
          { h: "Misrepresentation", c: "False declaration of status may result in: account restriction, transaction blocking, suspension or termination, and reporting to competent authorities where required." },
        ]
      },
      {
        id: "accessibility", icon: Accessibility, title: "Accessibility Policy",
        summary: "Erovians' commitment to making the platform accessible to all users.",
        sections: [
          { h: "Legal Framework", c: "Guided by Directive (EU) 2019/882 (European Accessibility Act), Directive (EU) 2016/2102 on website accessibility, WCAG principles (perceivable, operable, understandable and robust) as a technical benchmark, and applicable Luxembourg accessibility requirements." },
          { h: "Accessibility Objectives", c: "Erovians aims to support: keyboard navigation, readable contrast and typography, alternative text for relevant images, accessible forms and error messages, clear page structure and headings, and compatibility with assistive technologies where feasible." },
          { h: "Continuous Improvement", c: "Accessibility is an ongoing process. Erovians may conduct: accessibility reviews, user feedback analysis, technical corrections, and progressive compliance improvements." },
          { h: "Feedback & Limitations", c: "Users may report accessibility barriers through official support or legal contact channels. Some third-party content, user-generated content, legacy documents, or external integrations may not be fully accessible. Erovians takes reasonable steps to improve where feasible." },
        ]
      },
      {
        id: "governance", icon: Building2, title: "Internal Governance Policy",
        summary: "How Erovians manages legal, moderation, privacy, security, and compliance decisions internally.",
        sections: [
          { h: "Governance Roles", c: "Erovians may define internal roles including: legal owner, data protection owner or DPO where appointed, security owner, moderation lead, KYC/KYB review lead, AI governance lead, dispute resolution lead, authority request coordinator, and DSA contact point owner." },
          { h: "Decision Ownership", c: "Material decisions must identify an internal owner, including decisions relating to: account suspension, high-risk moderation, trusted flagger or authority requests, KYC refusal, legal holds, data disclosure, AI system deployment, and serious incident response." },
          { h: "Legal Hold Procedure", c: "Where a dispute, investigation, authority request, or litigation risk arises, Erovians may activate a legal hold to preserve relevant records. Legal holds must identify: scope of data, reason for preservation, responsible owner, review date, and release condition." },
          { h: "AI Governance", c: "Before deploying AI systems with material user impact, Erovians documents: purpose of the system, data used, expected impact, risk classification, human oversight mechanism, logging and appeal mechanism, and relationship with the Trust & Reputation System." },
          { h: "Internal Audit & Review", c: "Erovians may conduct periodic internal reviews covering: access logs, moderation consistency, KYC decisions, data retention compliance, security controls, DSA reporting accuracy, and AI system performance and risk." },
        ]
      },
    ]
  },
];

export default function LegalPage() {
  const [expandedCategories, setExpandedCategories] = useState({ platform: true });
  const [activePolicy, setActivePolicy] = useState("tos");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const allPolicies = categories.flatMap((c) =>
    c.policies.map((p) => ({ ...p, categoryId: c.id, categoryLabel: c.label }))
  );

  const searchResults =
    search.length > 1
      ? allPolicies.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.summary.toLowerCase().includes(search.toLowerCase())
      )
      : null;

  const handlePolicyClick = (policyId, categoryId) => {
    setActivePolicy(policyId);
    setSearch("");
    setExpandedCategories(prev => ({ ...prev, [categoryId]: true }));
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const currentPolicyInfo = allPolicies.find(p => p.id === activePolicy);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#111", display: "flex", flexDirection: "column" }}>
      
      {/* Top Bar with Login Button */}
      <div style={{ width: "100%", padding: "1rem 2rem", display: "flex", justifyContent: "flex-end", borderBottom: "1px solid #f0f0f0", background: "#fcfcfc" }}>
        <Link to="/login" style={{
          background: "#0f1923",
          border: "none",
          color: "#c8a96e",
          padding: "0.5rem 1.2rem",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "13px",
          fontFamily: "system-ui, sans-serif",
          fontWeight: 600,
          transition: "all 0.2s",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#1a2a3a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#0f1923";
        }}
        >
          Login
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", maxWidth: "1280px", margin: "0 auto", width: "100%" }}>

        {/* Sidebar */}
        <aside style={{ width: isMobile ? "100%" : "280px", minWidth: isMobile ? "auto" : "280px", borderRight: isMobile ? "none" : "1px solid #f0f0f0", borderBottom: isMobile ? "1px solid #f0f0f0" : "none", padding: "32px 16px", position: isMobile ? "static" : "sticky", top: "57px", height: isMobile ? "auto" : "calc(100vh - 57px)", overflowY: isMobile ? "visible" : "auto" }}>
          <div style={{ marginBottom: "20px", padding: "0 8px" }}>
            <div style={{ position: "relative" }}>
              <Search size={16} color="#aaa" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search policies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "10px 10px 10px 36px",
                  borderRadius: "8px", border: "1px solid #e0e0e0",
                  fontSize: "13px", outline: "none", backgroundColor: "#f9f9f9",
                  transition: "border-color 0.2s"
                }}
              />
            </div>
          </div>

          {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isExpanded = expandedCategories[cat.id];
            const hasActivePolicy = cat.policies.some(p => p.id === activePolicy) && !searchResults;

            return (
              <div key={cat.id} style={{ marginBottom: "4px" }}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", background: "none",
                    border: "none", cursor: "pointer", textAlign: "left",
                    borderRadius: "6px", transition: "background-color 0.15s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f5f5f5"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CatIcon size={16} color={hasActivePolicy ? "#c9a84c" : "#666"} />
                    <div style={{ fontSize: "14px", fontWeight: hasActivePolicy ? "600" : "500", color: hasActivePolicy ? "#111" : "#444" }}>
                      {cat.label}
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />}
                </button>

                {/* Sub-policies */}
                {isExpanded && (
                  <div style={{ paddingLeft: "26px", marginTop: "2px", marginBottom: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                    {cat.policies.map(policy => {
                      const isActive = activePolicy === policy.id && !searchResults;
                      return (
                        <button
                          key={policy.id}
                          onClick={() => handlePolicyClick(policy.id, cat.id)}
                          style={{
                            width: "100%", display: "block", textAlign: "left", padding: "7px 12px",
                            fontSize: "13px", color: isActive ? "#c9a84c" : "#555",
                            fontWeight: isActive ? "500" : "400",
                            background: isActive ? "rgba(201,168,76,0.08)" : "none",
                            border: "none", cursor: "pointer", borderRadius: "6px",
                            transition: "all 0.15s"
                          }}
                          onMouseEnter={(e) => !isActive && (e.currentTarget.style.backgroundColor = "#f5f5f5")}
                          onMouseLeave={(e) => !isActive && (e.currentTarget.style.backgroundColor = "transparent")}
                        >
                          {policy.title}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ margin: "32px 8px 0", background: "#fdf9f0", borderRadius: "8px", padding: "16px", border: "1px solid #f0e0b0" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <Mail size={14} color="#c9a84c" />
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#555", letterSpacing: "0.3px" }}>DSA Contact</span>
            </div>
            <p style={{ fontSize: "12px", color: "#888", margin: "0 0 8px", lineHeight: "1.5" }}>For legal & DSA communications:</p>
            <a href="mailto:DS@erovians.com" style={{ fontSize: "13px", color: "#c9a84c", fontWeight: "600", textDecoration: "none" }}>DS@erovians.com</a>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, padding: isMobile ? "32px 20px" : "48px 64px", minWidth: 0, maxWidth: "860px", boxSizing: "border-box" }}>

          {searchResults ? (
            <div>
              <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px", fontWeight: "500" }}>
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;<span style={{ color: "#111" }}>{search}</span>&quot;
              </p>
              {searchResults.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 0", color: "#999" }}>
                  <Search size={48} color="#f0f0f0" style={{ marginBottom: "16px" }} />
                  <p style={{ fontSize: "15px" }}>No policies found matching your search.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {searchResults.map((p) => (
                    <div key={p.id}
                      onClick={() => handlePolicyClick(p.id, p.categoryId)}
                      style={{ border: "1px solid #eaeaea", borderRadius: "10px", padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px", background: "#fff", transition: "box-shadow 0.2s, border-color 0.2s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#dcdcdc"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)" }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#eaeaea"; e.currentTarget.style.boxShadow = "none" }}
                    >
                      <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "rgba(201,168,76,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <p.icon size={18} color="#c9a84c" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", fontSize: "16px", color: "#111", marginBottom: "4px" }}>{p.title}</div>
                        <div style={{ fontSize: "13px", color: "#666" }}>
                          <span style={{ color: "#c9a84c", fontWeight: "500" }}>{p.categoryLabel}</span> <span style={{ margin: "0 6px", color: "#ccc" }}>•</span> {p.summary}
                        </div>
                      </div>
                      <ChevronRight size={18} color="#ccc" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : currentPolicyInfo ? (
            <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
              <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(5px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              <div style={{ marginBottom: "40px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "13px", color: "#c9a84c", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {currentPolicyInfo.categoryLabel}
                  </span>
                  <ChevronRight size={12} color="#ccc" />
                  <span style={{ fontSize: "13px", color: "#888" }}>{currentPolicyInfo.title}</span>
                </div>
                <h1 style={{ margin: "0 0 16px 0", fontSize: "36px", fontWeight: "800", color: "#111", letterSpacing: "-1px", lineHeight: "1.2" }}>
                  {currentPolicyInfo.title}
                </h1>
                <p style={{ margin: 0, fontSize: "18px", color: "#555", lineHeight: "1.6", fontWeight: "400" }}>
                  {currentPolicyInfo.summary}
                </p>
              </div>

              <div style={{ background: "#fdf9f0", border: "1px solid #f0e0b0", borderRadius: "12px", padding: "16px 20px", marginBottom: "48px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <Info size={18} color="#c9a84c" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "14px", color: "#8a6a20", lineHeight: "1.6" }}>
                  This policy is legally binding and forms part of the Erovians Legal Framework, governed by Luxembourg law and applicable EU regulations including GDPR (2016/679), DSA (2022/2065), and the AI Act (2024/1689).
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {currentPolicyInfo.sections.map((section, idx) => (
                  <div key={idx}>
                    <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111", marginBottom: "16px", letterSpacing: "-0.5px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "#f5f5f5", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "600" }}>
                        {idx + 1}
                      </div>
                      {section.h}
                    </h2>
                    <p style={{ fontSize: "16px", color: "#444", lineHeight: "1.8", margin: 0 }}>
                      {section.c}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "60px", paddingTop: "30px", borderTop: "1px solid #eaeaea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: "13px", color: "#aaa", margin: 0 }}>Last updated: May 2026</p>
                <div style={{ display: "flex", gap: "12px" }}>

                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
      <Footer />
    </div>
  );
}