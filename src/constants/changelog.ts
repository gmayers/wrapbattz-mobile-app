export const CHANGELOG_VERSION = '1.4.1';

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.1',
    date: '2026-07-03',
    highlights: [
      'Search your tools by name, serial, make, or model — plus a new "Find Tool" quick action.',
      'Invite teammates right from the Members screen, and resend or revoke pending invitations.',
      'Tools now show their next service due date and condition.',
      'Add your own tool categories with the new "+ Add new" option.',
      'Clearer wording: "devices" are now "tools" throughout.',
    ],
  },
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
