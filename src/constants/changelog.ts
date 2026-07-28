export const CHANGELOG_VERSION = '1.4.5';

export interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.4.5',
    date: '2026-07-28',
    highlights: [
      'Much faster all round — the app now remembers what it loaded, so your tools, locations, and reports appear instantly and quietly update in the background.',
      'Coming back to a tab no longer wipes the screen while it reloads.',
      'Scanning a tag brings up the tool card noticeably faster.',
      'Setup moves straight to the next step instead of pausing between steps.',
      'Works better with a weak or missing connection — you stay signed in and see your saved information, and anything that can’t connect says so quickly instead of leaving you waiting.',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-07-15',
    highlights: [
      'Try the app with demo data — setup now offers a demo site and sample tools, just like the web portal.',
      'Fixed "No device status configured" when adding a tool in organizations created from the app.',
      'Adding a tool without picking a category now works — it lands in "Other".',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-07-14',
    highlights: [
      'Fixed "Authentication failed" when adding your first location during setup.',
      'Setup steps now have a Back button, and your organization details can be edited if you return to that step.',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-07-03',
    highlights: [
      'Sign in or create your account with Google — one tap on the login and registration screens.',
    ],
  },
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
