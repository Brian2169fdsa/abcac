import type { NativeFormSchema } from "@/lib/native-schemas/types";

// Native (HTML) version of the ABCAC "General Application Manual" —
// the initial certification application shared by every credential.
// Reproduces pages 1-17 of the original PDF: application criteria and
// checklist, the Application for Certification (demographics + background),
// employment and education history, Residential Certification, the ABCAC
// Code of Ethics, the NAADAC ethical standards, disciplinary procedures,
// and exam information.

export const INITIAL_GENERAL_SCHEMA: NativeFormSchema = {
  formKey: "initial-general",
  intro: {
    title: "ABCAC General Application Manual — Application for Certification",
    paragraphs: [
      "Arizona Board for Certification of Addiction Counselors (ABCAC), P.O. Box 83165, Phoenix, Arizona 85071 — Abcac@abcac.org — 480-980-1770. ABCAC is a member of the International Certification Reciprocity Consortium / Alcohol and Other Drug Abuse (IC&RC / AODA).",
      "All applicants must submit documentation for review and be approved for the written examination, and all applicants will be required to pass the written exam. An applicant may choose to apply for certification as: Certified Addiction Counselor (CAC), Certified Alcohol & Drug Abuse Counselor (CADAC), Advanced Alcohol and Drug Abuse Counselor (AADC), Certified Clinical Supervisor (CCS), Certified Prevention Specialist (CPS), Certified Criminal Justice Professional (CCJP), or Certified Peer Recovery Specialist (CPRS).",
      "Residency in the state of Arizona for one year immediately prior to application is required of all applicants for initial certification.",
      "Applicant fees: $150.00 Application Manual; $225.00 Testing; $225.00 Retest; $30.00 Returned checks. All fees are non-refundable. Payment is handled at checkout in this portal.",
      "Educational requirements: see the specific supplement packet for each credential. Education is defined as formal classroom education (workshops, seminars, institutes, inservices and college/university work) specifically related to the knowledge and skills necessary to perform the tasks within each IC&RC credential. 1 college semester unit = 15 clock hours. All education hours must be documented.",
      "Work experience: all qualifying supervised work experience must be completed within six (6) years of applying for certification. Work experience is full or part-time, paid or voluntary, working directly with clients. Supervised work experience means experience in which the counselor receives clinical supervision in the IC&RC performance domains. Unsupervised work experience may not be substituted for the experience requirement, and all experience must be documented.",
      "Ethics: the applicant must sign a counselor specific code of ethics statement of affirmation that the applicant has read and will abide by the code of ethics.",
      "The application must be completed within one year of applying. After one year has lapsed from the time of application, the applicant must re-apply.",
    ],
  },
  sections: [
    {
      id: "checklist",
      title: "Certification Application Checklist",
      description:
        "It is the responsibility of the applicant to submit complete documentation (certificates, transcripts, etc.). Complete the application form with all questions answered (no blank spaces) — we need specific rather than general information. Please check each item in order to be certain your application is complete.",
      pdfPage: 3,
      notes: [
        "Upload copies of certificates from training programs, official transcripts of education courses completed, and any other relevant documentation in the Documents section of your portal.",
      ],
      fields: [
        {
          id: "checklist-application",
          label: "Application for Certification completed, with copies of certificates from training programs, official transcripts of education courses completed, and any other relevant documentation provided.",
          type: "check",
          span: "full",
        },
        {
          id: "checklist-residential-ethics",
          label: "I have read and signed the “Residential Certification” and the “Code of Ethics” provided in this packet.",
          type: "check",
          span: "full",
        },
      ],
    },
    {
      id: "applicant-info",
      title: "Application for Certification",
      pdfPage: 4,
      fields: [
        { id: "name-last", label: "Last name", type: "text", required: true, span: "third" },
        { id: "name-first", label: "First name", type: "text", required: true, span: "third" },
        { id: "name-middle", label: "Middle name", type: "text", span: "third" },
        { id: "birth-date", label: "Birth date", type: "date", required: true, span: "half" },
        { id: "street-address", label: "Street address", type: "text", required: true, span: "half" },
        { id: "city", label: "City", type: "text", required: true, span: "third" },
        { id: "state", label: "State", type: "text", required: true, span: "third" },
        { id: "zip", label: "ZIP", type: "text", required: true, span: "third" },
        { id: "home-phone", label: "Home telephone", type: "text", span: "half" },
        { id: "business-phone", label: "Business telephone", type: "text", span: "half" },
        {
          id: "email",
          label: "Email",
          type: "text",
          required: true,
          span: "half",
          hint: "Please provide the best contact email; this will be used for exam registration.",
        },
        { id: "drivers-license", label: "Driver’s License #", type: "text", span: "half" },
      ],
    },
    {
      id: "background-other-state",
      title: "Background Information — Other Licensure or Certification",
      pdfPage: 4,
      fields: [
        {
          id: "background-held-other",
          label: "Do you hold, or have you ever held licensure, certification, or registration in any other state?",
          type: "yesno",
          required: true,
          hint: "If yes, complete the table below.",
        },
      ],
      table: {
        id: "other-credentials-table",
        columns: [
          { id: "title", label: "Title of Credential/Licensure", width: "wide" },
          { id: "state", label: "State", width: "narrow" },
          { id: "date-issued", label: "Date Issued", width: "narrow" },
          { id: "status", label: "Current Status", width: "narrow" },
        ],
        rows: 3,
      },
    },
    {
      id: "background-association",
      title: "Background Information — Professional Association Certificates",
      pdfPage: 4,
      fields: [
        {
          id: "background-held-association",
          label: "Do you hold a certificate through a behavioral health professional association?",
          type: "yesno",
          required: true,
          hint: "If yes, give the professional credential held in the table below.",
        },
      ],
      table: {
        id: "association-certificates-table",
        columns: [
          { id: "title", label: "Title of Certificate", width: "wide" },
          { id: "state", label: "State", width: "narrow" },
          { id: "date-issued", label: "Date Issued", width: "narrow" },
          { id: "status", label: "Current Status", width: "narrow" },
        ],
        rows: 3,
      },
    },
    {
      id: "background-questions",
      title: "Background Questions",
      pdfPage: 4,
      fields: [
        {
          id: "background-denied",
          label: "Have you ever applied for and been denied a license, certificate or registration in any behavioral health profession?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-disciplined",
          label: "Have you ever had any disciplinary action taken against you by the authority issuing the license, certificate or registration in any behavioral health profession?",
          type: "yesno",
          required: true,
        },
      ],
    },
    {
      id: "background-questions-continued",
      title: "Background Questions (continued)",
      pdfPage: 5,
      fields: [
        {
          id: "background-surrendered",
          label: "Have you ever surrendered or canceled your license, certification or registration in lieu of disciplinary proceedings by the issuing authority in any behavioral health profession?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-association-discipline",
          label: "Have you ever been the subject of a disciplinary action by a regulatory committee of a professional association?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-convicted",
          label: "Have you ever been convicted or pled guilty or pled no contest to a criminal offense?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-malpractice",
          label: "Have you ever been the defendant in a malpractice suit, and either entered into a settlement agreement or paid court-awarded damages, or is there such a suit pending?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-terminated",
          label: "Have you ever been involuntarily terminated from any behavioral health or related employment for unprofessional conduct?",
          type: "yesno",
          required: true,
        },
        {
          id: "background-explanation",
          label: "If the answer to any of these questions is YES, please explain",
          type: "textarea",
          span: "full",
          hint: "Enclose any relevant documents by uploading them in the Documents section of your portal.",
        },
        { id: "background-printed-name", label: "Printed name", type: "text", required: true, span: "full" },
        { id: "background-signature", label: "Signature", type: "signature", required: true, span: "half" },
        { id: "background-signature-date", label: "Date", type: "date", required: true, span: "half" },
      ],
    },
    {
      id: "employment-history",
      title: "Employment History",
      description:
        "Previous supervised positions in addiction-related fields within the last six (6) years. If you have more than two positions, list the additional positions in a document uploaded to the Documents section of your portal.",
      pdfPage: 6,
      fields: [
        { id: "employer-1-name", label: "Name of employer", type: "text", span: "half" },
        { id: "employer-1-position", label: "Position", type: "text", span: "half" },
        { id: "employer-1-supervisor", label: "Name of supervisor", type: "text", span: "half" },
        { id: "employer-1-from", label: "Length of employment — from", type: "date", span: "third" },
        { id: "employer-1-to", label: "Length of employment — to", type: "date", span: "third" },
        { id: "employer-1-hours", label: "Hours worked per week", type: "text", span: "third" },
        { id: "employer-1-duties", label: "Duties of position held", type: "textarea", span: "full" },
        { id: "employer-2-name", label: "Name of employer", type: "text", span: "half" },
        { id: "employer-2-position", label: "Position", type: "text", span: "half" },
        { id: "employer-2-supervisor", label: "Name of supervisor", type: "text", span: "half" },
        { id: "employer-2-from", label: "Length of employment — from", type: "date", span: "third" },
        { id: "employer-2-to", label: "Length of employment — to", type: "date", span: "third" },
        { id: "employer-2-hours", label: "Hours worked per week", type: "text", span: "third" },
        { id: "employer-2-duties", label: "Duties of position held", type: "textarea", span: "full" },
      ],
    },
    {
      id: "education-history",
      title: "Education History",
      pdfPage: 7,
      table: {
        id: "education-history-table",
        columns: [
          { id: "level", label: "Level of Education", width: "narrow" },
          { id: "school", label: "School Name", width: "wide" },
          { id: "dates", label: "Dates of Attendance", width: "narrow" },
          { id: "major", label: "Major/Degree", width: "wide" },
        ],
        rows: 5,
        fixedFirstColumn: ["High School", "GED", "College", "Graduate School", "Graduate School"],
      },
    },
    {
      id: "residential-certification",
      title: "Residential Certification",
      description:
        "THIS IS TO CERTIFY THAT I HAVE BEEN A RESIDENT OF THE STATE OF ARIZONA FOR A PERIOD OF AT LEAST ONE YEAR IMMEDIATELY PRIOR TO SUBMITTING APPLICATION.",
      pdfPage: 7,
      fields: [
        { id: "residency-signature", label: "Signature", type: "signature", required: true, span: "half" },
        { id: "residency-date", label: "Date", type: "date", required: true, span: "half" },
      ],
    },
    {
      id: "release-agreement",
      title: "Release and Agreement",
      pdfPage: 7,
      notes: [
        "I hereby give ABCAC permission to contact the persons and institutions whom I have listed and who have provided references. I understand that certification carries no legal or licensing implication. I understand this application does not guarantee certification.",
        "I further agree to hold ABCAC and its Credentialing Committees, Board officers, Board members, agents, staff, and examiners free from any civil liability or damages by reason of any action that is within their scope or arises from the performance of their duties in deciding this certification or any other activity as provided by law or regulation.",
        "If I am awarded certification and I violate the ABCAC Code of Ethics or have a sanction lodged against me, I am aware that ABCAC may publish or release my name to a National Data Bank of Discipline for AODA Counselors.",
      ],
      fields: [
        { id: "release-signature", label: "Signature", type: "signature", required: true, span: "half" },
        { id: "release-date", label: "Date", type: "date", required: true, span: "half" },
        { id: "release-print-name", label: "Print name", type: "text", required: true, span: "full" },
      ],
    },
    {
      id: "code-of-ethics",
      title: "Code of Ethics",
      description: "I DO AFFIRM:",
      pdfPage: 8,
      notes: [
        "That my primary goal is recovery for the client and the client’s family.",
        "That I have a total commitment to provide the highest quality of care to those who seek my professional services.",
        "That I shall invest a genuine interest in all my clients, and do hereby dedicate myself to the best interest of my clients and to helping them help themselves.",
        "That I shall maintain at all times an objective, non-possessive, professional relationship with all my clients.",
        "That I shall be willing to recognize when it is in the best interest of my clients to release and refer them to another program or another helping individual.",
        "That I shall adhere to the Rule of Confidentiality with regard to all records, materials and knowledge concerning my client.",
        "That I shall not in any way discriminate between clients or fellow professionals on the basis of race, color, creed, age, sex or sexual preference.",
        "That I shall respect the rights and views of my fellow alcoholism counselors and other professionals.",
        "That I shall maintain respect for institutional policies and management within agencies, and will take initiative toward improvement of such policies and management when it will better serve the interests of my clients.",
        "That I have a continuing commitment to assess my own personal strengths, limitations, biases and effectiveness.",
        "That I shall continuously strive for self-improvement and professional growth through further education and training.",
        "That I have individual responsibility for my own conduct in all areas, including but not limited to, use of mood-altering drugs.",
        "These things I pledge to my professional peers and to my clients.",
      ],
      fields: [
        {
          id: "ethics-agree",
          label: "I have read the entire ABCAC Code of Ethics and do subscribe to it.",
          type: "check",
          required: true,
          span: "full",
        },
        { id: "ethics-signature", label: "Signature", type: "signature", required: true, span: "half" },
        { id: "ethics-date", label: "Date", type: "date", required: true, span: "half" },
      ],
    },
    {
      id: "naadac-ethical-standards",
      title: "NAADAC Ethical Standards of Alcoholism and Drug Abuse Counselors (reference)",
      description:
        "The National Association of Alcoholism and Drug Abuse Counselors (NAADAC) is comprised of professional alcoholism and drug abuse counselors who, as responsible health care professionals, believe in the dignity and worth of human beings. In the practice of their profession they assert that the ethical principles of autonomy, beneficence and justice should guide their professional conduct. This section is provided for reference; no entries are required.",
      pdfPage: 9,
      notes: [
        "Principle 1 — Non-discrimination: the counselor should not discriminate against clients or professionals based on race, religion, age, sex, handicaps, national ancestry, sexual orientation or economic condition.",
        "Principle 2 — Responsibility: the counselor should espouse objectivity and integrity, and maintain the highest standards in the services the counselor offers, both as teacher and as practitioner.",
        "Principle 3 — Competence: the counselor should recognize national standards of competency and the need for ongoing education; prevent practice by unqualified persons; report unethical conduct to the appropriate certifying authority; recognize the boundaries of the counselor’s competencies; and recognize the effect of personal impairment on professional performance, seeking appropriate treatment for oneself or a colleague.",
        "Principle 4 — Legal Standards and Moral Standards: the counselor should uphold the legal and accepted moral codes pertaining to professional conduct, not claim qualifications or affiliations the counselor does not possess, and not permit the counselor’s name to be used in incorrect or misleading ways.",
        "Principle 5 — Public Statements: the counselor should respect the limits of present knowledge in public statements, report fairly and accurately, acknowledge and document materials and techniques used, and indicate requisite training/qualifications when conducting training.",
        "Principle 6 — Publication Credit: the counselor should assign credit to all who have contributed to published material, recognize joint authorship, and acknowledge minor contributions and directly influencing sources through citations.",
        "Principle 7 — Client Welfare: the counselor should respect the integrity and protect the welfare of the person or group with whom the counselor is working, be concerned primarily with the welfare of the client in professional conflicts, terminate counseling when the client is not benefiting, assume responsibility for the client’s welfare in referral cases, use released information for expressed purposes only, and ensure an appropriate setting for clinical work.",
        "Principle 8 — Confidentiality: the counselor should embrace, as a primary obligation, the duty of protecting the privacy of clients and should not disclose confidential information acquired in teaching, practice or investigation, revealing information received in confidence only when there is clear and imminent danger to the client or other persons, and then only to appropriate professional workers or public authorities.",
        "Principle 9 — Client Relationships: the counselor should inform the prospective client of the important aspects of the potential relationship, inform the designated guardian when the client is a minor or incompetent, not enter into professional relationships with family or close associates, and not engage in any type of sexual activity with a client.",
        "Principle 10 — Interprofessional Relationships: the counselor should treat colleagues with respect, courtesy and fairness, not offer services to a client in counseling with another professional except with that professional’s knowledge, and cooperate with duly constituted professional ethics committees.",
        "Principle 11 — Remuneration: the counselor should establish financial arrangements that safeguard the best interests of the client, the counselor and the profession; not send or receive any commission, rebate or other remuneration for referral of clients (no fee splitting); and not accept a private fee for professional work with a person entitled to such services through an institution or agency.",
        "Principle 12 — Societal Obligations: the counselor should advocate changes in public policy and legislation to afford opportunity and choice for all persons whose lives are impaired by alcoholism and other forms of drug addiction, and adopt a personal and professional stance which promotes the well-being of all human beings.",
      ],
    },
    {
      id: "disciplinary-procedures",
      title: "Procedures for Investigation of Alleged Disciplinary Violations (reference)",
      description:
        "These procedures govern the investigation of allegations of ethical violations by persons certified by ABCAC. Persons seeking certification and recertification are, by voluntarily submitting to the certification or recertification process, agreeing to be bound by the Ethical Code of the organization and by these procedures. This section is provided for reference; no entries are required.",
      pdfPage: 14,
      notes: [
        "All complaints must be in writing, addressed to the ABCAC Ethics Committee, P.O. Box 3266, Chandler, AZ 85244 (or the official office of ABCAC), and must contain a summary of the facts supporting the allegation and the name, address, and telephone number of the person making the charge, with legible copies of supporting documents.",
        "All allegations and investigatory materials will be kept confidential to the best of the Ethics Committee’s and the Board of Directors’ ability; the person charged will be given notice and, absent extraordinary circumstances, is entitled to see a copy of the charge. If ethical violations are found to have occurred, the Board of Directors, in its discretion, will publish the action taken.",
        "The Ethics Committee (or its authorized investigators) investigates the charge, makes an initial determination of merit, and recommends disciplinary action to the Board of Directors, which makes the final determination by majority vote and notifies both parties in writing.",
        "Either party may request reconsideration in writing within 15 days after receipt of the Board’s determination; the Board has sole discretion to reopen any proceeding. No complaint shall be considered if it is submitted more than one year after the alleged ethics violation occurred.",
        "The costs of the investigation are borne by the person against whom an ethical violation is found (if found), by the person making a frivolous allegation, and by ABCAC in all other instances.",
        "Disciplinary action may include oral reprimand, written reprimand, censure, suspension of certificate, probation or revocation of certificate, at the sole discretion of the Board of Directors. Any investigator, Ethics Committee member, or Board member with a direct interest in the outcome shall excuse himself or herself from participating.",
      ],
    },
    {
      id: "exam-information",
      title: "Exam Information (reference)",
      description:
        "This examination provides a portion of the criteria utilized to certify alcohol/drug counselors and assists the Certification Board in evaluating the knowledge and competency of candidates. This section is provided for reference; no entries are required.",
      pdfPage: 16,
      notes: [
        "The certification exam is composed of 150 multiple-choice questions; candidates have 3 hours to complete the exam. One answer (and only one) is correct.",
        "Upon application approval, the applicant will be notified and registered for the appropriate IC&RC exam. All IC&RC exams are provided by computer-based testing at designated testing sites in all IC&RC member states and countries; in Arizona there are testing sites in Flagstaff and Phoenix, but the candidate can take the exam anywhere they choose. Once registered, the candidate receives an email directly from the testing site to schedule their exam — provide a good contact email to ABCAC for exam registration. Candidates choose their testing day and time within a 1-year period beginning the day of registration. Study guides: http://internationalcredentialing.org/examprep.",
        "Rules: exam candidates must bring a government issued ID and their candidate letter to the testing site on the day and time of their scheduled exam. Nothing is allowed in the testing room. Preliminary results are given as soon as the exam is submitted or time has expired; official results are mailed within 1-2 weeks.",
        "Retests: if an individual fails the initial exam, they may retake the exam up to 3 times using the original application. A fee of $225.00 will be charged for each retest. Three (3) failures will require the applicant to repeat the entire application process.",
        "Complaint process: a Complaint is made by writing to the ABCAC Ethics Committee within thirty (30) days of notification of ABCAC’s action, stating the reason and including any necessary supporting data. Complaints not received within thirty (30) days will not be processed and ABCAC’s initial actions will stand. The Ethics Committee will re-evaluate the action/decision and the applicant will receive written notification of its decision. All costs incurred by the individual making the Complaint are the sole responsibility of the complaining party.",
      ],
    },
  ],
};
