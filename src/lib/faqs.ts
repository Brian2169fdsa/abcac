export interface Faq {
  q: string;
  a: string;
}

// Official ABCAC FAQs (sourced from abcac.org).
export const FAQS: Faq[] = [
  {
    q: "What does ABCAC do?",
    a: "The Arizona Board for the Certification of Addiction Counselors (ABCAC) offers professional certification for individuals working in addiction counseling, prevention, peer recovery, clinical supervision, and related fields. As an IC&RC member board, ABCAC ensures its credentials meet international standards for competency and ethical practice.",
  },
  {
    q: "Do I need to be certified to work in addiction counseling?",
    a: "Certification is not legally required for all roles, but it is often preferred or required by employers and treatment programs. Holding certification through ABCAC demonstrates verified experience, education, and ethical commitment, increasing credibility and job opportunities in the field.",
  },
  {
    q: "What's the difference between licensure and certification?",
    a: "ABCAC certification is a voluntary professional credential focused on substance use counseling and recognized internationally through IC&RC, while AZBBHE licensure is a state-issued legal requirement for independent practice in behavioral health, allowing professionals to diagnose, treat, and bill for services in Arizona.",
  },
  {
    q: "Is ABCAC certification recognized in other states?",
    a: "ABCAC is an IC&RC member board. Eligible, current credentials may transfer through formal reciprocity when both ABCAC and the destination member board offer the credential at a reciprocal level. The receiving board may have additional requirements or fees.",
  },
  {
    q: "How do I start the certification process?",
    a: "Start by choosing your credential type (e.g., CAC, AADC, CPRS) and reviewing the requirements. Then submit your application and supporting documents through our secure portal. ABCAC will review your materials and guide you through the next steps toward certification. We're here to help every step of the way.",
  },
  {
    q: "Can I talk to someone if I need help?",
    a: "Absolutely. You can contact ABCAC by email at abcac@abcac.org or by phone at 480-980-1770. Staff are available to answer questions and guide you through the certification process.",
  },
];

// Additional practical FAQs (process specifics) shown on the FAQ page.
export const EXTRA_FAQS: Faq[] = [
  { q: "How often do ABCAC credentials renew?", a: "All ABCAC credentials renew every two years. Renewal requires completing your continuing education hours and paying the $150 renewal fee." },
  { q: "What does the IC&RC exam look like?", a: "It's Computer-Based Testing at IQT centers: 150 multiple-choice questions (125 scored + 25 pretest) with a 3-hour limit. If needed, you may retake after a minimum of 90 days (may be longer per member board)." },
  { q: "Can I take the exam remotely?", a: "Yes. You can choose a remote-proctored exam via Prometric's ProProctor platform, or test in person at an authorized Arizona center. See the Testing page to register." },
  { q: "How do I move my credential to or from Arizona?", a: "First contact the destination IC&RC member board to confirm its requirements. Then request the official reciprocity application from the board where you are currently credentialed. The IC&RC fee is $150 per credential, and the destination board may charge additional fees." },
  { q: "How long does CEU workshop endorsement take?", a: "Standard review turnaround is 4 weeks. Submit your workshop materials to abcac@abcac.org and pay the fee tier matching your total contact hours." },
  { q: "Will I receive a paper certificate?", a: "ABCAC issues official digital certificates upon approval or renewal. A printed copy can be requested for a $25 processing and mailing fee." },
];

// Member testimonials (sourced from abcac.org).
export interface Testimonial {
  quote: string;
  author: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Syncing my certifications with ABCAC was super easy. I just selected the number of months I needed, submitted my form, and it was all handled quickly. Now I only have one renewal date to remember — total game changer!",
    author: "T. Raymond, AADC & CPRS",
  },
  {
    quote:
      "Scheduling my exam with ABCAC was incredibly easy. I picked a time that worked for me, got clear instructions, and felt fully supported throughout the process.",
    author: "J. Morgan, CAC Candidate",
  },
  {
    quote:
      "Scheduling my exam was so easy, and Sierra was incredibly patient and helpful. She answered all my questions and made the whole process stress-free. I really felt supported.",
    author: "A. Thompson, CPRS Applicant",
  },
];
