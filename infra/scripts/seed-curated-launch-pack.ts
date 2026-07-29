import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  generatedSegmentDraftSchema,
  playoutManifestSchema,
  preparedScriptSchema,
  segmentPackageSchema,
  type GeneratedSegmentDraft,
} from '../../packages/schemas/src/index.js';
import { critiquePremise } from '../../apps/generation-worker/src/premise-critic.js';
import {
  noveltyIssues,
  recordFromDraft,
  recordFromSegment,
  type CreativeRecord,
} from '../../apps/generation-worker/src/novelty.js';
import {
  assertPreviewSafe,
  proposalQualityIssues,
} from '../../apps/generation-worker/src/production.js';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const queueRoot = path.resolve(workspaceRoot, argument('script-queue') ?? 'data/script-reservoir');
const segmentsRoot = path.resolve(workspaceRoot, argument('segments') ?? 'data/segments-live');

const curatedDrafts: GeneratedSegmentDraft[] = [
  {
    channelNumber: 7_201_884_903,
    channelName: 'Small Hours Catalogue',
    programmeTitle: 'Five Minutes of Borrowed Silence',
    format: 'shopping',
    realityId: 'RETAIL-QUIET-31',
    visualStyle: 'hinged_paper_midnight_catalogue',
    visualMedium: 'paper_cutout',
    castArchetype: 'paper_puppets',
    pacing: 'slow_burn',
    storyMode: 'product_consequence',
    premise:
      'In a late-night shopping studio, a host wants to sell a bottled-silence product, but the customer refuses its price because late fees are payable only in sincere compliments.',
    tone: ['dry', 'intimate', 'awkward'],
    dialogue: [
      {
        speaker: 'Host Niva',
        text: 'Five uninterrupted minutes, sealed this afternoon.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Penn',
        text: 'I only need three minutes for an apology.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Host Niva',
        text: 'Unused silence still attracts the full late fee.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Penn',
        text: 'I cannot owe compliments to a bottle.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Host Niva',
        text: 'You just called it a very practical bottle.',
        action: 'PAUSE',
      },
      {
        speaker: 'Caller Penn',
        text: 'That was evidence, not admiration.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Host Niva',
        text: 'The bottle has accepted it as a deposit.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Bottled silence accepts sincere compliments as late-payment currency.',
    endingBeat:
      'The host places the untouched bottle beside a receipt already crediting the caller with one compliment.',
  },
  {
    channelNumber: 9_403_118_227,
    channelName: 'Neighbourhood Eight-Bit News',
    programmeTitle: 'Umbrella Authority',
    format: 'news',
    realityId: 'PIXEL-BOROUGH-8',
    visualStyle: 'eight_bit_rain_bulletin',
    visualMedium: 'pixel_broadcast',
    castArchetype: 'humanoid',
    pacing: 'staccato',
    storyMode: 'status_transfer',
    premise:
      'At a regional news desk, a reporter wants credit for a flooded crossing, but the local official refuses because interview authority belongs to whoever kept the ceremonial umbrella driest.',
    tone: ['urgent', 'petty', 'local'],
    dialogue: [
      {
        speaker: 'Anchor Lio',
        text: 'Who currently holds interview authority?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Reporter Senn',
        text: 'I do. I reached the crossing first.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Official Brigg',
        text: 'Your umbrella is visibly damp.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Reporter Senn',
        text: 'I was reporting the flood.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Official Brigg',
        text: 'The dry witness outranks the wet reporter.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Witness Omi',
        text: 'I stayed indoors and saw nothing.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Anchor Lio',
        text: 'That is impeccable municipal dryness.',
        action: 'PAUSE',
      },
      {
        speaker: 'Reporter Senn',
        text: 'Fine. Please interview me about your absence.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The driest ceremonial umbrella grants temporary interview authority.',
    endingBeat:
      'The reporter hands the umbrella to the witness and silently takes the witness position beside the flooded map.',
  },
  {
    channelNumber: 6_118_004_771,
    channelName: 'Break Room Family',
    programmeTitle: 'Help Yourself',
    format: 'sitcom',
    realityId: 'WORKPLACE-CAKE-5',
    visualStyle: 'bold_cel_office_comedy',
    visualMedium: 'cel_shaded',
    castArchetype: 'humanoid',
    pacing: 'conversational',
    storyMode: 'semantic_contract',
    premise:
      'In a workplace break room, Mara wants the final cake slice, but colleague Iven refuses to offer it because saying the phrase help yourself contractually accepts the other person’s late shift.',
    tone: ['warm', 'competitive', 'dry'],
    dialogue: [
      {
        speaker: 'Mara',
        text: 'Are you going to eat that slice?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Iven',
        text: 'I am considering your interest in it.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Mara',
        text: 'You could simply offer it.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Iven',
        text: 'And inherit your Thursday closing shift?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Mara',
        text: 'Only if you use the contractual phrase.',
        action: 'PAUSE',
      },
      {
        speaker: 'Iven',
        text: 'Please independently encounter the cake.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Supervisor Talo',
        text: 'Excellent. Nobody offered this to me.',
        action: 'ENTER',
      },
      {
        speaker: 'Mara',
        text: 'Take it, but do not thank us.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Saying help yourself transfers a colleague’s next late shift to the speaker.',
    endingBeat:
      'The supervisor takes the cake without speaking while Mara and Iven both wait for the forbidden phrase.',
  },
  {
    channelNumber: 8_700_300_119,
    channelName: 'Calm Incident Office',
    programmeTitle: 'Premature Apology Recall',
    format: 'emergency',
    realityId: 'CIVIC-SERVICE-12',
    visualStyle: 'flat_vector_public_notice',
    visualMedium: 'corporate_vector',
    castArchetype: 'geometric_aliens',
    pacing: 'interrupted',
    storyMode: 'service_mismatch',
    premise:
      'During a municipal emergency recall, an official wants every customer to return apologies delivered one day early, but caller Ulo refuses because tonight’s dinner still needs theirs.',
    tone: ['calm', 'bureaucratic', 'domestic'],
    dialogue: [
      {
        speaker: 'Official Dax',
        text: 'Return all apologies dated tomorrow.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Ulo',
        text: 'Mine is for dinner tonight.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Official Dax',
        text: 'Then it arrived before the offence.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Caller Ulo',
        text: 'That is when I sound most convincing.',
        action: 'PAUSE',
      },
      {
        speaker: 'Official Dax',
        text: 'Keep the envelope. Return the sincerity.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Ulo',
        text: 'Can I borrow it again after dessert?',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Premature apologies are recalled separately from their envelopes.',
    endingBeat:
      'The official stamps the empty envelope approved while placing its sincerity in the returns tray.',
  },
  {
    channelNumber: 9_999_401_006,
    channelName: 'Schedule Margin',
    programmeTitle: 'Credit Before Programme',
    format: 'ident',
    realityId: 'CONTINUITY-TEXT-0',
    visualStyle: 'green_neon_continuity_terminal',
    visualMedium: 'neon_wireframe',
    castArchetype: 'talking_objects',
    pacing: 'near_silent',
    storyMode: 'format_literalism',
    premise:
      'In a late-night continuity booth, announcer Pell wants to introduce the next programme, but its title card refuses until the lower third receives an end credit.',
    tone: ['minimal', 'professional', 'awkward'],
    dialogue: [
      {
        speaker: 'Announcer Pell',
        text: 'And now, your next programme.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Title Card',
        text: 'Not before the lower third is thanked.',
        action: 'FREEZE',
      },
      {
        speaker: 'Lower Third',
        text: 'I carried every difficult surname.',
        action: 'PAUSE',
      },
      {
        speaker: 'Announcer Pell',
        text: 'Fine. Lower third by itself.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Title Card',
        text: 'Credit accepted. Introduction withdrawn.',
        action: 'EXIT',
      },
    ],
    continuityFact: 'Lower thirds may demand end credits before the next programme begins.',
    endingBeat:
      'A tiny lower-third credit rolls across the title card while the next programme begins silently behind both graphics.',
  },
  {
    channelNumber: 7_731_500_882,
    channelName: 'Receipt Demonstration Service',
    programmeTitle: 'The Discount Has Representation',
    format: 'advert',
    realityId: 'CLAY-RETAIL-44',
    visualStyle: 'fingerprinted_clay_product_ad',
    visualMedium: 'claymation',
    castArchetype: 'talking_objects',
    pacing: 'frantic',
    storyMode: 'object_agency',
    premise:
      'At a trade-show advert, a demonstrator wants to announce a discount, but the talking receipt refuses to print it until the product grants the receipt paid representation.',
    tone: ['bright', 'frantic', 'contractual'],
    dialogue: [
      {
        speaker: 'Demonstrator Kes',
        text: 'Today only, this kettle is half price.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Receipt',
        text: 'I refuse to document unpaid enthusiasm.',
        action: 'FREEZE',
      },
      {
        speaker: 'Demonstrator Kes',
        text: 'You are twelve centimetres of paper.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Receipt',
        text: 'Twelve centimetres with excellent records.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Kettle',
        text: 'Can we settle after the demonstration?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Receipt',
        text: 'Deferred recognition carries a steam surcharge.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Demonstrator Kes',
        text: 'I can offer prominent counter space.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Receipt',
        text: 'Plus my name above the price.',
        action: 'PAUSE',
      },
      {
        speaker: 'Kettle',
        text: 'Give it the byline, Kes.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Demonstrator Kes',
        text: 'Fine. Receipt presents kettle.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Retail receipts may withhold discounts until products fund their representation.',
    endingBeat:
      'The receipt prints its own name above the discounted kettle while the demonstrator points from below the price.',
  },
  {
    channelNumber: 6_404_772_015,
    channelName: 'Village Shadow Committee',
    programmeTitle: 'The Empty Chair Majority',
    format: 'public_access',
    realityId: 'HALL-SHADOW-17',
    visualStyle: 'cut_card_shadow_civic_hour',
    visualMedium: 'shadow_theatre',
    castArchetype: 'paper_puppets',
    pacing: 'slow_burn',
    storyMode: 'social_protocol',
    premise:
      'At a community-hall appeal, resident Fen wants permission to move one empty chair, but clerk Voss refuses because local custom gives unoccupied seats speaking priority.',
    tone: ['earnest', 'quiet', 'procedural'],
    dialogue: [
      {
        speaker: 'Resident Fen',
        text: 'This chair blocks the noticeboard.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clerk Voss',
        text: 'It has not finished its remarks.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Resident Fen',
        text: 'It has not started them.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Clerk Voss',
        text: 'That is disciplined public speaking.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Resident Fen',
        text: 'May I sit there and shorten its turn?',
        action: 'PAUSE',
      },
      {
        speaker: 'Clerk Voss',
        text: 'Only after every emptier chair.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Unoccupied village-hall seats receive speaking priority over residents.',
    endingBeat:
      'Fen sits on the floor and the clerk adds the newly empty floor space to the speaker list.',
  },
  {
    channelNumber: 8_118_660_441,
    channelName: 'Forecast Attribution Desk',
    programmeTitle: 'The Map Wants a Byline',
    format: 'news',
    realityId: 'WEATHER-INK-29',
    visualStyle: 'black_ink_weather_bulletin',
    visualMedium: 'ink_monochrome',
    castArchetype: 'mixed',
    pacing: 'conversational',
    storyMode: 'object_agency',
    premise:
      'At a regional news weather wall, a talking map demands headline credit before the forecaster reports rain, but the anchor refuses because maps are classified as locations.',
    tone: ['serious', 'petty', 'rainy'],
    dialogue: [
      {
        speaker: 'Forecaster Reet',
        text: 'Rain reaches the western district by six.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Weather Map',
        text: 'According to whom?',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Anchor Sol',
        text: 'According to Reet, our forecaster.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Weather Map',
        text: 'She keeps pointing at my research.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Forecaster Reet',
        text: 'You are also the evidence.',
        action: 'PAUSE',
      },
      {
        speaker: 'Weather Map',
        text: 'Then headline me before I become tomorrow.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Anchor Sol',
        text: 'Fine. Weather Map, reporting from itself.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Weather maps may claim headline credit for forecasts displayed on themselves.',
    endingBeat:
      'The map receives a byline so wide that it covers the rain symbol the forecaster was about to discuss.',
  },
  {
    channelNumber: 8_441_207_663,
    channelName: 'Domestic Rank Exchange',
    programmeTitle: 'The Most Junior Hat',
    format: 'sitcom',
    realityId: 'HOUSEHOLD-HAT-62',
    visualStyle: 'bold_cel_kitchen_status_comedy',
    visualMedium: 'cel_shaded',
    castArchetype: 'humanoid',
    pacing: 'conversational',
    storyMode: 'status_transfer',
    premise:
      'In a shared kitchen, trainee Mina wants the larger bedroom, but housemate Orro refuses because household authority transfers to whoever is wearing the least senior hat.',
    tone: ['warm', 'petty', 'domestic'],
    dialogue: [
      {
        speaker: 'Mina',
        text: 'I found the room and paid the deposit.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Orro',
        text: 'You are wearing a management brim.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Mina',
        text: 'This is a paper party hat.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Orro',
        text: 'Exactly. No experience, tremendous authority.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Mina',
        text: 'Then remove your respectable cap.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Orro',
        text: 'I cannot accept that promotion.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Neighbour Pell',
        text: 'I brought no hat at all.',
        action: 'ENTER',
      },
      {
        speaker: 'Mina',
        text: 'Fine. Pell can allocate the rooms.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The least senior hat grants temporary household authority.',
    endingBeat:
      'The hatless neighbour takes the larger bedroom while Mina and Orro formally demote their hats.',
  },
  {
    channelNumber: 9_220_641_775,
    channelName: 'Previously Confident Shopping',
    programmeTitle: 'Confidence With One Previous Owner',
    format: 'shopping',
    realityId: 'ARCHIVE-RETAIL-18',
    visualStyle: 'scratched_film_personality_catalogue',
    visualMedium: 'archive_film',
    castArchetype: 'mixed',
    pacing: 'slow_burn',
    storyMode: 'product_consequence',
    premise:
      'In a late-night shopping studio, host Vela wants a caller to keep a second-hand confidence product, but the caller refuses because it keeps introducing them by the previous owner’s name.',
    tone: ['reassuring', 'awkward', 'faded'],
    dialogue: [
      {
        speaker: 'Host Vela',
        text: 'The confidence itself remains in excellent condition.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Deni',
        text: 'It introduced me as Malcolm at breakfast.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Host Vela',
        text: 'Malcolm selected the premium social finish.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Caller Deni',
        text: 'My family now prefers him.',
        action: 'PAUSE',
      },
      {
        speaker: 'Host Vela',
        text: 'Would you exchange for his modesty?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caller Deni',
        text: 'No. Malcolm would never accept that.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Second-hand confidence may retain the previous owner’s introduction.',
    endingBeat:
      'The caller confidently declines the refund under Malcolm’s name and the host marks the product fully transferred.',
  },
  {
    channelNumber: 7_605_118_934,
    channelName: 'Pocket Promotion Demonstrations',
    programmeTitle: 'Tomorrow’s Name Badge',
    format: 'advert',
    realityId: 'MINI-OFFICE-47',
    visualStyle: 'tilt_shift_model_office_advert',
    visualMedium: 'miniature_diorama',
    castArchetype: 'humanoid',
    pacing: 'staccato',
    storyMode: 'service_mismatch',
    premise:
      'At a miniature trade-show office, courier Fen wants a customer to sign for tomorrow’s promotion badge, but the customer refuses because their manager is standing beside the parcel.',
    tone: ['bright', 'tense', 'professional'],
    dialogue: [
      {
        speaker: 'Courier Fen',
        text: 'Delivery for tomorrow’s department manager.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Isha',
        text: 'Please deliver that tomorrow.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Courier Fen',
        text: 'Tomorrow requested priority yesterday.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Manager Korr',
        text: 'Who ordered my replacement badge?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Customer Isha',
        text: 'Apparently your replacement did.',
        action: 'PAUSE',
      },
      {
        speaker: 'Courier Fen',
        text: 'I only need either manager’s signature.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Manager Korr',
        text: 'Fine. I am still qualified today.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Customer Isha',
        text: 'Thank you for approving my delivery.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Priority couriers may deliver tomorrow’s workplace promotions one day early.',
    endingBeat:
      'The current manager signs the future manager line and the courier pins the badge on Isha.',
  },
  {
    channelNumber: 9_681_002_145,
    channelName: 'Orderly Incident Merger',
    programmeTitle: 'Please Join the Other Queue',
    format: 'emergency',
    realityId: 'CIVIC-QUEUE-93',
    visualStyle: 'calm_vector_queue_notice',
    visualMedium: 'corporate_vector',
    castArchetype: 'geometric_aliens',
    pacing: 'frantic',
    storyMode: 'social_protocol',
    premise:
      'At a ferry emergency desk, official Sulo wants two delayed queues to merge, but passenger Tann refuses because local etiquette requires the person with the least useful luggage to lead.',
    tone: ['calm', 'urgent', 'courteous'],
    dialogue: [
      {
        speaker: 'Official Sulo',
        text: 'Both queues must become one immediately.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Passenger Tann',
        text: 'Who has the least useful luggage?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Official Sulo',
        text: 'This is an evacuation, not an inspection.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Passenger Tann',
        text: 'Then your ceremonial cushion currently leads.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Official Sulo',
        text: 'The cushion has no ferry ticket.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Passenger Tann',
        text: 'That makes it impressively useless.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Second Passenger',
        text: 'My suitcase contains another suitcase.',
        action: 'ENTER',
      },
      {
        speaker: 'Official Sulo',
        text: 'Excellent. Please stand behind the cushion.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Passenger Tann',
        text: 'The merger is now properly led.',
        action: 'PAUSE',
      },
      {
        speaker: 'Official Sulo',
        text: 'Nobody mention the empty ferry.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The least useful luggage leads a merged emergency queue.',
    endingBeat:
      'Both queues follow the ceremonial cushion toward the desk while the official carries it backwards.',
  },
  {
    channelNumber: 8_003_771_402,
    channelName: 'Minute Allocation Network',
    programmeTitle: 'The Clock’s Lunch Break',
    format: 'ident',
    realityId: 'PIXEL-TIME-04',
    visualStyle: 'chunky_pixel_continuity_clock',
    visualMedium: 'pixel_broadcast',
    castArchetype: 'talking_objects',
    pacing: 'near_silent',
    storyMode: 'object_agency',
    premise:
      'In a late-night continuity booth, announcer Es wants to display the next programme time, but the station clock refuses until it receives an uninterrupted lunch minute.',
    tone: ['minimal', 'tired', 'precise'],
    dialogue: [
      {
        speaker: 'Announcer Es',
        text: 'The next programme begins at twelve thirty.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Station Clock',
        text: 'That minute belongs to my lunch.',
        action: 'FREEZE',
      },
      {
        speaker: 'Announcer Es',
        text: 'You display every minute.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Station Clock',
        text: 'Exactly. I never receive one.',
        action: 'PAUSE',
      },
      {
        speaker: 'Announcer Es',
        text: 'Take twelve twenty-nine quietly.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Station Clock',
        text: 'Agreed. Programming resumes after dessert.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Station clocks may reserve one displayed minute as an uninterrupted lunch break.',
    endingBeat:
      'The clock replaces 12:29 with a tiny sandwich icon while the announcer holds the schedule.',
  },
  {
    channelNumber: 7_482_330_196,
    channelName: 'Postal Meeting Service',
    programmeTitle: 'Return to Sender',
    format: 'public_access',
    realityId: 'STOPMOTION-POST-76',
    visualStyle: 'jerky_stop_motion_postal_hearing',
    visualMedium: 'stop_motion',
    castArchetype: 'humanoid',
    pacing: 'interrupted',
    storyMode: 'semantic_contract',
    premise:
      'At a library postal hearing, resident Bea wants a misdelivered meeting returned, but clerk Odo refuses because saying the phrase return to sender contractually makes the speaker chair the next meeting.',
    tone: ['earnest', 'administrative', 'awkward'],
    dialogue: [
      {
        speaker: 'Resident Bea',
        text: 'This committee meeting arrived at my flat.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clerk Odo',
        text: 'Do you wish to return it?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Resident Bea',
        text: 'I know what that phrase does.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Clerk Odo',
        text: 'Then describe your preferred postal outcome.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Resident Bea',
        text: 'Please send the meeting somewhere backwards.',
        action: 'PAUSE',
      },
      {
        speaker: 'Clerk Odo',
        text: 'Excellent wording, Chair Bea.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Saying return to sender makes the speaker chair the next misdelivered meeting.',
    endingBeat: 'The clerk posts Bea the chairperson badge inside the same meeting envelope.',
  },
  {
    channelNumber: 9_115_407_288,
    channelName: 'Correction District News',
    programmeTitle: 'The Forecast Must Apologise',
    format: 'news',
    realityId: 'VHS-WEATHER-51',
    visualStyle: 'wobbly_public_access_weather_tape',
    visualMedium: 'public_access_vhs',
    castArchetype: 'mixed',
    pacing: 'conversational',
    storyMode: 'format_literalism',
    premise:
      'At a regional weather wall, forecaster Jori wants to show tomorrow’s sunshine, but the anchor refuses because the live broadcast correction caption must apologise for yesterday’s rain first.',
    tone: ['local', 'formal', 'mildly resentful'],
    dialogue: [
      {
        speaker: 'Forecaster Jori',
        text: 'Tomorrow will be clear and pleasantly warm.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Anchor Reva',
        text: 'Yesterday’s rain has not received an apology.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Forecaster Jori',
        text: 'The rain was accurately forecast.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Correction Caption',
        text: 'Accuracy does not excuse damp trousers.',
        action: 'FREEZE',
      },
      {
        speaker: 'Anchor Reva',
        text: 'Please address the western district directly.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Forecaster Jori',
        text: 'I regret your weather occurred.',
        action: 'PAUSE',
      },
      {
        speaker: 'Correction Caption',
        text: 'Accepted. Sunshine may now be mentioned.',
        action: 'EXIT',
      },
      {
        speaker: 'Anchor Reva',
        text: 'Too late. We have reached sport.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Correction captions may withhold new forecasts until old weather is apologised for.',
    endingBeat:
      'The sunshine symbol appears behind a sports score while the forecaster silently points at it.',
  },
  {
    channelNumber: 8_740_992_531,
    channelName: 'Approved Visitor Comedy',
    programmeTitle: 'The Professional Guest',
    format: 'sitcom',
    realityId: 'PENCIL-FLAT-27',
    visualStyle: 'loose_pencil_flatmate_comedy',
    visualMedium: 'hand_drawn',
    castArchetype: 'humanoid',
    pacing: 'staccato',
    storyMode: 'service_mismatch',
    premise:
      'In a family living room, host Lemi wants one polite dinner guest, but the professional guest service sends Noll, who fulfils the booking by correcting everyone else’s hospitality.',
    tone: ['warm', 'awkward', 'domestic'],
    dialogue: [
      {
        speaker: 'Lemi',
        text: 'You were hired to admire the casserole.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Guest Noll',
        text: 'First, your welcome requires a second attempt.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Housemate Venn',
        text: 'We already let you inside.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Guest Noll',
        text: 'Physically, yes. Socially, I remain outside.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Lemi',
        text: 'Please admire something before it cools.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Guest Noll',
        text: 'That instruction was almost host-shaped.',
        action: 'PAUSE',
      },
      {
        speaker: 'Housemate Venn',
        text: 'Would you like the larger chair?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Guest Noll',
        text: 'Excellent. Venn is hosting dinner now.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Professional guests may reassign hosting duties when hospitality improves.',
    endingBeat:
      'Noll applauds Venn’s hosting while Lemi is handed the guest coat and the smallest chair.',
  },
  {
    channelNumber: 9_771_420_608,
    channelName: 'Portable Waiting Solutions',
    programmeTitle: 'Carry Your Place',
    format: 'advert',
    realityId: 'CLAY-QUEUE-82',
    visualStyle: 'bright_clay_trade_counter',
    visualMedium: 'claymation',
    castArchetype: 'talking_objects',
    pacing: 'frantic',
    storyMode: 'product_consequence',
    premise:
      'At a trade-show advert, demonstrator Rell wants customer Pavi to buy a queue-folding product, but Pavi refuses because the bag carries only their place and none of their belongings.',
    tone: ['bright', 'urgent', 'contractual'],
    dialogue: [
      {
        speaker: 'Demonstrator Rell',
        text: 'Fold any waiting place into this convenient bag.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Pavi',
        text: 'Where do my actual belongings go?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Queue Bag',
        text: 'Belongings have never waited politely.',
        action: 'FREEZE',
      },
      {
        speaker: 'Demonstrator Rell',
        text: 'Your place remains fresh for seven days.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Pavi',
        text: 'I waited here to return this bag.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Queue Bag',
        text: 'That place is already inside me.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Demonstrator Rell',
        text: 'Then your refund is first in line.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Customer Pavi',
        text: 'May I leave while it waits?',
        action: 'PAUSE',
      },
      {
        speaker: 'Queue Bag',
        text: 'Only your place purchased me.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Demonstrator Rell',
        text: 'Congratulations. Your place is our newest customer.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Queue-folding bags treat stored places as customers separate from their owners.',
    endingBeat:
      'Rell hands the receipt to the empty waiting mark while Pavi quietly takes the bag’s place on the display.',
  },
  {
    channelNumber: 8_660_305_771,
    channelName: 'Heat Signature Bulletin',
    programmeTitle: 'Warmest Voice First',
    format: 'news',
    realityId: 'THERMAL-DESK-19',
    visualStyle: 'thermal_camera_evening_news',
    visualMedium: 'thermal_camera',
    castArchetype: 'geometric_aliens',
    pacing: 'interrupted',
    storyMode: 'status_transfer',
    premise:
      'At a thermal-camera news desk, reporter Senn wants credit for an exclusive interview, but anchor Varo refuses because speaking authority transfers to the warmest microphone.',
    tone: ['serious', 'competitive', 'technical'],
    dialogue: [
      {
        speaker: 'Reporter Senn',
        text: 'My witness is ready with exclusive evidence.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Anchor Varo',
        text: 'Your microphone is three degrees too junior.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Reporter Senn',
        text: 'It spent all afternoon outside.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Witness Olo',
        text: 'Mine was under my coat.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Anchor Varo',
        text: 'Then the witness now conducts the interview.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Witness Olo',
        text: 'Excellent. Senn, why were you outside?',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The warmest studio microphone temporarily grants speaking authority.',
    endingBeat:
      'Senn faces the witness’s glowing microphone while Varo places the exclusive card beneath the witness’s name.',
  },
  {
    channelNumber: 7_554_091_226,
    channelName: 'Domestic Place Settings',
    programmeTitle: 'The Senior Napkin',
    format: 'sitcom',
    realityId: 'PAPER-LUNCH-53',
    visualStyle: 'flat_paper_family_lunch',
    visualMedium: 'paper_cutout',
    castArchetype: 'paper_puppets',
    pacing: 'conversational',
    storyMode: 'social_protocol',
    premise:
      'At a family lunch, cousin Tavi wants the window seat, but host Enna refuses permission because household custom awards each place according to the napkin folded with greatest confidence.',
    tone: ['warm', 'petty', 'domestic'],
    dialogue: [
      {
        speaker: 'Cousin Tavi',
        text: 'I asked for the window seat yesterday.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Host Enna',
        text: 'Your napkin arrived without conviction.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Cousin Tavi',
        text: 'It is folded into a swan.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Aunt Mero',
        text: 'That swan appears open to suggestions.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Cousin Tavi',
        text: 'What did you fold?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Aunt Mero',
        text: 'A written refusal to move.',
        action: 'PAUSE',
      },
      {
        speaker: 'Host Enna',
        text: 'Very senior work, Mero.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Cousin Tavi',
        text: 'Fine. My swan formally disputes dessert.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Confidently folded napkins determine household seating seniority.',
    endingBeat:
      'Enna serves dessert to the refusal while Tavi’s paper swan receives the window seat alone.',
  },
  {
    channelNumber: 6_905_331_840,
    channelName: 'Civic Vocabulary Clinic',
    programmeTitle: 'A Word in Your Name',
    format: 'public_access',
    realityId: 'SHADOW-WORD-40',
    visualStyle: 'quiet_shadow_vocabulary_hearing',
    visualMedium: 'shadow_theatre',
    castArchetype: 'mixed',
    pacing: 'slow_burn',
    storyMode: 'semantic_contract',
    premise:
      'At a community vocabulary clinic, resident Jori wants the word mine removed from a borrowed sign, but clerk Pell refuses because saying the word renews the sign for another month.',
    tone: ['earnest', 'quiet', 'procedural'],
    dialogue: [
      {
        speaker: 'Resident Jori',
        text: 'This sign says the garden is mine.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clerk Pell',
        text: 'Thank you. It is renewed.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Resident Jori',
        text: 'I was identifying the disputed word.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Borrowed Sign',
        text: 'Your pronunciation was legally affectionate.',
        action: 'FREEZE',
      },
      {
        speaker: 'Resident Jori',
        text: 'Please remove the possessive mistake.',
        action: 'PAUSE',
      },
      {
        speaker: 'Clerk Pell',
        text: 'Certainly. The mistake now owns the garden.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Saying mine near a borrowed sign renews its claim for one month.',
    endingBeat: 'Pell crosses out Jori’s name and files the garden beneath the disputed word.',
  },
  {
    channelNumber: 9_204_881_663,
    channelName: 'Reciprocal Loyalty Shopping',
    programmeTitle: 'The Card Chooses a Customer',
    format: 'shopping',
    realityId: 'COLLAGE-RETAIL-64',
    visualStyle: 'torn_magazine_loyalty_studio',
    visualMedium: 'collage_zine',
    castArchetype: 'talking_objects',
    pacing: 'staccato',
    storyMode: 'object_agency',
    premise:
      'In a shopping studio, host Dema wants customer Lio to accept a refund, but the talking card refuses and demands to exchange Lio for someone with more points.',
    tone: ['bright', 'awkward', 'transactional'],
    dialogue: [
      {
        speaker: 'Host Dema',
        text: 'Your refund is ready, Lio.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Loyalty Card',
        text: 'The customer is below my standard.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Customer Lio',
        text: 'I earned every point on you.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Loyalty Card',
        text: 'You spent them without consulting me.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Host Dema',
        text: 'Cards cannot exchange customers.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Loyalty Card',
        text: 'Then why is he returnable?',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Customer Lio',
        text: 'Who has enough points for me?',
        action: 'PAUSE',
      },
      {
        speaker: 'Host Dema',
        text: 'Apparently, your refund does.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Talking loyalty cards may request an exchange of their registered customer.',
    endingBeat:
      'Dema pins the loyalty card to the refund envelope and places Lio beneath the returns sign.',
  },
  {
    channelNumber: 8_990_440_127,
    channelName: 'Minor Calendar Recovery',
    programmeTitle: 'Tuesday Has Been Recalled',
    format: 'emergency',
    realityId: 'VECTOR-WEEK-08',
    visualStyle: 'calm_vector_calendar_advisory',
    visualMedium: 'corporate_vector',
    castArchetype: 'geometric_aliens',
    pacing: 'frantic',
    storyMode: 'service_mismatch',
    premise:
      'During a civic emergency service recall, official Kess wants customer Rilo to return a borrowed Tuesday, but Rilo refuses because their appointment is still using its afternoon.',
    tone: ['calm', 'urgent', 'bureaucratic'],
    dialogue: [
      {
        speaker: 'Official Kess',
        text: 'Return Tuesday before the next announcement.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Rilo',
        text: 'My appointment still needs its afternoon.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Official Kess',
        text: 'Keep the appointment. Remove the weekday.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Customer Rilo',
        text: 'Then when should I arrive?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Official Kess',
        text: 'At the same time, without Tuesday.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Appointment Clerk',
        text: 'We cannot admit an unlabelled afternoon.',
        action: 'ENTER',
      },
      {
        speaker: 'Customer Rilo',
        text: 'Can Thursday supervise it briefly?',
        action: 'PAUSE',
      },
      {
        speaker: 'Official Kess',
        text: 'Thursday is not trained for afternoons.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Appointment Clerk',
        text: 'I can offer an unsupervised lunchtime.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Rilo',
        text: 'Fine. Tuesday may leave after lunch.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Recalled weekdays may leave their appointments behind under temporary supervision.',
    endingBeat:
      'Kess seals Tuesday in a return envelope while the appointment clerk labels the remaining afternoon unaccompanied.',
  },
  {
    channelNumber: 9_500_001_774,
    channelName: 'Courtesy Continuity',
    programmeTitle: 'Thank the Logo',
    format: 'ident',
    realityId: 'WIRE-IDENT-33',
    visualStyle: 'minimal_neon_logo_continuity',
    visualMedium: 'neon_wireframe',
    castArchetype: 'talking_objects',
    pacing: 'near_silent',
    storyMode: 'format_literalism',
    premise:
      'In a continuity ident, announcer Venn wants the next programme title displayed, but the network logo refuses to leave until its full on-screen name is thanked aloud.',
    tone: ['minimal', 'formal', 'tired'],
    dialogue: [
      {
        speaker: 'Announcer Venn',
        text: 'The scheduled programme is prepared to begin.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Logo Voice',
        text: 'Please complete the courtesy credit before continuing.',
        action: 'FREEZE',
      },
      {
        speaker: 'Announcer Venn',
        text: 'Thank you to the complete network symbol.',
        action: 'PAUSE',
      },
      {
        speaker: 'Logo Voice',
        text: 'Its registered name is considerably longer than that.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Announcer Venn',
        text: 'Then the programme can finish the acknowledgement.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Some network logos require a spoken courtesy credit before leaving an ident.',
    endingBeat:
      'The next programme title squeezes beside the unmoved logo and displays a tiny thank-you caption.',
  },
  {
    channelNumber: 7_830_119_452,
    channelName: 'Rotating Compliment Workshop',
    programmeTitle: 'Praise the Other Wall',
    format: 'public_access',
    realityId: 'INK-ROOM-72',
    visualStyle: 'hand_inked_rotating_demonstration',
    visualMedium: 'ink_monochrome',
    castArchetype: 'paper_puppets',
    pacing: 'conversational',
    storyMode: 'visual_physics',
    premise:
      'At a public community demonstration, tutor Miri wants resident Odo to praise a portrait, but Odo refuses because every compliment rotates the display wall away from its speaker.',
    tone: ['earnest', 'physical', 'awkward'],
    dialogue: [
      {
        speaker: 'Tutor Miri',
        text: 'Begin with one sincere visual compliment.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Resident Odo',
        text: 'The frame is acceptably square.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Tutor Miri',
        text: 'The wall barely considered that praise.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Portrait',
        text: 'I require something personally inconvenient.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Resident Odo',
        text: 'Your expression improves this entire room.',
        action: 'PAUSE',
      },
      {
        speaker: 'Tutor Miri',
        text: 'Excellent. The wall has chosen me.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Portrait',
        text: 'Now praise whichever side can still see me.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Compliments rotate certain display walls away from their speaker.',
    endingBeat:
      'The display wall rotates between Miri and Odo until the portrait faces an empty side of the studio.',
  },
  {
    channelNumber: 9_118_442_730,
    channelName: 'Pending Events News',
    programmeTitle: 'Permission Pending at the Bridge',
    format: 'news',
    realityId: 'PIXEL-CIVIC-61',
    visualStyle: 'chunky_pixel_ribbon_bulletin',
    visualMedium: 'pixel_broadcast',
    castArchetype: 'geometric_aliens',
    pacing: 'staccato',
    storyMode: 'service_mismatch',
    premise:
      'At a pixel local-news desk, anchor Iri wants worker Pell to report a bridge opening, but Pell refuses because the event service has not approved its application to happen.',
    tone: ['local', 'urgent', 'procedural'],
    dialogue: [
      {
        speaker: 'Anchor Iri',
        text: 'Is the bridge opening on schedule?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Worker Pell',
        text: 'Its application remains under event review.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Anchor Iri',
        text: 'The ribbon and guests are already waiting.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Worker Pell',
        text: 'Waiting is approved. Opening is not.',
        action: 'PAUSE',
      },
      {
        speaker: 'Ribbon Clerk',
        text: 'I can authorise a ceremonial hesitation.',
        action: 'ENTER',
      },
      {
        speaker: 'Anchor Iri',
        text: 'Can the bridge hesitate on camera?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Worker Pell',
        text: 'Only if nobody crosses with confidence.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Anchor Iri',
        text: 'Excellent. We join that uncertainty live.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Civic events require approval to happen even after their guests arrive.',
    endingBeat:
      'The ribbon clerk stamps hesitation approved while the waiting guests take one doubtful step onto the bridge.',
  },
  {
    channelNumber: 8_402_771_509,
    channelName: 'Numerical Lost Property',
    programmeTitle: 'Decimal on Loan',
    format: 'ident',
    realityId: 'STOP-NUMBER-24',
    visualStyle: 'stop_motion_number_cloakroom',
    visualMedium: 'stop_motion',
    castArchetype: 'talking_objects',
    pacing: 'near_silent',
    storyMode: 'semantic_contract',
    premise:
      'In a stop-motion continuity booth, announcer Sela wants to introduce the next programme, but clerk Om refuses because the spoken word channel signs out a decimal from numerical lost property.',
    tone: ['minimal', 'careful', 'administrative'],
    dialogue: [
      {
        speaker: 'Announcer Sela',
        text: 'Your next channel is ready.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clerk Om',
        text: 'You just borrowed decimal seven.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Announcer Sela',
        text: 'I did not request a decimal.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Number Seven',
        text: 'I have already taken the space between your numbers.',
        action: 'FREEZE',
      },
      {
        speaker: 'Clerk Om',
        text: 'Keep it. The next show starts after seven and before nine.',
        action: 'PAUSE',
      },
    ],
    continuityFact: 'Saying channel may sign out a decimal from numerical lost property.',
    endingBeat:
      'Decimal Seven settles between the channel digits while Om hangs the missing integer on a numbered coat hook.',
  },
  {
    channelNumber: 7_114_902_663,
    channelName: 'Laundry Household Comedy',
    programmeTitle: 'The Unmatched Veto',
    format: 'sitcom',
    realityId: 'CEL-LAUNDRY-10',
    visualStyle: 'bold_cel_family_laundrette',
    visualMedium: 'cel_shaded',
    castArchetype: 'humanoid',
    pacing: 'conversational',
    storyMode: 'status_transfer',
    premise:
      'At a family laundrette, sibling Mara wants the dryer key, but cousin Oren refuses because household veto authority belongs to whoever carries the most convincing unmatched sock.',
    tone: ['warm', 'competitive', 'domestic'],
    dialogue: [
      {
        speaker: 'Sibling Mara',
        text: 'My clothes have occupied that dryer for twenty minutes.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Cousin Oren',
        text: 'Your sock has no authority here.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Sibling Mara',
        text: 'It is wool and deeply independent.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Cousin Oren',
        text: 'Mine has waited alone since breakfast.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Aunt Vessa',
        text: 'That loneliness is extremely convincing.',
        action: 'ENTER',
      },
      {
        speaker: 'Sibling Mara',
        text: 'Can two unmatched socks form a coalition?',
        action: 'PAUSE',
      },
      {
        speaker: 'Cousin Oren',
        text: 'Only after they refuse the same sandal.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Sibling Mara',
        text: 'Then the dryer key awaits negotiations.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The most convincing unmatched sock grants a temporary household veto.',
    endingBeat:
      'Mara places both socks beside one sandal while Aunt Vessa locks the dryer key inside the coalition tin.',
  },
  {
    channelNumber: 9_661_204_880,
    channelName: 'Thermal Sincerity Shopping',
    programmeTitle: 'Genuine Warmth, Sold Separately',
    format: 'shopping',
    realityId: 'HEAT-RETAIL-70',
    visualStyle: 'thermal_camera_product_hour',
    visualMedium: 'thermal_camera',
    castArchetype: 'mixed',
    pacing: 'frantic',
    storyMode: 'product_consequence',
    premise:
      'In a thermal-camera shopping studio, host Varo wants customer Nemi to buy a sincerity product, but Nemi refuses because every agreement makes the demonstration package visibly warmer.',
    tone: ['bright', 'competitive', 'revealing'],
    dialogue: [
      {
        speaker: 'Host Varo',
        text: 'One drop reveals completely genuine agreement.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Nemi',
        text: 'I do not agree with that claim.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Demonstration Package',
        text: 'Temperature unchanged. Excellent resistance.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Host Varo',
        text: 'You agree resistance is valuable.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Customer Nemi',
        text: 'Only during a refund discussion.',
        action: 'PAUSE',
      },
      {
        speaker: 'Demonstration Package',
        text: 'Agreement detected. Warming one degree.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Nemi',
        text: 'That was a condition, not enthusiasm.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Host Varo',
        text: 'Your distinction sounds genuinely persuasive.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Demonstration Package',
        text: 'Further agreement detected. Comfortably warm.',
        action: 'REACTION_SHOCKED',
      },
      {
        speaker: 'Customer Nemi',
        text: 'Fine. I disagree with the receipt.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Sincerity products warm visibly whenever a nearby customer agrees.',
    endingBeat:
      'The package glows warmly beside a cold receipt while Varo records the sale as a documented disagreement.',
  },
  {
    channelNumber: 8_114_337_295,
    channelName: 'Miniature Room Improvements',
    programmeTitle: 'Four Corners for the Price of Three',
    format: 'advert',
    realityId: 'MODEL-ROOM-14',
    visualStyle: 'miniature_diorama_corner_showroom',
    visualMedium: 'miniature_diorama',
    castArchetype: 'humanoid',
    pacing: 'staccato',
    storyMode: 'product_consequence',
    premise:
      'At a miniature showroom advert, installer Fen wants to sell customer Evi a temporary-corner package, but Evi refuses because its refund service requires the room to remain politely round.',
    tone: ['bright', 'architectural', 'awkward'],
    dialogue: [
      {
        speaker: 'Installer Fen',
        text: 'Add one tasteful corner for important conversations.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Evi',
        text: 'This room already has four.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Installer Fen',
        text: 'Those are permanent and emotionally unavailable.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Customer Evi',
        text: 'Can I return the temporary one?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Installer Fen',
        text: 'Certainly, once the room becomes politely round.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Evi',
        text: 'Rooms cannot be polite.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Installer Fen',
        text: 'Then this corner may improve its manners.',
        action: 'PAUSE',
      },
      {
        speaker: 'Customer Evi',
        text: 'Install it beside the refund desk.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Temporary corners are refundable only from rooms certified politely round.',
    endingBeat:
      'Fen installs the spare corner behind the refund desk and gives the existing walls a customer-service questionnaire.',
  },
  {
    channelNumber: 6_774_203_118,
    channelName: 'Civic Conversation Appeals',
    programmeTitle: 'The Borrowed Pause Appeal',
    format: 'public_access',
    realityId: 'DRAWN-PAUSE-47',
    visualStyle: 'hand_drawn_community_hearing',
    visualMedium: 'hand_drawn',
    castArchetype: 'paper_puppets',
    pacing: 'slow_burn',
    storyMode: 'semantic_contract',
    premise:
      'At a community appeals desk, resident Toma wants a conversation fine cancelled, but clerk Senn refuses because the spoken word wait renews every borrowed pause in the transcript.',
    tone: ['quiet', 'earnest', 'linguistic'],
    dialogue: [
      {
        speaker: 'Resident Toma',
        text: 'I returned every pause before noon.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clerk Senn',
        text: 'Your transcript still contains seven.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Resident Toma',
        text: 'Wait, those belong to the interviewer.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Clerk Senn',
        text: 'Thank you. All seven are renewed.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Resident Toma',
        text: 'I withdraw that particular word.',
        action: 'PAUSE',
      },
      {
        speaker: 'Clerk Senn',
        text: 'Withdrawal requires a pause you currently owe.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Saying wait renews every borrowed pause recorded in a civic transcript.',
    endingBeat:
      'Senn stamps the silent gap after Toma’s final sentence and adds it to the outstanding balance.',
  },
  {
    channelNumber: 9_003_556_412,
    channelName: 'Household Equipment Notice',
    programmeTitle: 'Supervisory Umbrella Notice',
    format: 'emergency',
    realityId: 'VECTOR-RAIN-56',
    visualStyle: 'flat_vector_household_advisory',
    visualMedium: 'corporate_vector',
    castArchetype: 'geometric_aliens',
    pacing: 'interrupted',
    storyMode: 'service_mismatch',
    premise:
      'During a household emergency service notice, official Daro wants resident Pevi to close an umbrella indoors, but Pevi refuses because its equipment promotion now requires a formal supervisor greeting.',
    tone: ['calm', 'domestic', 'official'],
    dialogue: [
      {
        speaker: 'Official Daro',
        text: 'Please close the promoted umbrella indoors.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Resident Pevi',
        text: 'It has not acknowledged my greeting.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Official Daro',
        text: 'Use its complete supervisory title.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Resident Pevi',
        text: 'Good evening, Acting Manager of Rain.',
        action: 'PAUSE',
      },
      {
        speaker: 'Umbrella Supervisor',
        text: 'Greeting accepted. Indoor weather remains open.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Official Daro',
        text: 'Fine. Please supervise the hallway responsibly.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Promoted household equipment requires a formal greeting before accepting instructions.',
    endingBeat:
      'Daro pins a tiny management badge to the open umbrella while Pevi submits an indoor-weather leave request.',
  },
  {
    channelNumber: 8_552_110_947,
    channelName: 'Cut-and-Paste Results',
    programmeTitle: 'The Trophy Changes Sides',
    format: 'news',
    realityId: 'COLLAGE-SPORT-81',
    visualStyle: 'torn_paper_results_bulletin',
    visualMedium: 'collage_zine',
    castArchetype: 'talking_objects',
    pacing: 'conversational',
    storyMode: 'status_transfer',
    premise:
      'At a collage sports-news desk, anchor Lio wants to announce the winner, but coach Mera refuses because team credit transfers whenever the trophy files a membership request.',
    tone: ['serious', 'competitive', 'papery'],
    dialogue: [
      {
        speaker: 'Anchor Lio',
        text: 'The blue team has won by three.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Coach Mera',
        text: 'The trophy joined red during the break.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Trophy',
        text: 'Their membership form offered better shelf space.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Anchor Lio',
        text: 'Results belong to the players.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Trophy',
        text: 'Then why am I carrying the victory?',
        action: 'POINT_AT',
      },
      {
        speaker: 'Coach Mera',
        text: 'Blue may apply to borrow it.',
        action: 'PAUSE',
      },
      {
        speaker: 'Anchor Lio',
        text: 'Tonight, the winner is administrative.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Team credit follows a trophy’s accepted membership request.',
    endingBeat:
      'The trophy pins a red membership strip across its blue engraving while Lio updates only the ownership column.',
  },
].map((draft) => generatedSegmentDraftSchema.parse(draft));

async function existingProgrammeTitles(): Promise<Set<string>> {
  const titles = new Set<string>();
  for (const bucket of ['pending', 'completed']) {
    const directory = path.join(queueRoot, bucket);
    try {
      for (const fileName of await readdir(directory)) {
        if (!/^draft_[a-z0-9]+\.json$/u.test(fileName)) {
          continue;
        }
        try {
          const prepared = preparedScriptSchema.parse(
            JSON.parse(await readFile(path.join(directory, fileName), 'utf8')),
          );
          titles.add(prepared.draft.programmeTitle.toLowerCase());
        } catch {
          // A corrupt draft never suppresses a valid curated seed.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return titles;
}

async function existingCreativeHistory(): Promise<CreativeRecord[]> {
  const history: CreativeRecord[] = [];
  try {
    const manifest = playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(segmentsRoot, 'manifest.json'), 'utf8')),
    );
    for (const entry of manifest.segments) {
      try {
        const segment = segmentPackageSchema.parse(
          JSON.parse(await readFile(path.join(segmentsRoot, entry.packagePath), 'utf8')),
        );
        history.push(recordFromSegment(segment));
      } catch {
        // A missing legacy package does not prevent safe curated seeding.
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  for (const bucket of ['pending', 'completed']) {
    const directory = path.join(queueRoot, bucket);
    try {
      for (const fileName of await readdir(directory)) {
        if (!/^draft_[a-z0-9]+\.json$/u.test(fileName)) {
          continue;
        }
        try {
          const prepared = preparedScriptSchema.parse(
            JSON.parse(await readFile(path.join(directory, fileName), 'utf8')),
          );
          history.push(recordFromDraft(prepared.draft));
        } catch {
          // A corrupt queued draft is excluded from creative history.
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return history;
}

const pendingRoot = path.join(queueRoot, 'pending');
await mkdir(pendingRoot, { recursive: true });
const existingTitles = await existingProgrammeTitles();
const creativeHistory = await existingCreativeHistory();
let added = 0;
for (const draft of curatedDrafts) {
  if (existingTitles.has(draft.programmeTitle.toLowerCase())) {
    continue;
  }
  assertPreviewSafe(draft);
  const issues = [
    ...proposalQualityIssues(draft),
    ...critiquePremise(draft).reasons,
    ...noveltyIssues(draft, creativeHistory),
  ];
  if (issues.length > 0) {
    throw new Error(`${draft.programmeTitle} failed editorial gates: ${issues.join('; ')}`);
  }
  const draftId = `draft_${randomUUID().replaceAll('-', '')}`;
  const prepared = preparedScriptSchema.parse({
    schemaVersion: 1,
    draftId,
    preparedAt: new Date().toISOString(),
    generator: 'curated-launch-pack',
    model: 'human-directed-editorial',
    draft,
  });
  await writeFile(
    path.join(pendingRoot, `${draftId}.json`),
    `${JSON.stringify(prepared, null, 2)}\n`,
    'utf8',
  );
  existingTitles.add(draft.programmeTitle.toLowerCase());
  creativeHistory.push(recordFromDraft(draft));
  added += 1;
}

process.stdout.write(
  `${JSON.stringify({
    queueRoot,
    curatedDrafts: curatedDrafts.length,
    added,
    skipped: curatedDrafts.length - added,
  })}\n`,
);
