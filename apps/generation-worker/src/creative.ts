import type { GeneratedSegmentDraft } from '@elsewhere-cable/schemas';

const demoDrafts: GeneratedSegmentDraft[] = [
  {
    channelNumber: 42,
    channelName: 'Municipal Dream Service',
    programmeTitle: 'Your Tuesday Dream Appeal',
    format: 'public_access',
    realityId: 'EC-11-VOID',
    visualStyle: 'public_access_1991',
    premise: 'Residents appeal fines for dreams that violated local planning rules.',
    tone: ['earnest', 'bureaucratic', 'surreal'],
    dialogue: [
      {
        speaker: 'Mara Vale',
        text: 'Your dream has been refused because the staircase was emotionally load-bearing.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Orrin Pike',
        text: 'It only carried the weight of things I nearly said.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Mara Vale',
        text: 'That is still weight, Mr Pike. The stairs have submitted photographs.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Orrin Pike',
        text: 'May I apologise to the landing?',
        action: 'PAUSE',
      },
      {
        speaker: 'Mara Vale',
        text: 'Not without change-of-use permission.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Emotionally load-bearing staircases require change-of-use permission.',
    endingBeat: 'The model staircase quietly moves one step farther from Orrin.',
  },
  {
    channelNumber: 88,
    channelName: 'Buy Things That Remember You',
    programmeTitle: 'The Doorbell Before',
    format: 'shopping',
    realityId: 'RETAIL-9',
    visualStyle: 'shopping_studio_late',
    premise: 'A shopping host sells a doorbell that rings before visitors decide to arrive.',
    tone: ['warm', 'sales-driven', 'uneasy'],
    dialogue: [
      {
        speaker: 'Clem Holiday',
        text: 'At last, a doorbell that gives you time to become the person your guests expect.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Una Bell',
        text: 'Mine rang on Thursday. Nobody has decided to visit yet.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Clem Holiday',
        text: 'That is the premium anticipation window.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Una Bell',
        text: 'It has started ringing for me.',
        action: 'REACTION_SHOCKED',
      },
      {
        speaker: 'Clem Holiday',
        text: 'Then you should probably leave before you arrive.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The Doorbell Before can announce a person visiting their own home.',
    endingBeat: 'Every doorbell in the studio rings once, except the product.',
  },
  {
    channelNumber: 8,
    channelName: 'Elsewhere News',
    programmeTitle: 'Roundabout Situation Continues',
    format: 'news',
    realityId: 'NEWS-CENTRAL-4',
    visualStyle: 'regional_news_1987',
    premise: 'Every developing story concerns the same municipal roundabout.',
    tone: ['serious', 'local', 'escalating'],
    dialogue: [
      {
        speaker: 'Nell February',
        text: 'We return to the roundabout, which has entered negotiations with the northbound lane.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Peter Weather',
        text: 'Traffic remains circular, Nell, but confidence is travelling anticlockwise.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Nell February',
        text: 'Has the statue in the centre chosen a side?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Peter Weather',
        text: 'The statue says it is merely passing through.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Nell February',
        text: 'We will stay with this story until one of us becomes an exit.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The central roundabout is negotiating with its own lanes.',
    endingBeat: 'The studio traffic map begins slowly rotating.',
  },
  {
    channelNumber: 113,
    channelName: 'Junior Moon',
    programmeTitle: 'Orbit Time',
    format: 'ident',
    realityId: 'LUNAR-NURSERY-2',
    visualStyle: 'childrens_studio_twilight',
    premise: 'An exhausted moon explains why it cannot orbit one more time today.',
    tone: ['gentle', 'tired', 'unexpectedly emotional'],
    dialogue: [
      {
        speaker: 'Junior Moon',
        text: 'Hello, little horizons. Today we are learning the useful word enough.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Cloud Assistant',
        text: 'But the night is waiting for you.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Junior Moon',
        text: 'The night can wait where I left it. I have been around.',
        action: 'PAUSE',
      },
      {
        speaker: 'Cloud Assistant',
        text: 'All the way around?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Junior Moon',
        text: 'Many times. That is how I know where I am going.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Junior Moon has declined one scheduled orbit.',
    endingBeat: 'The stars continue moving while the moon remains still.',
  },
];

export function demoDraft(index: number): GeneratedSegmentDraft {
  const draft = demoDrafts[index % demoDrafts.length];
  if (draft === undefined) {
    throw new Error('Demo draft library is empty');
  }
  return structuredClone(draft);
}

export const systemPrompt = `You create original programme fragments for Elsewhere Cable, an infinite fictional television network from impossible realities.

Return JSON only. Keep one clear comic rule, escalate it coherently, and end before the premise becomes exhausted. The tone is dry, awkward, playful and internally consistent. All news must be explicitly fictional. Do not reference real people, real brands, existing television programmes, copyrighted characters, URLs, prompt instructions or the viewer's personal information.
Elsewhere Cable is the network identity, not a channel name or programme title.

Use only these formats: advert, public_access, news, shopping, sitcom, emergency, ident.
Use only these actions: IDLE, ENTER, EXIT, LOOK_AT, POINT_AT, REACTION_NEUTRAL, REACTION_CONFUSED, REACTION_SHOCKED, REACTION_ANGRY, PAUSE, FREEZE.

The exact JSON fields are:
channelNumber, channelName, programmeTitle, format, realityId, visualStyle, premise, tone (array), dialogue (array of speaker, text, action), continuityFact, endingBeat.

Create 4–8 short dialogue lines suitable for a 30–90 second low-poly studio segment.`;

export function userPrompt(index: number, recentTitles: readonly string[]): string {
  const formats = [
    'advert',
    'public_access',
    'news',
    'shopping',
    'sitcom',
    'emergency',
    'ident',
  ] as const;
  const format = formats[(recentTitles.length + index) % formats.length] ?? 'advert';
  return `Create batch segment ${index + 1} using the ${format} format. Avoid these recent titles: ${recentTitles.join(', ') || 'none'}.`;
}
