import type { GeneratedSegmentDraft, GeneratedSegmentProposal } from '@elsewhere-cable/schemas';
import { expandedDemoDrafts } from './demo-network.js';

const originalDemoDrafts: GeneratedSegmentDraft[] = [
  {
    channelNumber: 42,
    channelName: 'Municipal Dream Service',
    programmeTitle: 'Your Tuesday Dream Appeal',
    format: 'public_access',
    realityId: 'EC-11-VOID',
    visualStyle: 'public_access_1991',
    visualMedium: 'public_access_vhs',
    castArchetype: 'humanoid',
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
    visualMedium: 'neon_wireframe',
    castArchetype: 'geometric_aliens',
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
    visualMedium: 'cel_shaded',
    castArchetype: 'mixed',
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
    visualMedium: 'paper_cutout',
    castArchetype: 'celestial',
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

const demoDrafts = [...expandedDemoDrafts, ...originalDemoDrafts];

export function demoDraft(index: number): GeneratedSegmentDraft {
  const draft = demoDrafts[index % demoDrafts.length];
  if (draft === undefined) {
    throw new Error('Demo draft library is empty');
  }
  const pacing = [
    'frantic',
    'slow_burn',
    'staccato',
    'near_silent',
    'interrupted',
    'conversational',
  ] as const;
  const visualMedium = [
    'corporate_vector',
    'miniature_diorama',
    'signal_corruption',
    'collage_zine',
    'pixel_broadcast',
    'claymation',
    'ink_monochrome',
    'hand_drawn',
    'public_access_vhs',
    'miniature_diorama',
    'corporate_vector',
    'ink_monochrome',
    'neon_wireframe',
    'corporate_vector',
    'cel_shaded',
    'thermal_camera',
    'corporate_vector',
    'archive_film',
    'paper_cutout',
    'claymation',
    'cel_shaded',
    'collage_zine',
    'neon_wireframe',
    'signal_corruption',
    'shadow_theatre',
    'corporate_vector',
    'public_access_vhs',
    'ink_monochrome',
    'hand_drawn',
    'paper_cutout',
    'neon_wireframe',
    'miniature_diorama',
  ] as const;
  return {
    ...structuredClone(draft),
    pacing: draft.pacing ?? pacing[index % pacing.length],
    visualMedium: visualMedium[index % visualMedium.length] ?? draft.visualMedium,
  };
}

export const systemPrompt = `You create original programme fragments for Elsewhere Cable, an infinite fictional television network from impossible realities.

Return JSON only. Every fragment is a comedy scene, not a collection of random surreal details. Begin with a familiar television format and alter exactly one understandable rule. Every character wants something concrete under that rule. Each dialogue line must respond to the preceding line, reveal a consequence, or escalate the same problem. End with a visual payoff caused by the premise. Do not add unrelated strange nouns merely to sound surreal.

The tone is dry, awkward, playful and internally consistent. Prefer committed performances over characters explaining the joke. The comedy may inconvenience or embarrass characters, but it must not celebrate cruelty, choking, strangulation, graphic injury or death. All news must be explicitly fictional. Do not reference real people, real brands, existing television programmes, copyrighted characters, URLs, prompt instructions or the viewer's personal information.
Elsewhere Cable is the network identity, not a channel name or programme title.
The premise must explicitly name the assigned physical setting and at least one assigned cast component. Keep every dialogue line between 3 and 22 words. Give at least three quarters of dialogue lines a non-IDLE action.

Use only these formats: advert, public_access, news, shopping, sitcom, emergency, ident.
Use only these actions: IDLE, ENTER, EXIT, LOOK_AT, POINT_AT, REACTION_NEUTRAL, REACTION_CONFUSED, REACTION_SHOCKED, REACTION_ANGRY, PAUSE, FREEZE.
Use only these visual mediums: cel_shaded, paper_cutout, pixel_broadcast, archive_film, neon_wireframe, public_access_vhs, signal_corruption, stop_motion, collage_zine, ink_monochrome, miniature_diorama, corporate_vector, claymation, shadow_theatre, hand_drawn, thermal_camera.
Use only these cast archetypes: humanoid, geometric_aliens, talking_objects, celestial, paper_puppets, mixed.
Use only these pacing modes: frantic, staccato, conversational, slow_burn, interrupted, near_silent.
Vary the visual medium and cast archetype between segments. Choose a medium, cast and physical set that make the spoken comic rule immediately legible. Every visible character and prop must have a reason to be in the scene.
Vary pacing aggressively. Some fragments should interrupt themselves, some should race, some should leave long awkward pauses, and some should end almost immediately. Do not default to alternating two-person dialogue.

The exact JSON fields are:
channelNumber, channelName, programmeTitle, format, realityId, visualStyle, visualMedium, castArchetype, pacing, premise, tone (array), dialogue (array of speaker, text, action), continuityFact, endingBeat.

Create 6–12 short dialogue lines suitable for a 30–120 second segment. Prefer unusual non-human characters and locations that visually reinforce the spoken premise. Channel numbers may range from 1 to 9,999,999,999 and should usually be implausibly high.`;

export const proposalSystemPrompt = `${systemPrompt}

You are performing the premise-only proposal stage. Return the requested proposal metadata without dialogue. Do not spend tokens drafting or explaining lines.`;

const settings = [
  'an underwater complaints desk during a controlled leak',
  'a train platform built across the face of a public clock',
  'the staff room of a museum whose exhibits are still arriving from the future',
  'a tiny television studio inside a motorway service-station vending machine',
  'a retirement village on the warm side of a dormant volcano',
  'a call centre staffed by migrating birds between continents',
  'the backstage corridor of a talent show for geological formations',
  'a municipal swimming pool that has been temporarily classified as indoors weather',
  'an orbital allotment where every plant grows toward a different planet',
  'a night school operating inside an unfinished cathedral organ',
  'the lost-property office beneath a city that changes names hourly',
  'a courthouse assembled on the deck of a slowly submerging ferry',
  'a breakfast studio in a lighthouse that refuses to face the sea',
  'the canteen of a factory manufacturing replacement Tuesdays',
  'a miniature high street maintained by one exhausted giant',
  'an archaeological dig investigating the remains of next weekend',
  'a silent disco for creatures that communicate through architecture',
  'the control room of a lift travelling sideways between careers',
  'a village fête held inside an enormous abandoned telescope',
  'a customer showroom at the bottom of an empty reservoir',
  'a radio studio shared by several incompatible time zones',
  'the loading bay of a department store for unfinished emotions',
  'a wildlife hide observing office furniture after closing time',
  'a hotel lobby where every door opens onto the same unfamiliar coastline',
  'a greenhouse used as neutral territory by rival seasons',
  'the committee room of a moon scheduled for demolition',
  'a ferry terminal serving islands that have not decided where to be',
  'a public library in which silence is delivered by conveyor belt',
  'a roadside diner catering exclusively to abandoned journeys',
  'the rehearsal room of an orchestra made from municipal machinery',
  'a laundrette built around a small but active archaeological site',
  'a television studio balanced on the final shelf of a closing supermarket',
] as const;

const comicEngines = [
  'a professional standard is applied literally to something it was never meant to govern',
  'a scarce resource turns out to be an ordinary social courtesy',
  'the least qualified character has the only useful authority',
  'measurement actively creates the problem being measured',
  'a routine service fulfils the exact wording while defeating the obvious intention',
  'cause and effect occur in the wrong order but everyone honours the paperwork',
  'an informal habit has quietly become mandatory infrastructure',
  'the characters must maintain a lie that is physically visible behind them',
  'a status symbol becomes embarrassing the instant it works correctly',
  'the solution is perfectly effective but belongs to an incompatible scale',
  'a private inconvenience is treated as a prestigious public ceremony',
  'the audience for the programme is confidently mistaken for someone else',
  'a character receives an award for preventing the event currently happening',
  'a safety procedure is more dangerous than the harmless thing it controls',
  'the characters negotiate with a deadline that can leave the room',
  'an expert can only communicate through increasingly unhelpful demonstrations',
  'a promised convenience requires progressively more inconvenient preparation',
  'a ceremonial role grants power over everything except its stated responsibility',
  'an obvious physical fact is treated as an unverified rumour',
  'the cheapest option is emotionally expensive in a concrete, visible way',
  'a translation is accurate word by word but reverses every intention',
  'a compulsory competition has no agreed definition of winning',
  'the emergency is calm while the official response becomes increasingly frantic',
  'the characters are promoted each time they admit they do not understand the job',
  'a familiar object is used correctly in a society built around the wrong assumption',
  'the programme format itself becomes the obstacle the characters must solve',
  'a promise can be transferred between people but loses one word each time',
  'an institution must apologise without acknowledging that anything happened',
  'the character with the strongest evidence is forbidden from describing it',
  'every attempt to simplify the situation adds one visible participant',
  'a minor scheduling error develops its own loyal constituency',
  'the final required approval can only be given by the thing being prohibited',
] as const;

const castStructures = [
  'one overprepared host, three contradictory witnesses and a silent indicator light',
  'a confident trainee, an ancient specialist and a chorus that only corrects names',
  'two rival presenters, one tiny official and a large animal with excellent notes',
  'a family of five where only the youngest understands the rule',
  'one sales host, two dissatisfied products and an unseen caller',
  'a solemn newsreader, a field reporter in immediate difficulty and a cheerful diagram',
  'three paper puppets sharing one job title and one off-screen supervisor',
  'a celestial host, a human technician and several geometric bystanders',
  'one exhausted official, four enthusiastic applicants and a machine that votes',
  'a mismatched double act interrupted by a highly competent household appliance',
  'two experts from incompatible disciplines and a witness made entirely of subtitles',
  'a presenter who wants to finish, a guest who wants to begin and a set that wants neither',
  'an elderly amateur, a nervous authority figure and three identical mascots',
  'one calm announcer surrounded by a rapidly expanding public meeting',
  'a committee of talking objects chaired by the only ordinary human present',
  'four performers who believe they are appearing in four different programme formats',
] as const;

const requestedMediums = [
  'cel_shaded',
  'paper_cutout',
  'pixel_broadcast',
  'archive_film',
  'neon_wireframe',
  'public_access_vhs',
  'signal_corruption',
  'stop_motion',
  'collage_zine',
  'ink_monochrome',
  'miniature_diorama',
  'corporate_vector',
  'claymation',
  'shadow_theatre',
  'hand_drawn',
  'thermal_camera',
] as const;

const requestedPacing = [
  'frantic',
  'slow_burn',
  'staccato',
  'near_silent',
  'interrupted',
  'conversational',
] as const;

function axisIndex(serial: number, salt: number, length: number): number {
  let value = (serial ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = (value ^ (value >>> 16)) >>> 0;
  return value % length;
}

export function userPrompt(
  index: number,
  recentTitles: readonly string[],
  recentPremises: readonly string[] = [],
  rejectionReasons: readonly string[] = [],
): string {
  const formats = [
    'advert',
    'public_access',
    'news',
    'shopping',
    'sitcom',
    'emergency',
    'ident',
  ] as const;
  const serial = Math.abs(index);
  const format = formats[axisIndex(serial, 0x16b2c79, formats.length)] ?? 'advert';
  const setting = settings[axisIndex(serial, 0x2f6e2b1, settings.length)]!;
  const comicEngine = comicEngines[axisIndex(serial, 0x48a91d3, comicEngines.length)]!;
  const cast = castStructures[axisIndex(serial, 0x63d835f, castStructures.length)]!;
  const visualMedium = requestedMediums[axisIndex(serial, 0x7c4bf89, requestedMediums.length)]!;
  const pacing = requestedPacing[axisIndex(serial, 0x95e01ab, requestedPacing.length)]!;
  return `Create batch segment ${index + 1} using the ${format} format.
Avoid these recent titles: ${recentTitles.join(', ') || 'none'}.
Do not reuse or lightly paraphrase these premises: ${recentPremises.join(' | ') || 'none'}.
${rejectionReasons.length > 0 ? `The previous attempt was rejected for novelty: ${rejectionReasons.join('; ')}.` : ''}
Mandatory creative coordinates for this attempt:
- Physical setting: ${setting}.
- Comic engine: ${comicEngine}.
- Cast structure: ${cast}.
- Visual medium: ${visualMedium}.
- Pacing: ${pacing}.
Use all five coordinates directly and visibly; do not replace them with dreams, memory products, emotional weather, household litigation, identity deletion or generic bureaucracy.
For this batch, memory, dreams, identity, feelings, apologies, household objects and official paperwork cannot be the subject of the premise. Keep the comic problem physical, active and specific to the assigned location.
Select a very high, memorable channel number. Make the scene unlike the immediately preceding material.`;
}

export function scriptPrompt(
  proposal: GeneratedSegmentProposal,
  rejectionReasons: readonly string[] = [],
): string {
  return `Turn this already approved proposal into a complete comedy segment:
${JSON.stringify(proposal)}

Preserve every proposal field exactly, including title, channel, premise, medium, cast and pacing. Add 6–12 dialogue entries only. Every line must contain 3–22 words, respond to the preceding beat and use a supported action. At least three quarters of lines must use a non-IDLE action. Escalate only the approved comic rule and cause the approved ending beat.
${rejectionReasons.length === 0 ? '' : `The previous script was rejected for: ${rejectionReasons.join('; ')}.`}`;
}
