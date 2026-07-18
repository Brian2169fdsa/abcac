export interface Post {
  slug: string;
  title: string;
  date: string;        // ISO
  excerpt: string;
  body: string[];      // paragraphs
}

// Real ABCAC announcements (sourced from current board communications).
export const POSTS: Post[] = [
  {
    slug: "digital-certificates",
    title: "ABCAC is going digital: certificates now issued electronically",
    date: "2026-01-15",
    excerpt:
      "ABCAC is transitioning to a digital certificate system. Paper copies will no longer be automatically mailed.",
    body: [
      "ABCAC is transitioning to a digital certificate system. Beginning immediately, paper copies of certificates will no longer be automatically mailed.",
      "All certification recipients will receive an official digital certificate upon approval or renewal, available to download from the member portal.",
      "If you would like to receive a printed copy of your certificate, one can be requested for a $25 processing and mailing fee.",
      "This change allows ABCAC to deliver certificates faster, reduce administrative processing time, and support environmentally responsible practices. Questions? Contact our office at abcac@abcac.org.",
    ],
  },
  {
    slug: "certification-sync",
    title: "Certification Sync: one renewal date for all your credentials",
    date: "2026-02-01",
    excerpt:
      "Hold multiple ABCAC credentials? Align them into a single, unified renewal cycle for $15/month forward.",
    body: [
      "If you hold multiple ABCAC certifications — such as CADAC, CCJP, or AADC — you can now align their renewal dates into one easy, unified cycle.",
      "Certification Sync costs a one-time $15 for each month moved forward. It eliminates staggered renewal dates so you can manage all your certifications together, save time, and stay compliant.",
      "Start your sync from the member portal: count the months needed to align your certifications, complete payment securely online, and upload your sync form to finalize your request.",
    ],
  },
  {
    slug: "icrc-exam-prep",
    title: "Preparing for your IC&RC certification exam",
    date: "2026-03-10",
    excerpt:
      "Computer-based testing, 150 questions, a 3-hour limit — here's what to expect and how to prepare.",
    body: [
      "The IC&RC exam is delivered via Computer-Based Testing (CBT) at IQT centers. It consists of 150 multiple-choice questions (125 scored plus 25 pretest) with a 3-hour time limit. If a retake is needed, it may be taken after a minimum of 90 days (which may be longer per member board).",
      "IC&RC provides official candidate guides with content outlines and sample questions, recommended study materials, and online practice exams for ADC, AADC, Clinical Supervisor, Prevention Specialist, Peer Recovery, and more.",
      "ABCAC does not sell or distribute these materials — all resources are hosted by IC&RC and subject to their pricing and terms. Ready to register? Visit the Testing page to choose in-person or remote-proctored testing.",
    ],
  },
];

export function getPosts() {
  return [...POSTS].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
export function getPost(slug: string) {
  return POSTS.find((p) => p.slug === slug);
}
