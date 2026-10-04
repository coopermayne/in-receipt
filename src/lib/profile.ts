// Hallie's profile page (hallieblack.com). Edited in the admin's Profile tab
// and fetched with the rest of the content at build time; the defaults below
// only show until the profile is first saved there. Keep them in step with
// DEFAULT_PROFILE in admin/db.js.
import { fetchContentProfile } from './content';

export interface CvEntry {
  years: string;
  title: string;
  detail: string;
}

export interface CvSection {
  heading: string;
  entries: CvEntry[];
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  // Paragraphs separated by blank lines
  bio: string;
  email: string;
  // As displayed, e.g. "(424) 256-6076"; the tel: link is derived from it
  phone: string;
  // Project whose starred image illustrates the studio link; blank = the
  // first big project
  featuredProjectId: string;
  cv: CvSection[];
}

// Fixed: the profile page always points at the studio site
export const STUDIO = {
  name: 'In Receipt',
  tagline: 'Architecture Studio',
  url: 'https://inreceiptstudio.com/',
  urlDisplay: 'inreceiptstudio.com',
};

export const DEFAULT_PROFILE: Profile = {
  name: 'Hallie Black',
  role: 'Architect',
  location: 'Los Angeles, California',
  bio: 'Hallie Black is an architect based in Los Angeles and the founder of In Receipt, an architecture studio working on residential and small-scale projects.',
  email: 'inreceipt@gmail.com',
  phone: '(424) 256-6076',
  featuredProjectId: '',
  cv: [
    { heading: 'Practice', entries: [
      { years: '20XX–present', title: 'Founder, In Receipt', detail: 'Los Angeles' },
      { years: '20XX–20XX', title: 'Position, Firm', detail: 'City' },
    ] },
    { heading: 'Education', entries: [{ years: '20XX', title: 'Degree, School', detail: 'City' }] },
    { heading: 'Licensure', entries: [{ years: '20XX', title: 'Licensed Architect', detail: 'State' }] },
    { heading: 'Teaching', entries: [{ years: '20XX', title: 'Course, School', detail: '' }] },
    { heading: 'Awards and Publications', entries: [{ years: '20XX', title: 'Award or publication', detail: 'Publisher' }] },
  ],
};

export async function fetchProfile(): Promise<Profile> {
  const saved = await fetchContentProfile();
  if (!saved) return DEFAULT_PROFILE;

  // The admin whitelists the shape; this just guards against missing keys
  // from an older admin version.
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    cv: (saved.cv || []).map(section => ({
      heading: section.heading || '',
      entries: (section.entries || []).map(entry => ({
        years: entry.years || '',
        title: entry.title || '',
        detail: entry.detail || '',
      })),
    })),
  };
}

export function bioParagraphs(bio: string): string[] {
  return bio.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

// "(424) 256-6076" -> "+14242566076". Ten digits are taken as US numbers;
// anything else keeps its digits and a leading + if it had one.
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`;
}
