// Content for Hallie's profile page (hallieblack.com). Edit here; the page
// re-renders on the next build. CV entries are placeholders until filled in.

export interface CvEntry {
  years: string;
  title: string;
  detail?: string;
}

export interface CvSection {
  heading: string;
  entries: CvEntry[];
}

export const profile = {
  name: 'Hallie Black',
  role: 'Architect',
  location: 'Los Angeles, California',
  bio: [
    'Hallie Black is an architect based in Los Angeles and the founder of In Receipt, an architecture studio working on residential and small-scale projects.',
  ],
  contact: {
    email: 'inreceipt@gmail.com',
    phone: '+14242566076',
    phoneDisplay: '(424) 256-6076',
  },
  studio: {
    name: 'In Receipt',
    tagline: 'Architecture Studio',
    url: 'https://inreceiptstudio.com/',
    urlDisplay: 'inreceiptstudio.com',
  },
  cv: [
    {
      heading: 'Practice',
      entries: [
        { years: '20XX–present', title: 'Founder, In Receipt', detail: 'Los Angeles' },
        { years: '20XX–20XX', title: 'Position, Firm', detail: 'City' },
      ],
    },
    {
      heading: 'Education',
      entries: [
        { years: '20XX', title: 'Degree, School', detail: 'City' },
      ],
    },
    {
      heading: 'Licensure',
      entries: [
        { years: '20XX', title: 'Licensed Architect', detail: 'State' },
      ],
    },
    {
      heading: 'Teaching',
      entries: [
        { years: '20XX', title: 'Course, School' },
      ],
    },
    {
      heading: 'Awards and Publications',
      entries: [
        { years: '20XX', title: 'Award or publication', detail: 'Publisher' },
      ],
    },
  ] as CvSection[],
};
