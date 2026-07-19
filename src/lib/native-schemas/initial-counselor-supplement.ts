import type { NativeFormSchema } from "@/lib/native-schemas/types";

// Native schema for the ABCAC "Supplemental Application Manual" used for the
// counselor credentials (CAC and CADAC/AADC). The CAC and CADAC/AADC PDFs are
// identical, so this is a builder parameterized by form key and credential.

const CORE_FUNCTIONS: Array<{ slug: string; name: string }> = [
  { slug: "screening", name: "Screening" },
  { slug: "intake", name: "Intake" },
  { slug: "orientation", name: "Orientation" },
  { slug: "assessment", name: "Assessment" },
  { slug: "treatment-planning", name: "Treatment Planning" },
  { slug: "counseling", name: "Counseling" },
  { slug: "case-management", name: "Case Management" },
  { slug: "crisis-intervention", name: "Crisis Intervention" },
  { slug: "client-education", name: "Client Education" },
  { slug: "referral", name: "Referral" },
  { slug: "reports-recordkeeping", name: "Reports and Recordkeeping" },
];

/** Fields for one core function block of the Supervised Field Work Practicum Log. */
function coreFunctionFields(slug: string, name: string) {
  return [
    { id: `practicum-${slug}-from`, label: `${name}: from (date)`, type: "date" as const, span: "third" as const },
    { id: `practicum-${slug}-hours`, label: `Hours completed in the ${name} process`, type: "text" as const, span: "third" as const },
    { id: `practicum-${slug}-signature`, label: `Supervisor's signature — ${name}`, type: "signature" as const, span: "third" as const },
    { id: `practicum-${slug}-date`, label: `Date signed — ${name}`, type: "date" as const, span: "third" as const },
  ];
}

const RATING_CODE_NOTES = [
  "Rating code: N/A - Not Applicable; N/K - Not Known; 1 - Poor; 2 - Fair; 3 - Average; 4 - Above Average; 5 - Superior.",
  "Evaluate the applicant as you feel he/she demonstrates abilities in each area. Mark the rating most nearly descriptive of the counselor's skills.",
];

const EVALUATION_CLINICAL_SKILLS: Array<{ slug: string; name: string; definition: string }> = [
  { slug: "client-intake", name: "Client Intake", definition: "The process of collecting client information at the beginning of treatment that is used in assessment of a client for treatment." },
  { slug: "client-assessment", name: "Client Assessment", definition: "The process by which a counselor evaluates the intake information collected in order to determine appropriate services." },
  { slug: "aod-evaluation", name: "Alcohol/Drug Abuse Evaluation", definition: "Knowledge and application of the major theories and stages of addiction and the symptomatology of alcoholism or drug dependency in assessing the client's use of chemical substances." },
  { slug: "triage", name: "Triage", definition: "Determining appropriate and timely services for the client with knowledge of his/her problems and their intensity." },
  { slug: "client-orientation", name: "Client Orientation", definition: "Individual or group sessions to familiarize clients with program services, expectations, regulations and goals." },
  { slug: "client-education", name: "Client Education", definition: "Activities which have the major goal of increasing the client's recognition of significant symptoms and patterns of problematic behavior." },
  { slug: "outreach", name: "Outreach", definition: "Direct contact by a counselor with persons in a community setting to identify and/or counsel persons with problems related to alcoholism or drug abuse." },
  { slug: "individual-counseling", name: "Individual Counseling", definition: "A one-to-one counselor/client process for the purpose of assessing a client's problems and facilitating appropriate changes." },
  { slug: "group-counseling", name: "Group Counseling", definition: "A process involving clients for the purpose of jointly exploring the client's problems and facilitating change." },
  { slug: "family-counseling", name: "Family Counseling", definition: "A process of exploring the dynamics of the family system and facilitating appropriate changes." },
  { slug: "crisis-intervention", name: "Crisis Intervention", definition: "Quickly assessing and defining the nature of a client's crisis situation and using appropriate methods of intervention." },
  { slug: "treatment-planning", name: "Treatment Planning", definition: "Defining areas of problems and needs, establishing short and long term goals, and developing appropriate strategies for reaching these goals within a time-frame." },
  { slug: "consultation", name: "Consultation", definition: "Establishing contacts with other professionals in support of the client's treatment." },
];

const EVALUATION_PERSONAL_SKILLS: Array<{ slug: string; label: string }> = [
  { slug: "common-sense", label: "Common sense in dealing with clients" },
  { slug: "respect", label: "Respect for client" },
  { slug: "care-concern", label: "Care and concern for client" },
  { slug: "empathy", label: "Empathy with client" },
  { slug: "flexibility", label: "Flexibility with clients. Ability to recognize individual client needs" },
  { slug: "spontaneity", label: "Spontaneity with clients" },
  { slug: "confrontation", label: "Capacity for confrontation with client" },
  { slug: "self-disclosure", label: "Capacity for appropriate self-disclosure" },
  { slug: "communication", label: "Ability to communicate effectively with clients and co-workers" },
  { slug: "confidentiality", label: "Ability to treat client information in accordance with state and federal confidentiality regulations" },
  { slug: "knowledge", label: "Knowledge of alcoholism and drug abuse and/or addictions" },
  { slug: "ethics", label: "Capacity to act in an ethical manner with clients and co-workers" },
  { slug: "problem-recognition", label: "Problem recognition and evaluation: ability to apply knowledge of physical, behavioral, attitudinal, and affective manifestations of alcoholism and drug abuse to determine its existence and degree of progression" },
  { slug: "limits", label: "Ability to set appropriate limits with clients and the families" },
  { slug: "supervision", label: "Ability to supervise other counselors" },
];

export function counselorSupplementSchema(formKey: string, credential: string): NativeFormSchema {
  return {
    formKey,
    intro: {
      title: `Supplemental Application for ${credential} Certification`,
      paragraphs: [
        `This supplemental application is for the ${credential} credential issued by the Arizona Board for Certification of Addiction Counselors (ABCAC), P.O. Box 83165, Phoenix, Arizona 85071 — abcac@abcac.org — 480-980-1770. ABCAC is a member of the International Certification Reciprocity Consortium / Alcohol and Other Drug Abuse (IC&RC / AODA).`,
        "All applicants must submit documentation for review and be approved for the IC&RC examination, and will be required to pass the IC&RC exam for the appropriate certification. Only the CADAC and AADC are eligible for reciprocity with IC&RC member boards.",
        "The Supervised Work Log and the Counselor Evaluation Form must be completed by an immediate supervisor and sent directly to ABCAC by the supervisor. In this portal, use the invite-signer option on the supervisor sections below so your supervisor can complete them directly.",
        "Educational requirements — Certified Addiction Counselor (CAC): High School Diploma or GED with 250 clock hours, or AA Degree with 200 clock hours; there must be 90 hours in addictions studies and the remaining hours can fall within behavioral sciences. Certified Alcohol & Drug Abuse Counselor (CADAC): Bachelor's Degree with 200 clock hours; there must be 90 hours in addictions studies and 90 hours in counseling, with the remaining hours within behavioral sciences. Advanced Alcohol and Drug Counselor (AADC): Master's Degree with 180 hours of alcohol and drug counseling specific education.",
        "In addition to the clock hours above, the applicant must have 6 hours of education in Professional Ethics and Responsibilities and 4 hours in HIV/AIDS Education. Education is defined as formal classroom education (workshops, seminars, institutes, in-services and college/university work). 1 college semester unit = 15 clock hours. All education hours must be documented and must be specifically related to the knowledge and skills necessary to perform the tasks within each IC&RC performance domain: 1 - Screening, Assessment, and Engagement; 2 - Treatment Planning, Collaboration, and Referral; 3 - Counseling; 4 - Professional and Ethical Responsibilities.",
        "Work experience — all qualifying supervised work experience must be completed within six (6) years of applying for certification. Work experience is full or part-time, paid or voluntary, working directly with clients with a diagnosis of alcohol and/or other drug abuse or dependency (AODA). Supervised work experience is experience in which the counselor receives clinical supervision (commonly one-to-one and/or small groups on a regular basis, using case review, case discussion, and direct observation of the counselor's clinical work), in the IC&RC performance domains of assessment, counseling, case management, education and professional responsibility. Unsupervised work experience may not be substituted for the experience requirement, and all experience must be documented.",
        "Ethics — the applicant must sign the Code of Ethics provided in the general application manual, addressing the NAADAC Ethical Standards principles: Non-Discrimination, Responsibility, Competence, Legal Standards and Moral Standards, Public Statements, Public Credit, Client Welfare, Confidentiality, Client Relationships, Inter-professional Relationships, Remuneration, and Societal Obligations.",
      ],
    },
    sections: [
      {
        id: "applicant",
        title: "Applicant Information",
        pdfPage: 2,
        fields: [
          { id: "applicant-name", label: "Applicant name", type: "text", required: true, span: "full" },
          { id: "applicant-email", label: "Email", type: "text", required: true, span: "half" },
          { id: "applicant-phone", label: "Phone", type: "text", required: true, span: "half" },
        ],
      },
      {
        id: "certification-selection",
        title: "Certification Applying For",
        description: "Please mark for which certification you are applying.",
        notes: ["Only the CADAC and AADC are eligible for reciprocity with IC&RC member boards."],
        pdfPage: 2,
        fields: [
          { id: "apply-cac", label: "Certified Addiction Counselor (CAC)", type: "check", span: "third" },
          { id: "apply-cadac", label: "Certified Alcohol & Drug Abuse Counselor (CADAC)", type: "check", span: "third" },
          { id: "apply-aadc", label: "Advanced Alcohol and Drug Counselor (AADC)", type: "check", span: "third" },
        ],
      },
      {
        id: "experience-requirement",
        title: "Work Experience Requirement",
        description: "Please mark which requirements you meet.",
        notes: [
          "A CADAC applicant may exchange one year of the three-year work requirement with a bachelor's or advanced degree in Behavioral Sciences.",
        ],
        pdfPage: 3,
        fields: [
          { id: "meets-cac-experience", label: "Certified Addiction Counselor (CAC): 2 years or 4,000 hours working with substance abuse clients", type: "check", span: "full" },
          { id: "meets-cadac-experience", label: "Certified Alcohol & Drug Abuse Counselor (CADAC): 3 years or 6,000 hours working with substance abuse clients", type: "check", span: "full" },
          { id: "meets-aadc-experience", label: "Advanced Alcohol and Drug Counselor (AADC): 2,000 hours of supervised alcohol and drug counseling specific work experience", type: "check", span: "full" },
        ],
      },
      {
        id: "checklist",
        title: "Certification Application Checklist",
        description: "It is the responsibility of the applicant to submit complete documentation (certificates, transcripts, etc.). Please check (X) each item in order to be certain your application is complete.",
        notes: [
          "Application must be completed within one year of applying. After one year has lapsed from the time of application, the applicant must re-apply. All fees are non-refundable.",
          "Complete the application form with all questions answered (no blank spaces). We need specific rather than general information.",
          "Fee: $375.00 non-refundable processing fee payable to the Arizona Board for Certification of Addiction Counselors (ABCAC). This is the total fee for both application manuals and includes the general application manual, the supplemental application manual, processing fees, the IC&RC exam, and 2 years of certification. If you have already passed the IC&RC exam, you only need to pay $200, which covers the application manuals, processing fees, and 2 years of certification.",
        ],
        pdfPage: 4,
        fields: [
          { id: "checklist-education-experience", label: "1. Education and experience pages filled out", type: "check", span: "full", hint: "Include copies of certificates from training programs and transcripts of education courses completed in the Documents section of your portal." },
          { id: "checklist-work-logs", label: "2. Supervision Field Work Log(s) sent to ABCAC by supervisor", type: "check", span: "full", hint: "Your supervisor can complete the log in the supervisor sections below via the invite-signer option." },
          { id: "checklist-evaluation-forms", label: "3. Evaluation Forms sent directly to ABCAC by supervisor", type: "check", span: "full", hint: "Your supervisor can complete the Counselor Evaluation Form in the supervisor sections below via the invite-signer option." },
          { id: "checklist-recommendation-letters", label: "4. Two letters of recommendation (optional but strongly encouraged)", type: "check", span: "full", hint: "Letters of reference may be sent in place of letters of recommendation. Upload letters in the Documents section of your portal." },
        ],
      },
      {
        id: "education-log",
        title: "Education",
        description: "List each course you are documenting toward the education requirement.",
        notes: ["Please include all of your certificates of completion for each course in the Documents section of your portal."],
        pdfPage: 5,
        table: {
          id: "education-log-table",
          columns: [
            { id: "course-title", label: "Title of Course", width: "wide" },
            { id: "date", label: "Date", width: "narrow" },
            { id: "hours", label: "# of hours", width: "narrow" },
            { id: "sponsor", label: "Course Sponsor", width: "wide" },
          ],
          rows: 12,
        },
      },
      {
        id: "experience-applicant",
        title: "Documentation of Experience — Section I: Applicant Information",
        description: "To be completed by the applicant.",
        notes: [
          "Applicable to this experience is any time spent providing services to substance abuse disorder and/or co-occurring mental health services within the IC&RC/ADC Domains including screening, assessment, engagement, treatment planning, therapeutic counseling, patient and family education, collaboration, referral, care coordination and professional and ethical responsibility in regard to client treatment/service.",
          "Sections II and III should be completed by the applicant's supervisor, program director or personnel office — use the invite-signer option on those sections below.",
        ],
        pdfPage: 6,
        fields: [
          { id: "exp-applicant-name", label: "Name", type: "text", required: true, span: "full" },
          { id: "exp-applicant-address", label: "Address", type: "text", required: true, span: "full" },
          { id: "exp-applicant-city", label: "City", type: "text", required: true, span: "third" },
          { id: "exp-applicant-state", label: "State", type: "text", required: true, span: "third" },
          { id: "exp-applicant-zip", label: "Zip code", type: "text", required: true, span: "third" },
        ],
      },
      {
        id: "experience-program",
        title: "Documentation of Experience — Section II: Program Information",
        description: "To be completed by the applicant's supervisor, program director or personnel office.",
        pdfPage: 6,
        signerSection: { role: "Supervisor" },
        fields: [
          { id: "exp-program-name", label: "Program name", type: "text", span: "full" },
          { id: "exp-supervisor-name-title", label: "Supervisor name and title", type: "text", span: "full" },
          { id: "exp-program-address", label: "Program address", type: "text", span: "full" },
          { id: "exp-program-city", label: "City", type: "text", span: "third" },
          { id: "exp-program-state", label: "State", type: "text", span: "third" },
          { id: "exp-program-zip", label: "Zip code", type: "text", span: "third" },
        ],
      },
      {
        id: "experience-documentation",
        title: "Documentation of Experience — Section III: Documentation of Experience",
        description: "To be completed by the applicant's supervisor, program director or personnel office.",
        notes: [
          "By signing below, I attest that the applicant (named in Section I) performed adequately at the program (named in Section II) providing supervised counseling services to substance use disorder clients within the IC&RC/ADC Domains.",
        ],
        pdfPage: 6,
        signerSection: { role: "Supervisor" },
        fields: [
          { id: "exp-position-title", label: "Applicant's position/title", type: "text", span: "full" },
          { id: "exp-beginning-date", label: "Beginning date", type: "date", span: "half" },
          { id: "exp-ending-date", label: "Ending date", type: "date", span: "half" },
          { id: "exp-fulltime-years", label: "Full time: total years of experience", type: "text", span: "half" },
          { id: "exp-parttime-hours", label: "Part-time: total hours of experience", type: "text", span: "half" },
          { id: "exp-supervisor-signature", label: "Supervisor's signature", type: "signature", span: "half" },
          { id: "exp-supervisor-signature-date", label: "Date", type: "date", span: "half" },
          { id: "exp-supervisor-printed-name-title", label: "Supervisor's printed name and title", type: "text", span: "half" },
          { id: "exp-supervisor-printed-date", label: "Date", type: "date", span: "half" },
        ],
      },
      {
        id: "practicum-applicant",
        title: "Supervised Field Work Practicum Log — Applicant",
        pdfPage: 7,
        fields: [
          { id: "practicum-applicant-name", label: "Applicant name", type: "text", required: true, span: "full" },
        ],
      },
      {
        id: "practicum-core-functions-a",
        title: "Practicum Log — Core Functions 1-4",
        description: "Supervisor's directions: by attesting and signing your name to the CORE FUNCTION work done, you are verifying that the 25 required experiential hours in the specific CORE FUNCTION indicated have been completed. It is your responsibility to verify by log or calendar or other mechanism that the function was indeed adequately and successfully completed.",
        pdfPage: 7,
        signerSection: { role: "Supervisor" },
        fields: CORE_FUNCTIONS.slice(0, 4).flatMap(({ slug, name }) => coreFunctionFields(slug, name)),
      },
      {
        id: "practicum-core-functions-b",
        title: "Practicum Log — Core Functions 5-11",
        pdfPage: 8,
        signerSection: { role: "Supervisor" },
        fields: CORE_FUNCTIONS.slice(4).flatMap(({ slug, name }) => coreFunctionFields(slug, name)),
      },
      {
        id: "practicum-core-functions-c",
        title: "Practicum Log — Core Function 12 and Supervisor Information",
        notes: ["Supervisor: in the original process these completed forms are emailed or mailed directly to ABCAC (abcac@abcac.org, P.O. Box 83165, Phoenix, Arizona 85071); completing this section through the portal fulfills the same requirement."],
        pdfPage: 9,
        signerSection: { role: "Supervisor" },
        fields: [
          { id: "practicum-consultation-from", label: "Consultation: from (date)", type: "date", span: "half" },
          { id: "practicum-consultation-to", label: "Consultation: to (date)", type: "date", span: "half" },
          { id: "practicum-consultation-hours", label: "Hours completed in the Consultation process", type: "text", span: "half" },
          { id: "practicum-consultation-signature", label: "Supervisor's signature — Consultation", type: "signature", span: "half" },
          { id: "practicum-consultation-date", label: "Date signed — Consultation", type: "date", span: "half" },
          { id: "practicum-supervisor-printed-name", label: "Supervisor printed name", type: "text", span: "half" },
          { id: "practicum-supervisor-titled-position", label: "Titled position", type: "text", span: "half" },
          { id: "practicum-supervisor-agency", label: "Agency or facility", type: "text", span: "half" },
          { id: "practicum-supervisor-phone", label: "Phone number", type: "text", span: "half" },
          { id: "practicum-supervisor-info-date", label: "Date", type: "date", span: "half" },
        ],
      },
      {
        id: "evaluation-applicant-info",
        title: "Counselor Evaluation Form — Section A",
        description: "CONFIDENTIAL — to be completed by the applicant's clinical supervisor.",
        notes: [
          "Clinical Supervisor: the employee listed on this form is applying to the Arizona Board for Certification of Addiction Counselors (ABCAC) for counselor certification. The information requested here is an essential part of the Board's evaluation process to determine knowledge and competency of the applicant and must be included to meet Board requirements.",
          "Your evaluation from direct observation and supervision of the applicant's work, in addition to other references, will determine the applicant's eligibility for certification. We require careful and truthful reporting. This form and letters addressed to the Board are CONFIDENTIAL and will not be made available to the applicant at any time.",
          "Please return the completed evaluation within one week. ABCAC reserves the right to request further information from you concerning this applicant.",
        ],
        pdfPage: 11,
        signerSection: { role: "Evaluator" },
        fields: [
          { id: "eval-applicant-name", label: "Applicant name", type: "text", span: "half" },
          { id: "eval-date", label: "Date", type: "date", span: "half" },
          { id: "eval-supervisor-name", label: "Supervisor name", type: "text", span: "half" },
          { id: "eval-supervisor-title", label: "Title", type: "text", span: "half" },
          { id: "eval-program-agency", label: "Program/agency", type: "text", span: "half" },
          { id: "eval-phone", label: "Telephone number", type: "text", span: "half" },
          { id: "eval-program-address", label: "Program address", type: "text", span: "full" },
        ],
      },
      {
        id: "evaluation-clinical-skills",
        title: "Counselor Evaluation Form — Section B: Counseling Skills",
        description: "The following items represent the skills needed by a substance abuse counselor.",
        notes: RATING_CODE_NOTES,
        pdfPage: 11,
        signerSection: { role: "Evaluator" },
        fields: EVALUATION_CLINICAL_SKILLS.map(({ slug, name, definition }, index) => ({
          id: `eval-skill-${slug}`,
          label: `${index + 1}. ${name}`,
          type: "text" as const,
          span: "half" as const,
          placeholder: "N/A, N/K, or 1-5",
          hint: definition,
        })),
      },
      {
        id: "evaluation-personal-skills",
        title: "Counselor Evaluation Form — Section C: Professional Qualities",
        description: "The following items represent the skills needed by a substance abuse counselor. Mark the rating code that most nearly describes the counselor's demonstrated skills.",
        notes: [
          ...RATING_CODE_NOTES,
          "D. Please attach the most recent counselor supervisory evaluation, if available — it can be uploaded in the Documents section of the portal.",
        ],
        pdfPage: 12,
        signerSection: { role: "Evaluator" },
        fields: EVALUATION_PERSONAL_SKILLS.map(({ slug, label }, index) => ({
          id: `eval-quality-${slug}`,
          label: `${index + 1}. ${label}`,
          type: "text" as const,
          span: "half" as const,
          placeholder: "N/A, N/K, or 1-5",
        })),
      },
      {
        id: "evaluation-statement",
        title: "Counselor Evaluation Form — Section E: Evaluator's Statement",
        pdfPage: 13,
        signerSection: { role: "Evaluator" },
        fields: [
          { id: "eval-supervised-how-long", label: "How long have you supervised this applicant?", type: "text", span: "full" },
          { id: "eval-supervised-from", label: "Dates from", type: "date", span: "half" },
          { id: "eval-supervised-to", label: "To", type: "date", span: "half" },
          { id: "eval-caseload-size", label: "What is/was the size of the counselor's caseload?", type: "text", span: "full" },
          { id: "eval-individual-hours", label: "Average number of hours/week counselor worked in individual counseling", type: "text", span: "half" },
          { id: "eval-group-hours", label: "Average number of hours/week worked in group counseling", type: "text", span: "half" },
          { id: "eval-special-skills", label: "Any special skills of the counselor? Please describe.", type: "textarea", span: "full" },
          { id: "eval-counseling-major-from", label: "Period of time, while under your supervision, when counseling was the major part of this applicant's responsibility — from", type: "date", span: "half" },
          { id: "eval-counseling-major-to", label: "To", type: "date", span: "half" },
          { id: "eval-comments", label: "Comments and/or additional information you feel may be pertinent", type: "textarea", span: "full" },
          { id: "eval-certify-applicant-name", label: "I hereby certify that I have been in a position to observe and have first-hand knowledge of (applicant's name)", type: "text", span: "half" },
          { id: "eval-certify-program-agency", label: "...'s work at (program/agency)", type: "text", span: "half" },
          { id: "eval-recommend-yes", label: "I recommend this applicant for certification as an alcoholism counselor and/or drug abuse counselor", type: "check", span: "full", hint: "Check one of the three recommendation options." },
          { id: "eval-recommend-reservations", label: "I have some reservations in recommending this applicant", type: "check", span: "full" },
          { id: "eval-recommend-no", label: "I do not recommend this applicant as an alcoholism counselor and/or drug abuse counselor", type: "check", span: "full" },
        ],
      },
      {
        id: "evaluation-certification",
        title: "Counselor Evaluation Form — Certification and Section F: Evaluator Background",
        notes: ["In the original process this form is emailed or mailed directly to ABCAC (abcac@abcac.org, P.O. Box 83165, Phoenix, Arizona 85071); completing this section through the portal fulfills the same requirement."],
        pdfPage: 14,
        signerSection: { role: "Evaluator" },
        fields: [
          { id: "eval-certify-signature", label: "Signature of the Clinical Supervisor or Evaluator", type: "signature", span: "full", hint: "I hereby certify that all of the above information is true to the best of my knowledge." },
          { id: "eval-employed-how-long", label: "How long have you been employed by this program?", type: "text", span: "half" },
          { id: "eval-training-source", label: "Where did you receive your training in Counseling?", type: "text", span: "half" },
          { id: "eval-certificates-licenses", label: "Professional certificates or licenses you hold", type: "text", span: "full" },
          { id: "eval-admin-none", label: "a.) No", type: "check", span: "full", hint: "Are you involved in the administration/management of the program at which you are employed? Check one." },
          { id: "eval-admin-clinical", label: "b.) Yes, limited to clinical aspects (i.e., supervision of counselors)", type: "check", span: "full" },
          { id: "eval-admin-administrative", label: "c.) Yes, limited to administrative responsibilities such as budgeting", type: "check", span: "full" },
          { id: "eval-admin-both", label: "d.) Yes, both clinically and administratively", type: "check", span: "full" },
          { id: "eval-clinical-supervisor-signature", label: "Clinical Supervisor signature", type: "signature", span: "full" },
        ],
      },
      {
        id: "recertification-info",
        title: "Requirements for Recertification (For Your Reference)",
        notes: [
          "Certification by the Arizona Board for Certification of Addiction Counselors is valid for two years.",
          "To be recertified you must verify forty (40) clock hours of Continuing Education related to substance abuse during the past two years. At least twenty (20) of these hours must be acquired outside your agency.",
          "Three hours of CEUs in Ethics and three hours of CEUs in Cultural Diversity training are required.",
          "Please be prepared to offer genuine verification of training by providing a copy of a certificate of participation or a letter from the training source verifying participation and number of clock hours of instruction. (Grade reports from an academic institution are acceptable.)",
          "For outside training to be accepted by ABCAC, it must contribute to upgrading your skills and/or knowledge in Addiction Counseling and related behavioral health problems (see Core Functions and Global Criteria). Examples of acceptable training: junior college or university courses in Counseling, Psychology, Sociology or related fields; schools, workshops, and seminars which offer education and training in addictions or related behavioral health fields and provide verifiable documentation of participation including the number of clock hours of instruction received.",
          "Inservice training must also be documented: provide a list of specific topics covered and the amount of time spent on each. NO MORE THAN 20 HOURS WILL BE ALLOWED FOR INSERVICE TRAINING.",
        ],
        pdfPage: 15,
      },
    ],
  };
}
