export const CHANGELOG_VERSION = '1.4.0';

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-06-05',
    highlights: [
      'See who has each tool and where, at a glance — including the last person who held tools now kept at a location.',
      'Dark mode is now readable across device, location, and add-location screens.',
      'Profile and organization details now save and pre-fill correctly.',
      'Fixed assigning, transferring, and returning tools — clearer errors and no more dead-ends.',
      'Create locations with lowercase postcodes; clearer location screens.',
      'Export reports to CSV and share them.',
      '"Print tags" is now "Browse Devices"; added a "Who has it?" scan and a "Request Device" action.',
    ],
  },
];
