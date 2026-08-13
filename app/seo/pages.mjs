export const SEO_PAGES = [
  {
    key: 'how-to-use',
    path: '/how-to-use/',
    title: 'How to Use Strikeglass | Neverwinter Combat Log Analyzer',
    description: 'Learn how to create a Neverwinter combat log, open it in Strikeglass, choose a fight, compare players, and inspect power damage.',
    eyebrow: 'Guide',
    heading: 'How to use Strikeglass',
    intro: 'Strikeglass turns a Neverwinter combat log into readable fight, player, and power results without uploading the log.',
    sections: [
      {
        heading: '1. Turn on combat logging in Neverwinter',
        paragraphs: [
          'On PC, open chat and enter /combatlog 1. The game starts writing combat events to a log file.',
          'Play the fight or dungeon you want to review. When you are finished, you can turn logging off with /combatlog 0.'
        ],
        code: '/combatlog 1'
      },
      {
        heading: '2. Find the combat log',
        paragraphs: [
          'A common Neverwinter installation stores combat logs under Neverwinter/Live/logs/GameClient/. The exact install folder can vary.',
          'Strikeglass accepts .log, .txt, and .csv files. You can drag the file onto the app or choose it with Open log.'
        ]
      },
      {
        heading: '3. Wait for both calculations',
        paragraphs: [
          'Strikeglass reads the file in a background worker, calculates the results, and then checks the important values with a separate verifier before showing them.',
          'If the two calculations disagree, Strikeglass blocks the affected result instead of publishing a number it cannot confirm.'
        ]
      },
      {
        heading: '4. Choose the fight and player you care about',
        paragraphs: [
          'Use the Fight selector to switch between the full session, individual fights, and detected boss fights. Use the Player selector when a page is focused on one player.',
          'Compare Players keeps everyone on the same selected fight so the damage and DPS values are measured against the same scope.'
        ]
      },
      {
        heading: '5. Inspect powers and raw hits',
        paragraphs: [
          'Open Powers to see where a player’s damage came from. Click a damaging power to open its hit details without leaving the current page.',
          'The popup shows total damage, hit count, average and biggest hit, critical rate, Combat Advantage rate, targets, base damage, and individual hit flags.'
        ]
      }
    ],
    related: [
      { href: '/dps-explained/', label: 'Understand DPS and Active DPS' },
      { href: '/privacy/', label: 'How local processing works' }
    ]
  },
  {
    key: 'dps-explained',
    path: '/dps-explained/',
    title: 'Neverwinter DPS and Active DPS Explained | Strikeglass',
    description: 'Understand how Strikeglass calculates Neverwinter damage, DPS, Active DPS, group share, critical hit rate, and Combat Advantage rate.',
    eyebrow: 'Combat metrics',
    heading: 'DPS and Active DPS, in simple words',
    intro: 'Two players can deal the same damage and still have different DPS. The difference is the clock used underneath the damage total.',
    sections: [
      {
        heading: 'Damage',
        paragraphs: [
          'Damage is the total counted Physical damage in the selected session or fight. It is the numerator used by the DPS calculations.'
        ]
      },
      {
        heading: 'DPS',
        paragraphs: [
          'DPS means damage per second. Strikeglass divides a player’s counted damage by the elapsed time from that player’s first counted hit to their last counted hit in the selected scope.',
          'Long pauses between those hits remain part of this elapsed clock.'
        ],
        formula: 'DPS = counted damage ÷ elapsed player time'
      },
      {
        heading: 'Active DPS',
        paragraphs: [
          'Active DPS uses the same damage total but removes qualifying idle gaps from the combat clock. Strikeglass currently treats gaps longer than five seconds as inactive time when building this clock.',
          'That is why Active DPS can be higher than DPS. If there are no qualifying idle gaps, the two values can legitimately be the same.'
        ],
        formula: 'Active DPS = counted damage ÷ active combat time'
      },
      {
        heading: 'Group share',
        paragraphs: [
          'Group share is the percentage of the selected group damage contributed by one player. It answers “how much of this group’s damage came from this player?” without changing the underlying damage total.'
        ]
      },
      {
        heading: 'Critical hit rate and Combat Advantage rate',
        paragraphs: [
          'Critical hit rate is the percentage of counted hits marked critical. Combat Advantage rate is the percentage of counted hits marked with Combat Advantage in the log.',
          'These rates describe the hits recorded in the selected scope; they do not infer game state that is missing from the log.'
        ]
      }
    ],
    related: [
      { href: '/how-to-use/', label: 'How to use Strikeglass' },
      { href: '/about/', label: 'Why Strikeglass checks results twice' }
    ]
  },
  {
    key: 'privacy',
    path: '/privacy/',
    title: 'Strikeglass Privacy | Local Neverwinter Combat Log Analysis',
    description: 'Learn what Strikeglass does with your Neverwinter combat log, what stays on your device, and which external libraries the web app may load.',
    eyebrow: 'Privacy',
    heading: 'Your combat log stays on your device',
    intro: 'Strikeglass is designed so the combat log itself is parsed and analyzed in your browser rather than uploaded to an analysis server.',
    sections: [
      {
        heading: 'Combat-log processing',
        paragraphs: [
          'When you choose a log, the file is read by browser workers on your device. Parsed rows and calculated combat results stay in the browser session unless you explicitly use a feature that exports data.',
          'Strikeglass does not require an account to analyze a combat log.'
        ]
      },
      {
        heading: 'What the app stores locally',
        paragraphs: [
          'Dashboard layout preferences can be saved in browser storage so your chosen widgets and ordering can persist on that device.',
          'The app does not store the full combat log or verified combat reports in dashboard preferences.'
        ]
      },
      {
        heading: 'External application libraries',
        paragraphs: [
          'Some optional interface libraries are loaded from jsDelivr when their feature is needed, including uPlot for charts, GSAP for small interface motion, and Three.js for the empty-state ambient effect.',
          'The combat-log file is not sent to those libraries. Network requests for library files are separate from local log processing.'
        ]
      },
      {
        heading: 'Third-party game relationship',
        paragraphs: [
          'Strikeglass is an independent community tool. It is not affiliated with or endorsed by Arc Games or Cryptic Studios.',
          'Neverwinter and related names belong to their respective owners.'
        ]
      }
    ],
    related: [
      { href: '/about/', label: 'About Strikeglass' },
      { href: '/how-to-use/', label: 'How to use the analyzer' }
    ]
  },
  {
    key: 'about',
    path: '/about/',
    title: 'About Strikeglass | Neverwinter Combat Log Analysis',
    description: 'Strikeglass is a fast, local-first Neverwinter combat log analyzer built around clear data, player comparison, boss analysis, and double-checked results.',
    eyebrow: 'About',
    heading: 'See the fight clearly',
    intro: 'Strikeglass is a Neverwinter combat log analyzer built around one idea: combat data is useful only when players can understand and trust what the numbers mean.',
    sections: [
      {
        heading: 'What Strikeglass is for',
        paragraphs: [
          'Strikeglass helps players compare damage, review DPS and Active DPS, isolate specific boss fights, inspect power damage, and trace individual hits back to the source log.',
          'The interface uses simple language so the converted combat log has meaning without requiring users to learn the parser’s internal terminology.'
        ]
      },
      {
        heading: 'Why results are double checked',
        paragraphs: [
          'The primary engine calculates the combat report. A separate verifier independently checks the important published values before the interface shows them.',
          'This does not make the source log perfect, but it catches disagreements between the two calculation paths instead of silently publishing them.'
        ]
      },
      {
        heading: 'Why the app stays lightweight',
        paragraphs: [
          'Large logs are parsed in workers, charts are loaded only when needed, raw events are paged, and heavy visual effects are kept out of the analytics path.',
          'The priority order is accuracy first, responsiveness second, and visual polish after both are protected.'
        ]
      },
      {
        heading: 'Independent community project',
        paragraphs: [
          'Strikeglass is an independent community tool and is not affiliated with or endorsed by Arc Games or Cryptic Studios.'
        ]
      }
    ],
    related: [
      { href: '/how-to-use/', label: 'Start with a combat log' },
      { href: '/dps-explained/', label: 'Learn the combat metrics' }
    ]
  }
];
