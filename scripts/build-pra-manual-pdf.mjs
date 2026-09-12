#!/usr/bin/env node
// One-time asset build: renders the Peer Recovery Associate Application
// Manual (content transcribed verbatim from PRA-Application-Manual-2.docx,
// uploaded by ABCAC) as a paginated, printable PDF at
// public/forms/library/initial-pra.pdf.
//
// LibreOffice (soffice) is not usable in this environment to convert the
// source .docx directly (it fails to load even a trivial file here), so this
// recreates the manual as a plain, faithful text-flow PDF with pdf-lib
// instead of relying on that conversion. Re-run after any content edit:
//   node scripts/build-pra-manual-pdf.mjs

import { writeFileSync } from "fs";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

const NAVY = rgb(0x1f / 255, 0x3a / 255, 0x5f / 255);
const BRAND = rgb(0x86 / 255, 0x1f / 255, 0x24 / 255);
const INK = rgb(0x1c / 255, 0x24 / 255, 0x30 / 255);
const MUTED = rgb(0x45 / 255, 0x4f / 255, 0x5e / 255);

const MARGIN = 60;
const [PAGE_W, PAGE_H] = PageSizes.Letter;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Content blocks ───────────────────────────────────────────────────────
// b() helpers build the same {type, text, ...} shape the renderer expects.
const h1 = (text) => ({ type: "h1", text });
const h2 = (text) => ({ type: "h2", text });
const h3 = (text) => ({ type: "h3", text });
const p = (text) => ({ type: "p", text });
const li = (text) => ({ type: "li", text });
const field = (text) => ({ type: "field", text });
const note = (text) => ({ type: "note", text });
const gap = () => ({ type: "gap" });
const page = () => ({ type: "page" });
const hr = () => ({ type: "hr" });

const blocks = [
  h1("Arizona Board for Certification of Addiction Counselors"),
  h2("PEER RECOVERY ASSOCIATE — Application Manual"),
  note("IC&RC Credential Code: PR-A"),
  note("abcacb@abcac.org  |  (480) 980-1770  |  PO Box 83165, Phoenix, AZ 85071  |  www.abcac.org"),
  gap(),
  h3("About the Peer Recovery Associate Credential"),
  p("The Peer Recovery Associate (PR-A) credential is offered by the Arizona Board for Certification of Addiction Counselors (ABCAC) in partnership with the International Certification & Reciprocity Consortium (IC&RC). This credential is designed for individuals who have personal lived experience with mental health and/or substance use conditions and who wish to provide peer support services in the state of Arizona."),
  p("Peer Recovery Associates serve as a critical bridge between people in recovery and the behavioral health system. They offer hope, guidance, and connection to resources through the unique power of shared lived experience."),
  p("IC&RC Reciprocity: The PR-A credential is recognized across all IC&RC member boards, enabling reciprocal certification for qualified applicants who relocate or practice across state lines."),
  gap(),
  field("Certifying Board:  Arizona Board for Certification of Addiction Counselors (ABCAC)"),
  field("Credential Name:  Peer Recovery Associate"),
  field("IC&RC Code:  PR-A"),
  field("Application Fee:  $150.00 (non-refundable)"),
  field("Renewal:  Every two (2) years | 20 continuing education hours | $150.00 renewal fee"),
  field("Contact:  abcacb@abcac.org  |  (480) 980-1770  |  www.abcac.org"),
  page(),

  h2("Application Criteria"),
  p("To qualify for the Peer Recovery Associate credential, applicants must meet ALL of the following requirements. Documentation for each requirement must be submitted with the completed application."),
  h3("1. Lived Experience"),
  p("The applicant must have personal lived experience with a mental health and/or substance use condition and must demonstrate how that experience informs their peer support work. Lived experience must be described and attested on Form B (Lived Experience Attestation), included in this application packet."),
  h3("2. Training"),
  p("The applicant must complete a minimum of 40 hours of training through an AHCCCS-recognized Peer Support Employment Training Program. Training must cover the four IC&RC PR-A practice domains: (1) Advocacy, (2) Education & Support, (3) Community Resources, and (4) Professional Responsibility. A minimum of 6 hours must specifically address ethics. Applicants must submit a certificate of completion or a signed letter from the training provider documenting the number of hours completed."),
  h3("3. Examination"),
  p("The applicant must pass the board-approved examination administered through their AHCCCS-recognized Peer Support Employment Training Program. The examination is not administered through a third-party testing center. Applicants must submit proof of passing (certificate or letter from the training provider) with the application."),
  h3("4. Supervision Agreement"),
  p("The applicant must submit a completed Supervision Agreement (Form C) identifying a qualified supervisor who will oversee their peer support practice. The agreement must be signed by both the applicant and the supervisor prior to or at the time of application. Supervised practice hours shall not exceed 120 hours for purposes of the PR-A application."),
  h3("5. Code of Ethics"),
  p("The applicant must sign the ABCAC Code of Ethics Affirmation (Form A), affirming that they have read, understand, and will abide by the NAADAC Ethical Standards (Principles 1–12) and the peer-specific ethical principles adopted by ABCAC. The signed Form A must be submitted with the application."),
  h3("6. Application Fee"),
  p("A non-refundable application fee of $150.00 must be submitted with the completed application. Checks or money orders should be made payable to: Arizona Board for Certification of Addiction Counselors. ABCAC does not accept cash."),
  h3("7. Arizona Residency / Jurisdiction"),
  p("Applicants must demonstrate that the primary location of their peer support practice is within the state of Arizona. A minimum of 51% of the applicant's peer support professional activities must occur within Arizona. The applicant must attest to Arizona residency and practice jurisdiction on the Application for Certification."),
  page(),

  h2("Certification Application Checklist"),
  p("Complete all items below before submitting your application to ABCAC. Incomplete applications will not be processed."),
  li("Completed Application for Certification (this packet — all pages, fully completed and signed)"),
  li("Form A — Code of Ethics Affirmation (signed by applicant)"),
  li("Form B — Lived Experience Attestation (signed by applicant)"),
  li("Form C — Supervision Agreement (signed by both applicant and supervisor)"),
  li("Training Documentation — training certificate or letter confirming 40 hours from an AHCCCS-recognized Peer Support Employment Training Program"),
  li("Examination Documentation — examination certificate or letter confirming passing score from the training provider"),
  li("Application Fee — non-refundable application fee of $150.00 (check or money order payable to ABCAC)"),
  gap(),
  h3("Submit completed application to:"),
  p("Arizona Board for Certification of Addiction Counselors (ABCAC), PO Box 83165, Phoenix, AZ 85071. Applications may also be submitted by email to abcacb@abcac.org. Please contact ABCAC at (480) 980-1770 to confirm current submission procedures."),
  page(),

  h1("APPLICATION FOR CERTIFICATION"),
  h2("Peer Recovery Associate (PR-A)"),
  hr(),
  h3("Section A — Applicant Information"),
  field("Last Name: ______________________  First Name: ______________________  Middle Initial: ____"),
  field("Preferred Name (if different): ________________________  Date of Birth (MM/DD/YYYY): __________"),
  field("Current Street Address: ____________________________________________________"),
  field("City: ________________________  State: ________  ZIP Code: ____________"),
  field("Home Phone: ________________________  Cell Phone: ________________________"),
  field("Email Address: ____________________________________________________"),
  field("Driver's License Number: ________________________  State of Issuance: ______________"),
  gap(),
  h3("Section B — Training & Examination"),
  field("Name of AHCCCS-Recognized Peer Support Employment Training Program: ____________________________"),
  field("Training Provider / Organization: ____________________________________________________"),
  field("Training Start Date: ____________  Training End Date: ____________  Total Hours Completed: ______"),
  field("Examination Date: ____________  Examination Result (Pass/Fail): ____________"),
  field("Name of Person / Organization Administering Examination: ____________________________________"),
  gap(),
  h3("Section C — Current Employment / Practice Setting"),
  field("Current Employer / Agency: ____________________________________________________"),
  field("Employer Address: ____________________________________________________"),
  field("Job Title: ________________________  Start Date: ____________"),
  field("Supervisor Name: ________________________  Supervisor Phone: ________________________"),
  field("Supervisor Email: ____________________________________________________"),
  field("Hours Per Week in Peer Support Role: ____________  % of Practice in Arizona: __________"),
  page(),

  h3("Section D — Background Information"),
  p("Answer all questions truthfully. Answer YES or NO by checking the appropriate box. If you answer YES to any question, provide a full written explanation on a separate sheet of paper and attach it to this application."),
  li("1. Do you currently hold any other professional certifications or credentials in behavioral health, addiction counseling, or peer support?   YES [ ]   NO [ ]"),
  li("2. Have you ever held a behavioral health certification, license, or credential in Arizona or any other state?   YES [ ]   NO [ ]"),
  li("3. Has a certification, license, or credential application ever been denied, withdrawn, or rejected by any board or organization?   YES [ ]   NO [ ]"),
  li("4. Has any disciplinary action ever been taken against a certification, license, or credential you hold or held?   YES [ ]   NO [ ]"),
  li("5. Have you ever voluntarily surrendered a certification, license, or credential while under investigation or to avoid disciplinary action?   YES [ ]   NO [ ]"),
  li("6. Are you currently under investigation by any professional regulatory body, certifying organization, or licensing board?   YES [ ]   NO [ ]"),
  li("7. Have you ever been convicted of a crime (felony or misdemeanor), pled guilty or no contest, or had a conviction expunged or set aside?   YES [ ]   NO [ ]"),
  li("8. Has a civil judgment or malpractice claim ever been entered against you in connection with your professional services?   YES [ ]   NO [ ]"),
  li("9. Have you ever been involuntarily terminated from employment for reasons related to professional conduct, substance use, or client safety?   YES [ ]   NO [ ]"),
  gap(),
  h3("Section E — Arizona Residency & Jurisdiction Certification"),
  p("I certify that I am a resident of the state of Arizona and that the primary location of my peer support practice is within Arizona. I further certify that at least 51% of my professional peer support activities occur within the state of Arizona."),
  field("Applicant Signature: ____________________________________  Date: ____________"),
  page(),

  h3("Section F — Release and Authorization"),
  p("I authorize the Arizona Board for Certification of Addiction Counselors (ABCAC) to investigate all information provided in this application. I authorize all persons and organizations, including employers, educational institutions, training providers, licensing and certifying bodies, and law enforcement agencies to release any information requested by ABCAC in connection with this application. I agree to waive any privilege or claim relating to such information for purposes of this application process. I understand that the submission of false, fraudulent, or misleading information is grounds for denial, suspension, or revocation of certification and may subject me to other legal consequences. I attest that all information provided in this application is true, accurate, and complete to the best of my knowledge."),
  field("Applicant Signature: ____________________________________  Date: ____________"),
  field("Printed Name: ____________________________________________________"),
  field("Current Credential(s) / Title (if any): ____________________________________________"),
  page(),

  h1("FORM A — CODE OF ETHICS AFFIRMATION"),
  h2("Peer Recovery Associate — Arizona Board for Certification of Addiction Counselors"),
  p("As a condition of certification and as a continuing obligation of the Peer Recovery Associate (PR-A) credential, I affirm the following:"),
  li("1. I will abide by the NAADAC Code of Ethics, including all twelve (12) ethical principles, as adopted by the Arizona Board for Certification of Addiction Counselors."),
  li("2. I will place the wellbeing, dignity, and recovery of every person I serve above all other considerations in my peer support practice."),
  li("3. I will not misrepresent my qualifications, credentials, role, or the scope of peer support services to any person, employer, or agency."),
  li("4. I will maintain appropriate boundaries and will not exploit the relationship, vulnerability, or trust of any person I serve."),
  li("5. I will hold all information shared with me in the peer support relationship in strict confidence, disclosing only as required by law or with the informed consent of the individual served."),
  li("6. I will practice within the scope of the Peer Recovery Associate credential and will refer individuals to licensed or clinical professionals when their needs exceed my role."),
  li("7. I will not allow personal recovery, bias, or self-interest to impair my professional judgment or my ability to serve others effectively."),
  li("8. I will continue to invest in my own recovery and in the professional development required to serve others with competence and integrity."),
  li("9. I will treat all individuals with respect, dignity, and cultural humility, honoring the diversity of recovery paths and lived experience."),
  li("10. I will report any violations of ethical standards by peers, colleagues, or supervisors to the appropriate authority as required."),
  li("11. I will cooperate fully with any investigation conducted by ABCAC related to my conduct or the conduct of others under this credential."),
  li("12. I understand that violation of this Code of Ethics may result in suspension or revocation of my Peer Recovery Associate certification."),
  gap(),
  p("By signing below, I affirm that I have read, understand, and agree to be bound by the ABCAC Code of Ethics and the NAADAC Ethical Standards as adopted by ABCAC. I commit to upholding these standards throughout the duration of my Peer Recovery Associate certification."),
  field("Applicant Signature: ____________________________________  Date: ____________"),
  field("Printed Name: ____________________________________________________"),
  field("Employer / Agency: ____________________________________________________"),
  field("AHCCCS-Recognized Training Program Completed: ____________________________________"),
  page(),

  h1("FORM B — LIVED EXPERIENCE ATTESTATION"),
  h2("Peer Recovery Associate — Arizona Board for Certification of Addiction Counselors"),
  p("The Peer Recovery Associate credential is grounded in the power of shared lived experience. Applicants must describe their personal experience with a mental health and/or substance use condition and explain how that experience informs their desire and ability to provide peer support services to others."),
  p("Your response will be reviewed by ABCAC only and will be held in strict confidence. You are not required to disclose specific diagnoses, substances, or treatment history — only to confirm lived experience and describe how it shapes your peer support practice."),
  field("Applicant Name (Printed): ____________________________________________________"),
  field("Date: ____________________________________________________"),
  gap(),
  h3("Part 1 — Lived Experience"),
  p("Describe your personal experience with a mental health and/or substance use condition and the challenges you have faced and overcome. You do not need to disclose specific diagnoses or substances."),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  h3("Part 2 — Connection to Peer Support Work"),
  p("Explain how your lived experience informs your ability to support others in their recovery journey. Describe the strategies, insights, and strengths you have developed that will make you an effective Peer Recovery Associate."),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  note("________________________________________________________________________"),
  gap(),
  p("I attest that the information provided above is truthful and accurately describes my lived experience. I understand that misrepresentation of lived experience is grounds for denial or revocation of the Peer Recovery Associate certification."),
  field("Applicant Signature: ____________________________________  Date: ____________"),
  field("Printed Name: ____________________________________________________"),
  page(),

  h1("FORM C — SUPERVISION AGREEMENT"),
  h2("Peer Recovery Associate — Arizona Board for Certification of Addiction Counselors"),
  p("All applicants for the Peer Recovery Associate credential must have a qualified supervisor identified and agree to the terms of supervision as described below. This agreement must be signed by both the applicant and the supervisor and submitted with the application."),
  h3("Section 1 — Applicant Information"),
  field("Applicant Name: ________________________________________  Date: ____________"),
  field("Employer / Agency: ____________________________________________________"),
  field("Job Title / Role: ____________________________________________________"),
  field("Phone: ________________________  Email: ________________________________"),
  h3("Section 2 — Supervisor Information"),
  field("Supervisor Name: ________________________________________  Credential(s): ____________"),
  field("Title / Position: ____________________________________________________"),
  field("Agency / Organization: ____________________________________________________"),
  field("Address: ____________________________________________________"),
  field("Phone: ________________________  Email: ________________________________"),
  h3("Section 3 — Supervision Plan"),
  field("Supervision Start Date: ________________________  Anticipated Hours of Supervision: ____________"),
  field("Method of Supervision (individual, group, combination): ____________________________________"),
  field("Frequency of Supervision Sessions: ____________________________________"),
  page(),

  h3("Section 4 — Agreement Terms"),
  p("By signing below, both parties agree to the following terms:"),
  li("1. The supervisor agrees to provide oversight, guidance, and support to the applicant in their peer support practice in accordance with the standards of the Peer Recovery Associate credential."),
  li("2. The supervisor agrees to be available for scheduled supervision sessions and to document supervision hours as required by ABCAC."),
  li("3. The applicant agrees to participate actively in supervision, to seek guidance when needed, and to practice within the scope of the PR-A credential."),
  li("4. Both parties understand that supervised practice hours submitted for PR-A certification shall not exceed 120 hours."),
  li("5. Either party may terminate this agreement with written notice. The applicant must notify ABCAC immediately if this supervision agreement is terminated."),
  li("6. Both parties attest that the information provided on this form is accurate and complete."),
  gap(),
  h3("Applicant"),
  field("Signature: ____________________________________  Date: ____________"),
  field("Printed Name: ____________________________________________________"),
  gap(),
  h3("Supervisor"),
  field("Signature: ____________________________________  Date: ____________"),
  field("Printed Name: ____________________________________________________"),
  field("Credential / License Number: ____________________________________________________"),
  page(),

  h1("FORM D — TRAINING DOCUMENTATION"),
  h2("Peer Recovery Associate — Arizona Board for Certification of Addiction Counselors"),
  p("Use this form to document the training hours completed through your AHCCCS-recognized Peer Support Employment Training Program. All 40 hours must be documented. Attach a certificate of completion or a signed letter from the training provider confirming total hours completed."),
  field("Applicant Name (Printed): ____________________________________________________"),
  field("Training Program / Organization: ____________________________________________________"),
  field("Training Program Instructor / Director: ____________________________________________________"),
  field("Training Start Date: ______________  Training End Date: ______________"),
  gap(),
  h3("Training Log"),
  p("List each training module or session completed. Attach additional pages if needed. Columns: Title of Course / Module — Date Completed — Hours — IC&RC Domain — Training Provider / Instructor."),
  note("IC&RC PR-A Domains: (1) Advocacy  (2) Education & Support  (3) Community Resources  (4) Professional Responsibility"),
  field("Total Hours Completed (must be 40 or more): ____________________________________"),
  field("Ethics Hours Included (must be 6 or more): ____________________________________"),
  gap(),
  h3("Training Provider Attestation"),
  p("I certify that the applicant named above has successfully completed the training hours documented on this form through our AHCCCS-recognized Peer Support Employment Training Program."),
  field("Provider Signature: ________________________________________  Date: ____________"),
  field("Printed Name & Title: ____________________________________________________"),
  field("Organization / Program: ____________________________________________________"),
  field("Phone: ____________________________________________________"),
  page(),

  h2("Recertification Requirements"),
  field("Renewal Cycle: The Peer Recovery Associate credential must be renewed every two (2) years."),
  field("Renewal Fee: $150.00 (non-refundable)"),
  field("Continuing Education: Certificants must complete a minimum of 20 continuing education (CE) hours during each two-year renewal period. A minimum of 6 of those hours must specifically address ethics."),
  field("Acceptable CE: Continuing education must be relevant to peer support practice, recovery, behavioral health, or professional development. ABCAC reserves the right to approve or reject CE activities."),
  field("Renewal Page: www.abcac.org/renewal"),
  gap(),
  h3("Recertification Checklist"),
  li("Completed Renewal Application"),
  li("CE Documentation — documentation of 20 CE hours (certificates, transcripts, or letters from providers)"),
  li("Ethics CE — documentation of 6 ethics CE hours included within the 20 hours"),
  li("Renewal Fee — renewal fee of $150.00 (check or money order payable to ABCAC)"),
  gap(),

  h2("Disciplinary Procedures"),
  p("ABCAC maintains the authority to investigate complaints, impose sanctions, and revoke or suspend certifications in accordance with its disciplinary procedures. The following summarizes the ABCAC disciplinary process:"),
  li("1. Complaints against a certificant may be submitted in writing to ABCAC by any person."),
  li("2. ABCAC will review the complaint to determine whether it falls within its jurisdiction and meets the threshold for investigation."),
  li("3. The certificant against whom a complaint has been filed will be notified in writing and given the opportunity to respond."),
  li("4. ABCAC may appoint an investigation committee to gather facts, interview parties, and review documentation."),
  li("5. Following investigation, ABCAC may dismiss the complaint, issue a letter of concern, require remediation, impose probation, suspend the certification, or revoke the certification."),
  li("6. The certificant has the right to appeal any adverse decision in accordance with ABCAC's appeal procedures."),
  li("7. All disciplinary proceedings shall be conducted in a fair, impartial, and timely manner."),
  li("8. ABCAC may report substantiated disciplinary actions to IC&RC and other relevant authorities as required."),
  gap(),
  note("abcacb@abcac.org  |  (480) 980-1770  |  PO Box 83165, Phoenix, AZ 85071  |  www.abcac.org"),
  note("www.abcac.org/initial-certification"),
];

// ── Renderer ─────────────────────────────────────────────────────────────

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function build() {
  const doc = await PDFDocument.create();
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let pageRef = doc.addPage(PageSizes.Letter);
  let y = PAGE_H - MARGIN;

  function newPage() {
    pageRef = doc.addPage(PageSizes.Letter);
    y = PAGE_H - MARGIN;
  }

  function ensure(spaceNeeded) {
    if (y - spaceNeeded < MARGIN) newPage();
  }

  function drawWrapped(text, { font, size, color, lineGap = 4, indent = 0 }) {
    const lines = wrapText(text, font, size, CONTENT_W - indent);
    for (const line of lines) {
      ensure(size + lineGap);
      pageRef.drawText(line, { x: MARGIN + indent, y, size, font, color });
      y -= size + lineGap;
    }
  }

  for (const block of blocks) {
    switch (block.type) {
      case "page":
        newPage();
        break;
      case "gap":
        y -= 10;
        break;
      case "hr":
        ensure(14);
        pageRef.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: NAVY });
        y -= 14;
        break;
      case "h1":
        ensure(26);
        y -= 4;
        drawWrapped(block.text, { font: serifBold, size: 18, color: NAVY, lineGap: 6 });
        y -= 4;
        break;
      case "h2":
        ensure(20);
        drawWrapped(block.text, { font: serifBold, size: 14, color: BRAND, lineGap: 5 });
        y -= 2;
        break;
      case "h3":
        ensure(18);
        y -= 2;
        drawWrapped(block.text, { font: serifBold, size: 12, color: INK, lineGap: 4 });
        break;
      case "p":
        drawWrapped(block.text, { font: serif, size: 10.5, color: INK, lineGap: 4 });
        y -= 4;
        break;
      case "li":
        drawWrapped(block.text, { font: serif, size: 10.5, color: INK, lineGap: 4, indent: 14 });
        y -= 2;
        break;
      case "field":
        drawWrapped(block.text, { font: serif, size: 10.5, color: INK, lineGap: 6 });
        break;
      case "note":
        drawWrapped(block.text, { font: serifItalic, size: 9.5, color: MUTED, lineGap: 4 });
        break;
      default:
        break;
    }
  }

  return doc.save();
}

const bytes = await build();
const outPath = new URL("../public/forms/library/initial-pra.pdf", import.meta.url);
writeFileSync(outPath, bytes);
console.log(`Wrote ${outPath.pathname} (${bytes.length} bytes)`);
