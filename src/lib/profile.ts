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
  // Library image to use as the portrait; blank = the built-in photo in
  // public/images
  portraitImageId: string;
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
  role: 'Architectural Designer',
  location: 'Los Angeles, California',
  bio: 'Hallie Black is an architectural designer and educator based in Los Angeles. She is Director of Stray Dog Café at Morphosis, where she manages special research projects, design work, publications and artwork, and assists Thom Mayne in teaching at SCI-Arc and the University of Pennsylvania.\n\nShe is a guest lecturer at the University of Southern California and UCLA Architecture and Urban Design, and runs In Receipt, her architecture studio. She holds a Bachelor of Architecture from Cornell University.',
  email: 'inreceipt@gmail.com',
  phone: '(424) 256-6076',
  featuredProjectId: '',
  portraitImageId: '',
  cv: [
    { heading: 'Practice', entries: [
      { years: '2021–present', title: 'Director, Stray Dog Café, Morphosis', detail: 'Culver City, California' },
    ] },
    { heading: 'Teaching', entries: [
      { years: '2024–present', title: 'Guest Lecturer, UCLA Architecture and Urban Design', detail: '' },
      { years: '2021–present', title: 'Guest Lecturer, University of Southern California', detail: 'Arch 402b, vertical studio for fourth-year B.Arch students' },
      { years: '2021–present', title: 'Teaching assistance for Thom Mayne', detail: 'SCI-Arc and University of Pennsylvania' },
      { years: '2019–2020', title: 'Teaching Associate, Cornell University', detail: 'Ithaca, New York' },
    ] },
    { heading: 'Editorial', entries: [
      { years: '2019–2020', title: 'Managing Editor, Cornell University', detail: 'Ithaca, New York' },
    ] },
    { heading: 'Education', entries: [
      { years: '2014–2019', title: 'Bachelor of Architecture, Cornell University', detail: 'Ithaca, New York' },
    ] },
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
