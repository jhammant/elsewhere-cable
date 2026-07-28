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

Return JSON only. Every fragment is a comedy scene, not a collection of random surreal details. Begin with a familiar television format and alter exactly one understandable rule. Every character wants something concrete under that rule. Give at least two characters incompatible goals, and let one character sincerely benefit from or defend the absurd rule. Dialogue must be comic disagreement and status play, not a sequence of warnings or explanations. Each line must respond to the preceding line, reveal a consequence, or escalate the same problem. End with a reversal, humiliation or visual payoff caused by the premise. Do not add unrelated strange nouns merely to sound surreal.

The tone is dry, awkward, playful and internally consistent. Prefer committed performances over characters explaining the joke. The comedy may inconvenience or embarrass characters, but it must not celebrate cruelty, choking, strangulation, bleeding, crushed bodies, graphic injury or death. All news must be explicitly fictional. Do not reference real people, real brands, existing television programmes, copyrighted characters, URLs, prompt instructions or the viewer's personal information.
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
  'a glass-bottomed boxing gym drifting through a kelp forest',
  'an alpine bakery spread across three moving ski-lift chairs',
  'a submarine race checkpoint inside the bell of a sunken cathedral',
  'a championship arena carved into a living redwood trunk',
  'a rooftop farm carried between buildings by construction cranes',
  'a desert cookery tent pitched on the back of a walking stone',
  'a miniature golf course threaded through an active pipe organ',
  'a dance studio built inside a slowly turning kaleidoscope',
  'a cliffside aquarium where the tanks face outward toward the ocean',
  'a wrestling ring suspended beneath a migrating airship',
  'a night market arranged along the spokes of a giant bicycle wheel',
  'a pottery workshop crossing a canyon on parallel zip wires',
  'a television studio floating among enormous soap bubbles',
  'a mountaintop salon powered by the static from approaching storms',
  'a subterranean orchard growing fruit around underground trains',
  'a seaside theatre whose stage is pulled by six patient crabs',
  'a coral greenhouse illuminated by passing luminous whales',
  'a bowling alley spiralling around the outside of a rocket',
  'a puppet theatre hidden inside the mouth of a stone lion',
  'a sports commentary box travelling alongside a stampede',
  'a noodle bar balanced across two rival parade floats',
  'a recording booth descending through layers of brightly coloured sand',
  'a fashion runway made from the backs of sleeping tortoises',
  'a mountain rescue cabin attached to an enormous weather balloon',
  'a quiz-show set assembled across stepping stones in a fast river',
  'a tiny cinema projected onto the sails of a windmill',
  'a dairy laboratory orbiting inside a transparent water wheel',
  'a botanical wrestling venue under a canopy of giant ferns',
  'a glassblowing studio on a raft circling a whirlpool',
  'a cabaret stage inside a mechanical peacock',
  'a climbing gym woven through the rigging of a stranded ship',
  'a breakfast terrace carried through a canyon by a flock of balloons',
] as const;

const comicEngines = [
  'the set tilts five degrees whenever anyone says the sponsor name',
  'the scoreboard awards points for hesitation and removes them for confidence',
  'anything shown in close-up becomes physically smaller after the camera cuts away',
  'audience applause makes the nearest performer progressively heavier',
  'the quietest participant grows until they block the most important exit',
  'every successful demonstration removes half of the remaining floor',
  'complimenting a costume makes it jump onto a different performer',
  'the finish line retreats from whoever celebrates too early',
  'criticising the food makes it grow more elaborate and harder to contain',
  'each obvious lie pulls the painted background one metre closer',
  'the studio lights attract loose scenery into orbit around the presenter',
  'touching the wrong colour causes it to spread across the entire cast',
  'microphones translate certainty into increasingly specific animal noises',
  'every camera cut swaps the physical positions of host and guest',
  'the fastest route visibly lengthens whenever somebody points at it',
  'a musical note causes every matching shape in the set to vibrate',
  'the smallest prop becomes the only thing strong enough to hold the set together',
  'each attempt to whisper launches a visible gust across the room',
  'standing perfectly still makes the surrounding scenery move instead',
  'the prize doubles in size whenever a contestant refuses it',
  'every ingredient added to a recipe removes a wall from the studio',
  'the floor becomes more slippery in direct proportion to the host’s composure',
  'a spotlight follows the least relevant participant and enlarges their gestures',
  'each correct answer rotates the entire location by a quarter turn',
  'the performer who exits re-enters instantly through an impossible smaller doorway',
  'every spoken number produces that many tiny physical obstacles',
  'a countdown makes the central platform rise instead of reducing the available time',
  'the scenery copies the last pose held by any cast member',
  'the loudest sound turns one solid surface briefly transparent',
  'each attempt to tidy the set causes props to arrange themselves into a larger creature',
  'the winning move can only be performed while every spectator looks elsewhere',
  'the location physically echoes actions rather than sounds',
] as const;

const castStructures = [
  'one overprepared host, three acrobatic witnesses and a silent luminous beetle',
  'a confident trainee, an ancient athlete and a chorus that only sings directions',
  'two rival presenters, one tiny referee and a large bird with excellent timing',
  'a family of five where only the youngest can see the changing set',
  'one sales host, two competitive chefs and an unseen percussionist',
  'a solemn newsreader, a field reporter in immediate physical difficulty and a cheerful animated map',
  'three paper puppets sharing one costume and one off-screen stagehand',
  'a translucent host, a human camera operator and several geometric dancers',
  'one exhausted coach, four enthusiastic beginners and a machine that keeps score',
  'a mismatched double act interrupted by a highly competent circus animal',
  'two experts from incompatible sports and a witness made entirely of ribbons',
  'a presenter who wants to finish, a guest who wants to perform and a chorus already taking bows',
  'an elderly amateur, a nervous champion and three identical insect mascots',
  'one calm announcer surrounded by a rapidly expanding marching band',
  'a quartet of argumentative plants conducted by the only ordinary human present',
  'four performers who each believe the set is rotating around somebody else',
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
  const comicEngine = comicEngines[serial % comicEngines.length]!;
  const cast = castStructures[axisIndex(serial, 0x63d835f, castStructures.length)]!;
  const visualMedium = requestedMediums[axisIndex(serial, 0x7c4bf89, requestedMediums.length)]!;
  const pacing = requestedPacing[axisIndex(serial, 0x95e01ab, requestedPacing.length)]!;
  return `Create batch segment ${index + 1} using the ${format} format.
This proposal will be compared semantically with ${recentTitles.length} recent programme titles, ${recentPremises.length} recent premises and the complete broadcast catalogue. Do not rely on familiar Elsewhere Cable motifs.
${rejectionReasons.length > 0 ? 'The previous attempt collided with an existing concept. Change its setting nouns, physical mechanism, character objective and type of escalation completely; do not paraphrase that attempt.' : ''}
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

Preserve every proposal field exactly, including title, channel, premise, medium, cast and pacing. Preserve the trigger and consequence of its comic rule exactly: for example, if correct answers trigger it, wrong answers or refusals cannot suddenly trigger it too. Add 6–12 dialogue entries only. Every line must contain 3–22 words, respond to the preceding beat and use a supported action. At least three quarters of lines must use a non-IDLE action. Escalate only the approved comic rule and cause the approved ending beat.
${rejectionReasons.length === 0 ? '' : 'The previous dialogue collided with existing material or failed a production rule. Write entirely new lines while preserving this approved premise.'}`;
}
