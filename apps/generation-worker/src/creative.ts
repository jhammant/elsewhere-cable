import type {
  GeneratedSegmentDraft,
  GeneratedSegmentProposal,
  OptimisationBrief,
} from '@elsewhere-cable/schemas';
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
  'a laundrette during its final ten minutes before closing',
  'a suburban conservatory prepared for an awkward family lunch',
  'a library returns desk with a queue of impatient regulars',
  'a railway lost-property office immediately before an audit',
  'a tiny overnight radio booth shared by incompatible presenters',
  'a village hall midway through a badly attended demonstration',
  'a dentist waiting room where every appointment is running early',
  'a furniture showroom after the staff believe everyone has left',
  'a museum coat check during the opening of an unpopular exhibition',
  'a crowded family kitchen five minutes before an important guest arrives',
  'a rehearsal room where the understudy knows everyone else’s part',
  'a lift lobby between two floors that disagree about the building',
  'a community garden shed during a fiercely polite committee meeting',
  'a call centre on the last shift before a mysterious service closes',
  'a ferry cafeteria during a crossing nobody will admit is delayed',
  'a municipal swimming-pool office beside an unexpectedly formal lesson',
  'a second-hand bookshop hosting its first live product launch',
  'a roadside café where one table is permanently reserved for an unknown customer',
  'a small-town photography studio during a disastrous portrait sitting',
  'a neighbourhood repair shop that guarantees every object except one',
  'a rehearsal dinner held in the wrong function room',
  'a pet-grooming salon during a televised professional assessment',
  'a glass-bottomed boxing gym drifting through a kelp forest',
  'a miniature golf course threaded through an active pipe organ',
  'a subterranean orchard growing fruit around underground trains',
  'a puppet theatre hidden inside the mouth of a stone lion',
  'a tiny cinema projected onto the sails of a windmill',
  'a coral greenhouse illuminated by passing luminous whales',
  'a recording booth descending through layers of brightly coloured sand',
  'a cabaret stage inside a mechanical peacock',
  'a noodle bar balanced across two rival parade floats',
  'a dairy laboratory orbiting inside a transparent water wheel',
] as const;

const storyEngines = [
  'a domestic misunderstanding in which saving face matters more than solving the problem',
  'a workplace status game where the least important task decides who is in charge',
  'a service encounter where customer and worker sincerely want incompatible kinds of help',
  'a local call-in confession that changes the host’s relationship to the caller',
  'a moral dispute where each new fact makes the apparently wrong person more persuasive',
  'a mock-documentary discovery that the crew understands before the subject does',
  'an instructional demonstration whose correct procedure creates a social disaster',
  'a relationship dilemma hidden inside a mundane shared responsibility',
  'a children’s lesson where the pupil’s literal interpretation is more useful than the lesson',
  'a consumer demonstration where the product works perfectly for the wrong customer',
  'a neighbourhood ritual whose newest participant notices its obvious contradiction',
  'a detective procedure where solving the practical clue ruins the investigator’s status',
  'an artistic collaboration where success would expose one contributor’s bluff',
  'a quiet existential situation played as a concrete disagreement over seating',
  'a civic hearing where the public already lives with the rule the officials are debating',
  'a travelogue encounter where visitor and guide compete to appear less impressed',
] as const;

const storyScales = ['intimate', 'neighbourhood', 'institutional', 'cosmic'] as const;

const comicTriggers = [
  'someone completes a sentence with a concrete noun',
  'a presenter makes direct eye contact with the main camera',
  'a prop crosses a painted boundary',
  'two performers sincerely agree',
  'the music stops without warning',
  'the host demonstrates an object correctly',
  'a guest uses both hands at once',
  'applause begins',
  'the camera cuts during a physical action',
  'someone enters from the left',
  'a named colour is touched',
  'a bell rings',
  'the scoreboard changes',
  'the cast forms a straight line',
  'an object is placed at the exact centre of the set',
  'the studio lights dim',
  'a question receives an honest answer',
  'the presenter walks backwards',
  'someone points above the horizon',
  'the smallest character speaks',
  'the audience laughs',
  'a performer removes part of their costume',
  'a countdown reaches an odd number',
  'a door closes completely',
  'the announcer names the physical location',
  'two unrelated props touch',
  'someone whispers',
  'the cast moves in unison',
  'a character tries to explain the rule',
  'someone attempts to leave the set',
  'the prize is revealed',
  'the scene becomes completely silent',
] as const;

const physicalConsequences = [
  'the nearest exit relocates to the highest visible surface',
  'one section of floor folds upward into a narrow staircase',
  'the smallest prop splits into three differently scaled copies',
  'every costume exchanges one component clockwise',
  'the set gains a new level directly beneath the nearest sceptic',
  'all loose objects slide into an immaculate but obstructive queue',
  'the background advances until it becomes usable furniture',
  'the largest object becomes light enough to drift away',
  'a practical doorway shrinks while an impractical doorway grows',
  'the nearest horizontal surface slowly becomes vertical',
  'one character and one prop exchange their apparent sizes',
  'the floor marks redraw themselves around the least prepared performer',
  'a transparent duplicate of the action continues after everyone stops',
  'the ceiling lowers only above the person currently in charge',
  'a new obstacle arrives disguised as part of the studio branding',
  'every wheel on set turns ninety degrees sideways',
  'the scenery develops an extra joint and bends around the cast',
  'the central platform drifts toward whoever denies anything changed',
  'all handles move to the opposite side of their objects',
  'the most useful prop becomes attached to the least useful one',
  'a soft object becomes rigid while a rigid object becomes soft',
  'the set divides into two unequal halves with the cast on the smaller one',
  'every arrow rotates to indicate a different but equally plausible route',
  'the nearest container becomes shallower and dramatically wider',
  'one wall turns into a slowly moving walkway',
  'the cast’s shadows detach and perform the next movement first',
  'all furniture rises by one seat-height except the occupied chair',
  'the brightest object becomes physically heavier',
  'a painted object becomes solid while its real counterpart flattens',
  'the safest route acquires an additional unnecessary corner',
  'the room gains a duplicate centre and every prop chooses the wrong one',
  'the location rotates around one character who remains perfectly upright',
] as const;

const comicConflicts = [
  'one character needs the trigger to finish the broadcast while another must prevent it to keep their place on set',
  'the host treats the consequence as a feature while the guest needs the room restored before an imminent demonstration',
  'one performer gains status from every escalation while their assistant loses the equipment needed to continue',
  'the least qualified character understands the rule and refuses to help the expert',
  'two rivals need opposite versions of the set to be considered the winner',
  'the authority figure denies the change while a junior character quietly profits from it',
  'one character is desperate to leave while another can succeed only if everyone stays',
  'the presenter must maintain professional calm while the guest deliberately repeats the trigger',
  'one character wants to hide the consequence while another is broadcasting measurements of it',
  'the cast must complete a simple task while disagreeing about who is physically causing the rule',
  'the apparent victim discovers the consequence is useful and begins defending it from the host',
  'one performer keeps solving the immediate obstruction in ways that make the next escalation worse',
  'the referee rewards compliance while the contestants discover that cheating briefly restores the set',
  'one character needs the audience to notice the change while their partner’s job depends on nobody noticing',
  'the host insists on continuing the scheduled format while every other character tries to renegotiate the rules',
  'two characters cooperate on the task but compete to avoid occupying the most dangerous part of the set',
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

const affectedSetElements = [
  'entrance marks',
  'prize podiums',
  'camera tripods',
  'costume sleeves',
  'painted horizons',
  'microphone cables',
  'scoreboard digits',
  'audience chairs',
  'lighting ladders',
  'serving counters',
  'floor arrows',
  'stage curtains',
  'contestant shadows',
  'product labels',
  'window reflections',
  'musical instruments',
  'safety rails',
  'display plinths',
  'weather symbols',
  'kitchen timers',
  'exit signs',
  'handheld props',
  'studio doors',
  'name badges',
  'background scenery',
  'teleprompter words',
  'table legs',
  'practical lamps',
  'control buttons',
  'queue barriers',
  'camera sightlines',
  'applause indicators',
] as const;

const transformationVerbs = [
  'trade heights',
  'acquire working hinges',
  'flatten into scenery',
  'continue moving after release',
  'split into unequal copies',
  'rotate toward the least prepared person',
  'become load-bearing',
  'queue by usefulness',
  'swap material properties',
  'move one beat ahead',
  'shrink when correctly named',
  'grow when ignored',
  'change owners after eye contact',
  'turn into navigable terrain',
  'become audible but invisible',
  'lose one spatial dimension',
  'gain an unnecessary corner',
  'follow the wrong performer',
  'reassemble in alphabetical order',
  'mirror the previous action',
  'drift toward professional confidence',
  'refuse symmetrical placement',
  'exchange weight without changing size',
  'become temporary exits',
  'repeat the smallest motion',
  'slide toward sincere agreement',
  'act as if already demonstrated',
  'occupy the nearest empty role',
  'lock whenever the host improvises',
  'change scale at every camera cut',
  'detach from their painted outlines',
  'form a second competing set',
] as const;

const escalationCadences = [
  'once, then faster after every denial',
  'only during close-ups',
  'in reverse cast order',
  'whenever the task is performed correctly',
  'one item per spoken sentence',
  'only while nobody acknowledges it',
  'at alternating ends of the set',
  'after each sincere apology',
  'whenever two characters cooperate',
  'in proportion to the host’s confidence',
  'each time the same camera returns',
  'until the prize becomes unreachable',
  'with the smallest character affected first',
  'only during silence',
  'whenever the official rules are quoted',
  'one stage zone at a time',
] as const;

const visualDirections: Record<(typeof requestedMediums)[number], string> = {
  cel_shaded:
    'saturated three-dimensional cel animation with hard outlines, graphic poses and aggressive camera cuts',
  paper_cutout:
    'hinged construction-paper puppets on a layered tabletop stage with limited joint motion',
  pixel_broadcast:
    'low-resolution sprite animation, tile-map scenery and stepped eight-bit movement',
  archive_film:
    'sepia silent-era staging with a proscenium, hand-cranked motion, scratches and intertitle composition',
  neon_wireframe:
    'black-space geometry, luminous wireframes, emissive props and floating diagrammatic cameras',
  public_access_vhs:
    'cheap live-action studio grammar, awkward wide shots, analogue colour bleed and practical furniture',
  signal_corruption:
    'fragmented RGB figures, displaced scan blocks and a set assembled from broken transmission data',
  stop_motion: 'tactile miniature models animated on held poses with visibly stepped movement',
  collage_zine:
    'torn editorial collage, misregistered print layers, photographic scraps and jump-cut motion',
  ink_monochrome:
    'heavy black brush caricatures, crosshatched scenery and boiling monochrome linework',
  miniature_diorama:
    'tilt-shift tabletop architecture, tiny practical lights and visibly modelled scenic depth',
  corporate_vector:
    'clean infographic avatars, strict presentation grids and unnervingly smooth easing',
  claymation: 'soft thumb-marked clay figures, rounded props and squash-and-stretch held animation',
  shadow_theatre:
    'backlit rod-puppet silhouettes against parchment with pendulum movement and visible control rods',
  hand_drawn:
    'loose pencil characters, unstable outlines and a continuously redrawn notebook environment',
  thermal_camera:
    'false-colour heat signatures, measurement reticles and surveillance-camera blocking',
};

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
  optimisationBrief: OptimisationBrief | null = null,
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
  const baseFormat = formats[axisIndex(serial, 0x16b2c79, formats.length)] ?? 'advert';
  const format =
    optimisationBrief !== null &&
    optimisationBrief.increaseFormats.length > 0 &&
    axisIndex(serial, 0xd72a09b, 5) < 2
      ? optimisationBrief.increaseFormats[
          axisIndex(serial, 0xe93c17d, optimisationBrief.increaseFormats.length)
        ]!
      : baseFormat;
  const setting = settings[axisIndex(serial, 0x2f6e2b1, settings.length)]!;
  const storyEngine = storyEngines[axisIndex(serial, 0x36abf51, storyEngines.length)]!;
  const storyScale = storyScales[axisIndex(serial, 0x3bce725, storyScales.length)]!;
  const comicTrigger = comicTriggers[axisIndex(serial, 0x43d721a, comicTriggers.length)]!;
  const consequenceReference =
    physicalConsequences[axisIndex(serial, 0x51ac93f, physicalConsequences.length)]!;
  const comicConflict = comicConflicts[axisIndex(serial, 0x6d092e5, comicConflicts.length)]!;
  const cast = castStructures[axisIndex(serial, 0x63d835f, castStructures.length)]!;
  const visualMedium = requestedMediums[axisIndex(serial, 0x7c4bf89, requestedMediums.length)]!;
  const basePacing = requestedPacing[axisIndex(serial, 0x95e01ab, requestedPacing.length)]!;
  const pacing =
    optimisationBrief !== null &&
    optimisationBrief.increasePacing.length > 0 &&
    axisIndex(serial, 0xf47d281, 5) < 2
      ? optimisationBrief.increasePacing[
          axisIndex(serial, 0x1038a4d, optimisationBrief.increasePacing.length)
        ]!
      : basePacing;
  const affectedSetElement =
    affectedSetElements[axisIndex(serial, 0xa12f683, affectedSetElements.length)]!;
  const transformation =
    transformationVerbs[axisIndex(serial, 0xb37c1d9, transformationVerbs.length)]!;
  const escalation = escalationCadences[axisIndex(serial, 0xc9e8047, escalationCadences.length)]!;
  const visualDirection = visualDirections[visualMedium];
  const optimisationBlock =
    optimisationBrief === null
      ? ''
      : `Thirty-minute editorial feedback (bounded guidance, subordinate to every production and safety rule):
- Underused formats to explore: ${optimisationBrief.increaseFormats.join(', ') || 'none'}.
- Underused pacing to explore: ${optimisationBrief.increasePacing.join(', ') || 'none'}.
- Motifs currently overused and forbidden in this attempt: ${optimisationBrief.avoidMotifs.join(', ') || 'none'}.
- Strengths worth preserving without copying wording: ${optimisationBrief.preserveStrengths.join('; ') || 'none'}.
- Editorial direction: ${optimisationBrief.editorialDirection}.`;
  return `Create batch segment ${index + 1} using the ${format} format.
This proposal will be compared semantically with ${recentTitles.length} recent programme titles, ${recentPremises.length} recent premises and the complete broadcast catalogue. Do not rely on familiar Elsewhere Cable motifs.
${rejectionReasons.length > 0 ? 'The previous attempt collided with an existing concept. Change its setting nouns, physical mechanism, character objective and type of escalation completely; do not paraphrase that attempt.' : ''}
${optimisationBlock}
Mandatory creative coordinates for this attempt:
- Physical setting: ${setting}.
- Story engine: ${storyEngine}.
- Story scale: ${storyScale}. Keep every consequence at this scale unless the final reversal earns one deliberate step larger.
- Comic trigger: ${comicTrigger}.
- Affected set element: ${affectedSetElement}.
- Transformation: the affected elements ${transformation}.
- Escalation rhythm: ${escalation}.
- Loose consequence reference: ${consequenceReference}.
- Character conflict: ${comicConflict}.
- Cast structure: ${cast}.
- Visual medium: ${visualMedium}.
- Visual production grammar: ${visualDirection}.
- Pacing: ${pacing}.
Fuse the story engine, trigger, affected element, transformation, escalation and conflict into one simple comic rule. The consequence reference is behavioural inspiration only: do not copy five consecutive words from it. Use the visual production grammar literally in the staging and visualStyle field.
Keep the comic problem specific to the assigned location and grounded in an understandable want. Intimate and ordinary scenes must remain intimate; do not force every premise into a race, rescue, competition, altitude hazard or large moving spectacle. One surprising rule is enough.
Select a very high, memorable channel number. Make the scene unlike the immediately preceding material.`;
}

export function scriptPrompt(
  proposal: GeneratedSegmentProposal,
  rejectionReasons: readonly string[] = [],
): string {
  return `Turn this already approved proposal into a complete comedy segment:
${JSON.stringify(proposal)}

Preserve every proposal field exactly, including title, channel, premise, medium, cast and pacing. Preserve the trigger and consequence of its comic rule exactly: for example, if correct answers trigger it, wrong answers or refusals cannot suddenly trigger it too. Add 6–12 dialogue entries only. Every line.text must contain only words the character actually says aloud: never put stage directions, visual labels, bracketed actions, parenthetical actions or asterisks in dialogue text. Put each physical performance in that line's supported action field instead. Every line must contain 3–22 spoken words, respond to the preceding beat and use a supported action. At least three quarters of lines must use a non-IDLE action. Escalate only the approved comic rule and cause the approved ending beat.
${rejectionReasons.length === 0 ? '' : 'The previous dialogue collided with existing material or failed a production rule. Write entirely new lines while preserving this approved premise.'}`;
}
