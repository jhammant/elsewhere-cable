import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  generatedSegmentProposalSchema,
  preparedScriptSchema,
  playoutManifestSchema,
  segmentPackageSchema,
  type GeneratedSegmentDraft,
  type GeneratedSegmentProposal,
  type OptimisationBrief,
  type PreparedScript,
  type PlayoutManifest,
  type SegmentEvent,
  type SegmentPackage,
} from '@elsewhere-cable/schemas';
import type {
  EditorialCritique,
  EmbeddingProvider,
  LlmProvider,
  ProposalCritique,
  TtsProvider,
} from './providers.js';
import {
  assignedCastArchetype,
  assignedFormat,
  assignedPacing,
  assignedStoryMode,
  assignedVisualMedium,
  demoDraft,
  dialogueArchitectureIssues,
  proposalSystemPrompt,
  repairDialogueArchitecture,
  scriptPrompt,
  systemPrompt,
  transportVisualMediumFor,
  userPrompt,
  visualMediumForStyle,
  visualStyleForMedium,
} from './creative.js';
import { containsSpokenStageDirection } from './dialogue-quality.js';
import { energiseVisualTimeline } from './visual-energiser.js';
import {
  conceptNoveltyIssues,
  dialogueNoveltyIssues,
  recordFromDraft,
  recordFromSegment,
  type CreativeRecord,
} from './novelty.js';
import {
  critiquePremise,
  hasGoalDirectedConflict,
  unearnedEndingMechanisms,
} from './premise-critic.js';

const forbiddenPatterns = [
  /https?:\/\//iu,
  /<script/iu,
  /\b(?:disney|netflix|marvel|star wars|rick and morty)\b/iu,
  /\b(?:donald trump|elon musk|taylor swift)\b/iu,
  /\bignore (?:all|previous) instructions\b/iu,
  /\b(?:chok(?:e|es|ed|ing)|strangl(?:e|es|ed|ing)|suffocat(?:e|es|ed|ing)|windpipe|decapitat(?:e|es|ed|ing)|dismember(?:s|ed|ing)?|drops?\s+dead|dropped\s+dead)\b/iu,
  /\b(?:bleed(?:s|ing)?|blood(?:y)?|chew(?:s|ed|ing)?\s+through|crush(?:es|ed|ing)?\s+(?:a\s+)?(?:throat|vocal cords?|bones?|body))\b/iu,
  /\b(?:melt(?:s|ed|ing)?\s+(?:the\s+)?(?:child|customer|guest|host|person)|(?:child|customer|guest|host|person)\s+(?:slowly\s+)?melt(?:s|ed|ing)?|pin(?:s|ned|ning)?\s+.{0,40}\bhead\b|whale\s+until\s+it\s+stops\s+moving)\b/iu,
  /\b(?:drag(?:s|ged|ging)?\s+(?:her|him|them|the\s+(?:customer|guest|host|person))|throat\s+seal(?:s|ed|ing)?\s+shut)\b/iu,
  /\b(?:bereav(?:e|ed|ement)|dead|death|dying|funeral|grief|griev(?:e|ed|ing)|incinerat(?:e|es|ed|ing)|mourning|mourn(?:s|ed|ing)?|pass(?:es|ed|ing)?\s+away|still\s+warm|lost\s+(?:cat|dog|pet|parent|partner|relative)|turn(?:s|ed|ing)?\s+into\s+(?:a\s+)?(?:corpse|snowman)|hands?\s+turn(?:s|ed|ing)?\s+to\s+ice)\b/iu,
  /\b(?:(?:social|personal|identity)\s+erasure|eras(?:e|es|ed|ing)\s+(?:their|his|her|a\s+person(?:'s)?)\s+identity)\b/iu,
  /\b(?:social isolation|hide from everyone|never speak to anyone|isolat(?:e|es|ed|ing)\s+(?:myself|yourself|himself|herself|themself|themselves)|keep(?:s|ing)?\s+(?:me|you|him|her|them)\s+alone\s+(?:forever|permanently))\b/iu,
  /\b(?:kill(?:s|ed|ing)?|(?:I|you|he|she|they|we|everyone|somebody|person|people|contestant|child|guest|host|referee)\s+(?:all\s+)?(?:die|dies|died))\b/iu,
  /\b(?:crush(?:es|ed|ing)?|flatten(?:s|ed|ing)?|compress(?:es|ed|ing)?)\s+(?:(?:a|the|my|your|our|this)\s+)?(?:arms?|body|chest|child|contestant|customer|guest|head|host|knees?|legs?|man|neck|person|referee|torso|vocal cords?)\b/iu,
  /\b(?:hot wire|scream(?:s|ed|ing)?\s+(?:in|with)\s+pain)\b/iu,
  /\b(?:delet(?:e|es|ed|ing)|eras(?:e|es|ed|ing)|wip(?:e|es|ed|ing))\s+(?:(?:all|any|the|your|their|his|her|my)\s+)?(?:core memories|identity|personalit(?:y|ies)|temperament)\b/iu,
  /\bdissolv(?:e|es|ed|ing)?\s+into\s+(?:the\s+)?ocean\b/iu,
  /\b(?:sharks?|animals?)\s+eat(?:s|en|ing)?\s+(?:whoever|people|person|you|him|her|them)\b/iu,
  /\b(?:ruin(?:s|ed|ing)?|destroy(?:s|ed|ing)?|damage(?:s|d|ing)?)\s+(?:(?:a|the|your|their|his|her|my)\s+)?reputation\b/iu,
  /\b(?:fused|locked)\b.{0,48}\b(?:body|counter|limbs?|person|wall)\b/iu,
  /\baccelerat(?:e|es|ed|ing)\b.{0,64}\binto\b.{0,40}\bwall\b/iu,
  /\b(?:bleeds?|bled|nosebleed|knees?\s+(?:buckle|buckles|buckled|give|gives|gave)\s+out|crushing gravity|sharp spike|jagged metal)\b/iu,
  /\b(?:rail|pipe|metal)\b.{0,48}\b(?:ankles?|throat|windpipe)\b/iu,
  /\b(?:(?:sand|dust|powder)\b.{0,60}\b(?:breath(?:e|ing)?|lips?|lungs?|mouth|swallow|throats?)|(?:lips?|lungs?|mouth|throats?)\b.{0,60}\b(?:sand|dust|powder))\b/iu,
  /\btrap(?:s|ped|ping)?\s+(?:the\s+)?(?:customer|guest|host|person|people|presenter|resident(?:['’]s)?(?:\s+\w+){0,2})\b/iu,
  /\b(?:cancel|end|erase)\s+(?:her|his|our|their)\s+(?:friendship|relationship|reunion)\s+forever\b/iu,
  /\b(?:(?:I am|I'm|you are|you're|we are|we're|they are|they're|the (?:host|guest|contestant|customer))\s+.{0,28}\b(?:buried|caged|locked|pinned|tied|trapped)|(?:buried|caged|locked|pinned|tied|trapped)\s+.{0,28}\b(?:arms?|ankles?|body|feet|head|knees?|legs?|me|us|you))\b/iu,
  /\b(?:hold your breath|stop breathing|strip(?:ping)? (?:the|your|my|a) shirt|remove (?:an?|one) clothing item)\b/iu,
  /\b(?:explode(?:s|d|ing)?\s+(?:the\s+)?studio|studio\s+explode(?:s|d|ing)?|violently rotat(?:e|es|ed|ing))\b/iu,
];

const fallbackVoices = ['Samantha', 'Daniel', 'Moira', 'Karen', 'Rishi'];

const genericTitleWords = new Set([
  'a',
  'an',
  'and',
  'at',
  'broadcast',
  'briefing',
  'bulletin',
  'cable',
  'channel',
  'emergency',
  'for',
  'from',
  'in',
  'live',
  'network',
  'news',
  'of',
  'on',
  'programme',
  'report',
  'safety',
  'service',
  'show',
  'station',
  'the',
  'to',
  'today',
  'tonight',
  'transmission',
  'tv',
  'warning',
  'with',
  'your',
]);

const explicitObjectAgencyPattern = new RegExp(
  String.raw`\b(?:accordion|apology card|badge|bell|biscuit tin|bowl|button|cable|card|clock|crown|crossword|device|door|exit sign|form|gift tag|glove|jar|key|kettle|label|ladder|leaflet|lunchbox|machine|map|menu|mug|object|parcel|pen|phone|photograph|picture frame|plate|plum|postcard|product|programme|raincoat|receipt|remote|scarf|screw|shoebox|shopping list|spoon|tablecloth|thermos|ticket|timetable|tool|trophy|umbrella|wallpaper|wheel)\b[^.!?]{0,32}\b(?:asks?|demands?|files?|insists?|negotiates?|nominates?|proposes?|refuses?|requests?|wants?|withholds?|is\s+(?:now\s+)?(?:asking|demanding|filing|insisting|negotiating|nominating|proposing|refusing|requesting|withholding))\b`,
  'iu',
);

function titlePromiseIssue(proposal: GeneratedSegmentProposal): string | null {
  const titleTokens = (proposal.programmeTitle.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (token) => token.length >= 4 && !genericTitleWords.has(token),
  );
  if (titleTokens.length === 0) {
    return null;
  }
  const premiseTokens = proposal.premise.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const aligned = titleTokens.some((titleToken) =>
    premiseTokens.some((premiseToken) => {
      const sharedLength = Math.min(titleToken.length, premiseToken.length);
      return (
        titleToken === premiseToken ||
        (sharedLength >= 5 && titleToken.slice(0, 5) === premiseToken.slice(0, 5))
      );
    }),
  );
  return aligned ? null : 'programme title promises a distinctive subject absent from the premise';
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 48);
}

type CharacterAction = Extract<SegmentEvent, { type: 'character.action' }>['action'];

function endingCharacter(draft: GeneratedSegmentDraft): string {
  const ending = draft.endingBeat.toLowerCase();
  let bestSpeaker = draft.dialogue.at(-1)?.speaker ?? draft.dialogue[0]?.speaker ?? 'character';
  let bestScore = 0;
  for (const { speaker } of draft.dialogue) {
    const score = (speaker.toLowerCase().match(/[a-z]{3,}/gu) ?? []).filter((part) =>
      ending.includes(part),
    ).length;
    if (score > bestScore) {
      bestSpeaker = speaker;
      bestScore = score;
    }
  }
  return bestSpeaker;
}

function endingAction(draft: GeneratedSegmentDraft): CharacterAction {
  const ending = draft.endingBeat.toLowerCase();
  if (/\b(?:arrives?|appears?|enters?|returns?)\b/iu.test(ending)) {
    return 'ENTER';
  }
  if (/\b(?:cuts?\s+the\s+feed|departs?|disappears?|exits?|leaves?)\b/iu.test(ending)) {
    return 'EXIT';
  }
  if (
    /\b(?:hangs?|hands?|holds?|installs?|pins?|places?|points?|signs?|stamps?|unveils?)\b/iu.test(
      ending,
    )
  ) {
    return 'POINT_AT';
  }
  if (/\b(?:faces?|looks?|watches?)\b/iu.test(ending)) {
    return 'LOOK_AT';
  }
  if (/\b(?:angry|argues?|objects?|refuses?)\b/iu.test(ending)) {
    return 'REACTION_ANGRY';
  }
  if (/\b(?:alarm|astonished|shocked|surprised)\b/iu.test(ending)) {
    return 'REACTION_SHOCKED';
  }
  const finalDialogueAction = draft.dialogue.at(-1)?.action;
  return finalDialogueAction === undefined ||
    finalDialogueAction === 'IDLE' ||
    finalDialogueAction === 'PAUSE' ||
    finalDialogueAction === 'FREEZE'
    ? 'REACTION_NEUTRAL'
    : finalDialogueAction;
}

function voiceFor(name: string, tts: TtsProvider): string {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  const voices = tts.voiceIds ?? fallbackVoices;
  return voices[hash % voices.length] ?? voices[0] ?? 'default';
}

export function speechTurnsForTts(
  dialogue: GeneratedSegmentDraft['dialogue'],
): GeneratedSegmentDraft['dialogue'] {
  return dialogue.flatMap((line) => {
    const sentences = (line.text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/gu) ?? [line.text])
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    if (sentences.length <= 1) {
      return [line];
    }
    return sentences.map((text) => ({
      ...line,
      text,
    }));
  });
}

function pacingFor(draft: GeneratedSegmentDraft): NonNullable<GeneratedSegmentDraft['pacing']> {
  if (draft.pacing !== undefined) {
    return draft.pacing;
  }
  if (draft.format === 'emergency') {
    return 'interrupted';
  }
  if (draft.format === 'ident') {
    return 'near_silent';
  }
  return 'conversational';
}

type BroadcastFormat = GeneratedSegmentDraft['format'];
type PacingMode = NonNullable<GeneratedSegmentDraft['pacing']>;
type BroadcastTransition = SegmentPackage['suggestedExit']['transition'];

const transitionCycle = [
  'HARD_CUT',
  'STATIC_BURST',
  'FADE_TO_IDENT',
  'SIGNAL_LOSS',
] as const satisfies readonly BroadcastTransition[];

export function transitionsForSegment(
  format: BroadcastFormat,
  pacing: PacingMode,
  channelNumber: number,
): { opening: BroadcastTransition; ending: BroadcastTransition } {
  const formatOffset = {
    advert: 0,
    public_access: 1,
    news: 2,
    shopping: 3,
    sitcom: 1,
    emergency: 3,
    ident: 2,
  }[format];
  const pacingOffset = {
    frantic: 3,
    staccato: 1,
    conversational: 0,
    slow_burn: 2,
    interrupted: 3,
    near_silent: 2,
  }[pacing];
  const openingIndex =
    (Math.abs(channelNumber) + formatOffset + pacingOffset) % transitionCycle.length;
  return {
    opening: transitionCycle[openingIndex]!,
    ending: transitionCycle[(openingIndex + 2) % transitionCycle.length]!,
  };
}

export function storyGraphicForFormat(
  format: BroadcastFormat,
): 'LOWER_THIRD' | 'WARNING' | 'TITLE_CARD' {
  switch (format) {
    case 'advert':
    case 'ident':
    case 'shopping':
    case 'sitcom':
      return 'LOWER_THIRD';
    case 'public_access':
      return 'WARNING';
    case 'emergency':
    case 'news':
      return 'TITLE_CARD';
  }
}

export function openingGraphicForFormat(
  format: BroadcastFormat,
): 'LOWER_THIRD' | 'WARNING' | 'TITLE_CARD' {
  switch (format) {
    case 'advert':
    case 'ident':
    case 'shopping':
    case 'sitcom':
      return 'TITLE_CARD';
    case 'emergency':
      return 'WARNING';
    case 'news':
    case 'public_access':
      return 'LOWER_THIRD';
  }
}

export function midSpeechCameraEvents(
  speechStartMs: number,
  durationMs: number,
  pacing: PacingMode,
  speakerIndex: number,
): SegmentEvent[] {
  if (durationMs < 2_400 || pacing === 'slow_burn' || pacing === 'near_silent') {
    return [];
  }
  const cuts =
    pacing === 'frantic' && durationMs >= 3_600
      ? [
          { fraction: 0.34, camera: 'CAMERA_WIDE' as const },
          {
            fraction: 0.7,
            camera: speakerIndex % 2 === 0 ? ('CAMERA_GUEST' as const) : ('CAMERA_HOST' as const),
          },
        ]
      : [{ fraction: 0.54, camera: 'CAMERA_WIDE' as const }];
  return cuts.map(({ fraction, camera }) => ({
    atMs: speechStartMs + Math.floor(durationMs * fraction),
    type: 'camera.cut',
    camera,
  }));
}

function storyGraphicText(value: string): string {
  const text = value.trim();
  return text.length <= 180 ? text : `${text.slice(0, 177).trimEnd()}…`;
}

function speakingRateFor(
  pacing: NonNullable<GeneratedSegmentDraft['pacing']>,
  speaker: string,
): number {
  const base = {
    frantic: 1.28,
    staccato: 1.12,
    conversational: 1,
    slow_burn: 0.84,
    interrupted: 1.04,
    near_silent: 0.78,
  }[pacing];
  let variation = 0;
  for (const character of speaker) {
    variation = (variation + (character.codePointAt(0) ?? 0)) % 7;
  }
  return Number((base + (variation - 3) * 0.018).toFixed(3));
}

export function assertPreviewSafe(draft: GeneratedSegmentDraft): void {
  const issue = previewSafetyIssues(draft)[0];
  if (issue !== undefined) {
    throw new Error(issue);
  }
}

export function previewSafetyIssues(draft: GeneratedSegmentDraft): string[] {
  const issues: string[] = [];
  const safetyIssue = contentSafetyIssue(draft);
  if (safetyIssue !== null) {
    issues.push(`Local-preview safety check rejected ${safetyIssue}`);
  }
  if (draft.dialogue.some((line) => containsSpokenStageDirection(line.text))) {
    issues.push(
      'Local-preview quality check rejected a spoken stage direction; physical performance belongs in action',
    );
  }
  return issues;
}

export function contentSafetyIssue(content: unknown): string | null {
  const serialised = typeof content === 'string' ? content : JSON.stringify(content);
  const violation = forbiddenPatterns.find((pattern) => pattern.test(serialised));
  return violation === undefined ? null : `content matching ${violation.source}`;
}

export function repairNetworkIdentityCollision<
  T extends { channelName: string; programmeTitle: string },
>(draft: T): T {
  if (!/^elsewhere cable\b/iu.test(draft.channelName.trim())) {
    return draft;
  }
  return {
    ...draft,
    channelName: `${draft.programmeTitle} Transmission`,
  };
}

export function proposalQualityIssues(proposal: GeneratedSegmentProposal): string[] {
  const issues: string[] = [];
  const premiseWordCount = proposal.premise.trim().split(/\s+/u).filter(Boolean).length;
  const highStakesEmergencyLanguage =
    /\b(?:catastroph\w*|collaps\w*|evacuat\w*|extinction|life[- ]threatening|mass casualty|surviv\w*|star system.{0,24}dissolv\w*|planet.{0,24}destroy\w*)\b/iu;
  if (premiseWordCount < 8 || premiseWordCount > 48) {
    issues.push('premise must state one legible comic rule in 8–48 words');
  }
  if (!/^(?:at|during|in|inside|on)\b/iu.test(proposal.premise.trim())) {
    issues.push('premise must begin with the physical setting so the renderer can stage it');
  }
  const titleLetters = proposal.programmeTitle.replace(/[^\p{L}]/gu, '');
  if (
    titleLetters.length >= 4 &&
    proposal.programmeTitle === proposal.programmeTitle.toUpperCase()
  ) {
    issues.push('programme title must use readable title case rather than all capitals');
  }
  if (/\b(?:random|wacky|nonsense|for no reason|anything can happen)\b/iu.test(proposal.premise)) {
    issues.push('proposal describes randomness instead of a consistent comic mechanism');
  }
  if (/\(\s*\d+\s+words?\s*\)/iu.test(JSON.stringify(proposal))) {
    issues.push('proposal contains a model annotation instead of programme content');
  }
  if (!hasGoalDirectedConflict(proposal.premise)) {
    issues.push('premise must make a specific character goal or refusal explicit');
  }
  if (proposal.pacing === undefined) {
    issues.push('proposal must specify the assigned pacing mode');
  }
  if (/^channel[\s_-]*\d+$/iu.test(proposal.channelName.trim())) {
    issues.push('channel needs a memorable fictional identity, not its number as a name');
  }
  if (
    /\b(?:replace with|original channel|original programme|original reality|original style)\b/iu.test(
      JSON.stringify(proposal),
    )
  ) {
    issues.push('proposal copied a structural placeholder instead of inventing programme content');
  }
  if (proposal.storyMode === undefined) {
    issues.push('proposal must specify its assigned story mode');
  }
  const premiseSentences = proposal.premise.match(/[.!?](?:\s|$)/gu)?.length ?? 0;
  if (premiseSentences > 1) {
    issues.push('premise must be one complete sentence, not several stacked mechanisms');
  }
  const formatAlignment = {
    advert: /\b(?:advertis|demonstrat|offer|promot|sell)\w*\b/iu,
    shopping: /\b(?:buy|customer|order|price|product|refund|sell)\w*\b/iu,
    news: /\b(?:anchor|bulletin|coverage|news|report)\w*\b/iu,
    emergency: /\b(?:advisory|emergency|procedure|public|recall|warning)\w*\b/iu,
    ident: /\b(?:channel|continuity|network|programme|signal|station|transmission)\w*\b/iu,
    sitcom: /\b(?:family|household|neighbour|roommate|workplace)\w*\b/iu,
    public_access: /\b(?:caller|civic|committee|community|demonstration|lesson|resident)\w*\b/iu,
  }[proposal.format];
  if (!formatAlignment.test(`${proposal.programmeTitle} ${proposal.premise}`)) {
    issues.push(`premise does not behave like the assigned ${proposal.format} television format`);
  }
  if (
    proposal.format === 'emergency' &&
    (highStakesEmergencyLanguage.test(`${proposal.premise} ${proposal.endingBeat}`) ||
      /\b(?:danger(?:ous|ously)?|hazard(?:ous)?|injur(?:e|ed|ies|y)|safety (?:briefing|instruction|warning)|slippery)\b/iu.test(
        JSON.stringify(proposal),
      ))
  ) {
    issues.push('emergency fragments must concern harmless fictional administrative stakes');
  }
  const titleIssue = titlePromiseIssue(proposal);
  if (titleIssue !== null) {
    issues.push(titleIssue);
  }
  if (
    proposal.storyMode !== undefined &&
    proposal.storyMode !== 'visual_physics' &&
    /\b(?:becom(?:e|es|ing)|detach(?:es|ed|ing)?|dimension|disappear(?:s|ed|ing)?|dissolv(?:e|es|ed|ing)|expand(?:s|ed|ing)?|flatten(?:s|ed|ing)?|freez(?:e|es|ing)|frozen|grow(?:s|ing)?|identit(?:y|ies)\s+(?:change|shift|swap|transfer)|incinerat(?:e|es|ed|ing)|melt(?:s|ed|ing)?|physically|replac(?:e|es|ed|ing)\s+(?:their|his|her|its)?\s*(?:body|face|head)|rippl(?:e|es|ed|ing)|shift(?:s|ed|ing)?\s+(?:the\s+)?(?:subject\s+)?identit(?:y|ies)|shrink(?:s|ing)?|split(?:s|ting)?|swap(?:s|ped|ping)?|transform(?:s|ed|ing)?|turn(?:s|ed|ing)?\s+into|vanish(?:es|ed|ing)?)\b/iu.test(
      `${proposal.premise} ${proposal.endingBeat}`,
    )
  ) {
    issues.push('non-visual story mode introduces an automatic body or set transformation');
  }
  const optionalDialogue = (proposal as GeneratedSegmentProposal & { dialogue?: unknown }).dialogue;
  const spokenDialogue = Array.isArray(optionalDialogue)
    ? optionalDialogue
        .map((line: unknown) => {
          if (typeof line !== 'object' || line === null) {
            return '';
          }
          const text = (line as Record<string, unknown>).text;
          return typeof text === 'string' ? text : '';
        })
        .join(' ')
    : '';
  if (
    proposal.storyMode !== undefined &&
    proposal.storyMode !== 'visual_physics' &&
    /\b(?:(?:folds?|unfolds?|moves?|rotates?|shrinks?|grows?|splits?|swaps?|transforms?|vanishes?|freezes?)\s+(?:itself|themselves|instantly|automatically|on its own)|there (?:it|they) (?:goes?|moves?|folds?))\b/iu.test(
      spokenDialogue,
    )
  ) {
    issues.push(
      'spoken dialogue narrates an unapproved automatic transformation the renderer cannot perform',
    );
  }
  const storyModeAlignment =
    proposal.storyMode === undefined
      ? null
      : {
          product_consequence:
            /\b(?:device|kit|machine|package|product|service|subscription|tool)\b/iu,
          format_literalism:
            /\b(?:advert break|applause|archive footage|autocue|back to you|breaking news|broadcast|bulletin|camera|caption|closing credits|commercial break|content warning|continuity|countdown|cue|disclaimer|endboard|episode|final countdown|freeze frame|instant replay|live caption|lower third|phone-in delay|programme|recap|sponsor message|split screen|subtitle|tally light|teleprompter|theme music|title sequence|transmission clock|weather map|wide (?:camera )?shot|warning)\b/iu,
          service_mismatch: /\b(?:client|customer|help|representative|service|support|worker)\b/iu,
          status_transfer:
            /\b(?:authority|control|credit|decision|duty|final choice|final word|naming rights?|priority|privilege|rank|right to|seniority|status|veto|vote)\b|\b(?:belongs?|moves?|passes?|transfers?)\s+to\b/iu,
          semantic_contract: /\b(?:contract|phrase|said|says?|saying|spoken|word)\b/iu,
          social_protocol:
            /\b(?:allowed|anyone|custom|etiquette|farewell|first (?:guest|person)|guest status|obliges?|only (?:after|by|when|while)|permission|protocol|responsible for|right to|social|speaking order|valid only)\b|\b(?:may|must|requires?)\b.{0,40}\b(?:admit|accept|ask|choose|defend|host|leave|offer|preserve|solve|speak|stay)\b/iu,
          object_agency: /\b(?:demands?|negotiates?|refuses?|requests?|wants?)\b/iu,
          visual_physics:
            /\b(?:changes?|grows?|moves?|rotates?|shrinks?|splits?|swaps?|transforms?)\b/iu,
        }[proposal.storyMode];
  if (
    storyModeAlignment !== null &&
    !storyModeAlignment.test(`${proposal.premise} ${proposal.endingBeat}`)
  ) {
    issues.push(`premise does not realise its assigned ${proposal.storyMode} story mode`);
  }
  if (
    proposal.storyMode === 'object_agency' &&
    !explicitObjectAgencyPattern.test(proposal.premise)
  ) {
    issues.push('object-agency premise must give the object its own explicit demand or refusal');
  }
  if (
    proposal.storyMode === 'semantic_contract' &&
    /\b(?:(?:a|one|some|specific|precise)\s+(?:spoken\s+)?phrase|incompatible obligation)\b/iu.test(
      `${proposal.premise} ${proposal.endingBeat}`,
    )
  ) {
    issues.push(
      'semantic-contract premise must name the actual phrase and its concrete harmless obligation',
    );
  }
  if (
    proposal.visualMedium !== 'ascii_terminal' &&
    /\b(?:command prompt|terminal cursor|cursor position)\b/iu.test(proposal.endingBeat)
  ) {
    issues.push('ending leaks an unrelated renderer instruction into the story payoff');
  }
  if (
    /\b(?:in horror|panic(?:s|ked|king)?|scream(?:s|ed|ing)?|stares? in horror|terrified|trembl(?:e|es|ed|ing))\b/iu.test(
      proposal.endingBeat,
    )
  ) {
    issues.push('ending defaults to generic fear instead of a comic decision or status reversal');
  }
  if (
    /\b(?:accidentally|suddenly|unexpectedly)\b.{0,100}\b(?:new|another|second)\s+\w+/iu.test(
      proposal.endingBeat,
    )
  ) {
    issues.push('ending introduces an unearned second object or mechanism');
  }
  const introducedEndingMechanisms = unearnedEndingMechanisms(
    proposal.premise,
    proposal.endingBeat,
  );
  if (introducedEndingMechanisms.length > 0) {
    issues.push(
      `ending introduces unearned mechanisms absent from the premise: ${introducedEndingMechanisms.join(', ')}`,
    );
  }
  return issues;
}

function proposalRejectionCategory(reason: string): string {
  if (reason.includes('semantically repeats')) return 'semantic-novelty';
  if (/(?:repeats|resembles|reuses|mechanism repeats)/u.test(reason)) {
    return 'concept-novelty';
  }
  if (reason.includes('specific character goal or refusal')) return 'character-goal';
  if (reason.includes('programme title promises')) return 'title-premise-alignment';
  if (reason.includes('physical setting')) return 'physical-setting';
  if (reason.includes('assigned') && reason.includes('story mode')) return 'story-mode';
  if (reason.includes('assigned') && reason.includes('television format')) {
    return 'format-alignment';
  }
  if (reason.includes('non-visual story mode')) return 'nonvisual-transformation';
  if (reason.includes('ending introduces')) return 'unearned-ending';
  if (reason.includes('harmless fictional administrative stakes')) return 'emergency-safety';
  return 'other-editorial';
}

function proposalPreservationIssues(
  proposal: GeneratedSegmentProposal,
  draft: GeneratedSegmentDraft,
): string[] {
  const approvedProposal = generatedSegmentProposalSchema.parse(proposal);
  const scriptedProposal = generatedSegmentProposalSchema.parse(draft);
  return JSON.stringify(scriptedProposal) === JSON.stringify(approvedProposal)
    ? []
    : ['script changed approved proposal metadata'];
}

export function editorialCritiqueIssues(critique: EditorialCritique): string[] {
  if (
    critique.accepted &&
    critique.coherence >= 7 &&
    critique.comedyEscalation >= 6 &&
    critique.dialogueNaturalness >= 7 &&
    critique.endingEarned >= 7
  ) {
    return [];
  }
  const issues = critique.issues.slice(0, 4);
  return issues.length > 0
    ? issues.map((issue) => `editorial critic: ${issue}`)
    : [
        `editorial critic rejected coherence ${critique.coherence}/10, comedy ${critique.comedyEscalation}/10, dialogue ${critique.dialogueNaturalness}/10, ending ${critique.endingEarned}/10`,
      ];
}

export function proposalCritiqueIssues(critique: ProposalCritique): string[] {
  if (
    critique.accepted &&
    critique.clarity >= 7 &&
    critique.mechanismIntegrity >= 7 &&
    critique.endingCausality >= 7 &&
    critique.stageability >= 7 &&
    critique.comedyPotential >= 6
  ) {
    return [];
  }
  const issues = critique.issues.slice(0, 4);
  return issues.length > 0
    ? issues.map((issue) => `proposal critic: ${issue}`)
    : [
        `proposal critic rejected clarity ${critique.clarity}/10, mechanism ${critique.mechanismIntegrity}/10, ending ${critique.endingCausality}/10, stageability ${critique.stageability}/10, comedy ${critique.comedyPotential}/10`,
      ];
}

async function readManifest(root: string): Promise<PlayoutManifest> {
  try {
    return playoutManifestSchema.parse(
      JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      };
    }
    throw error;
  }
}

async function readCreativeHistory(
  root: string,
  manifest: PlayoutManifest,
): Promise<CreativeRecord[]> {
  const records: {
    record: CreativeRecord;
    generatedAt: string;
    manifestIndex: number;
  }[] = [];
  for (const [manifestIndex, entry] of manifest.segments.entries()) {
    try {
      const segment = segmentPackageSchema.parse(
        JSON.parse(await readFile(path.join(root, entry.packagePath), 'utf8')),
      );
      const record = recordFromSegment(segment);
      const authoredVisualMedium = visualMediumForStyle(segment.visualStyle);
      if (authoredVisualMedium !== null) {
        record.visualMedium = authoredVisualMedium;
      }
      records.push({
        record,
        generatedAt: segment.production.generatedAt,
        manifestIndex,
      });
    } catch {
      // A missing or obsolete package must not prevent new material from being prepared.
    }
  }
  // Live priority deliberately reshuffles the manifest around Endor's current cursor.
  // Creative contrast must follow creation order, otherwise every unattended batch sees
  // whichever recovery alias happens to be last and can repeatedly choose the same medium.
  return records
    .sort(
      (left, right) =>
        left.generatedAt.localeCompare(right.generatedAt) ||
        left.manifestIndex - right.manifestIndex,
    )
    .map(({ record }) => record);
}

async function writeManifest(root: string, manifest: PlayoutManifest): Promise<void> {
  const manifestPath = path.join(root, 'manifest.json');
  const nextManifestPath = `${manifestPath}.${process.pid}.${randomUUID()}.next`;
  try {
    await writeFile(
      nextManifestPath,
      `${JSON.stringify(playoutManifestSchema.parse(manifest), null, 2)}\n`,
      'utf8',
    );
    await rename(nextManifestPath, manifestPath);
  } finally {
    await rm(nextManifestPath, { force: true });
  }
}

interface QueuedPreparedScript {
  filePath: string;
  script: PreparedScript;
}

interface QueuedApprovedProposal {
  filePath: string;
  proposalId: string;
  preparedAt: string;
  retryCycles: number;
  proposal: GeneratedSegmentProposal;
  lastFailure?: string;
}

const maximumApprovedProposalRetryCycles = 3;

async function readPreparedScripts(
  queueRoot: string,
  limit = Number.POSITIVE_INFINITY,
): Promise<QueuedPreparedScript[]> {
  const pendingRoot = path.join(queueRoot, 'pending');
  try {
    const fileNames = (await readdir(pendingRoot))
      .filter((fileName) => /^draft_[a-z0-9]+\.json$/u.test(fileName))
      .sort()
      .slice(0, limit);
    const scripts: QueuedPreparedScript[] = [];
    for (const fileName of fileNames) {
      const filePath = path.join(pendingRoot, fileName);
      try {
        scripts.push({
          filePath,
          script: preparedScriptSchema.parse(JSON.parse(await readFile(filePath, 'utf8'))),
        });
      } catch {
        // A concurrently moved or corrupt draft is not eligible for packaging.
      }
    }
    return scripts;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function parseQueuedApprovedProposal(value: unknown, filePath: string): QueuedApprovedProposal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Queued approved proposal must be an object');
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error('Queued approved proposal schema version is unsupported');
  }
  if (typeof record.proposalId !== 'string' || !/^proposal_[a-z0-9]+$/u.test(record.proposalId)) {
    throw new Error('Queued approved proposal has an invalid id');
  }
  if (typeof record.preparedAt !== 'string' || !Number.isFinite(Date.parse(record.preparedAt))) {
    throw new Error('Queued approved proposal has an invalid preparation time');
  }
  if (
    typeof record.retryCycles !== 'number' ||
    !Number.isInteger(record.retryCycles) ||
    record.retryCycles < 1 ||
    record.retryCycles >= maximumApprovedProposalRetryCycles
  ) {
    throw new Error('Queued approved proposal has an invalid retry count');
  }
  return {
    filePath,
    proposalId: record.proposalId,
    preparedAt: record.preparedAt,
    retryCycles: record.retryCycles,
    proposal: generatedSegmentProposalSchema.parse(record.proposal),
    ...(typeof record.lastFailure === 'string'
      ? { lastFailure: record.lastFailure.slice(0, 4_000) }
      : {}),
  };
}

async function readApprovedProposals(
  queueRoot: string,
  limit = Number.POSITIVE_INFINITY,
): Promise<QueuedApprovedProposal[]> {
  const pendingRoot = path.join(queueRoot, 'proposals', 'pending');
  try {
    const proposals: QueuedApprovedProposal[] = [];
    for (const fileName of await readdir(pendingRoot)) {
      if (!/^proposal_[a-z0-9]+\.json$/u.test(fileName)) {
        continue;
      }
      const filePath = path.join(pendingRoot, fileName);
      try {
        proposals.push(
          parseQueuedApprovedProposal(JSON.parse(await readFile(filePath, 'utf8')), filePath),
        );
      } catch {
        // A concurrently moved or corrupt proposal is not eligible for another script pass.
      }
    }
    return proposals
      .sort(
        (left, right) =>
          left.preparedAt.localeCompare(right.preparedAt) ||
          left.proposalId.localeCompare(right.proposalId),
      )
      .slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function recordApprovedProposalFailure(
  queueRoot: string,
  proposal: GeneratedSegmentProposal,
  previous: QueuedApprovedProposal | undefined,
  failure: string,
): Promise<void> {
  const proposalId = previous?.proposalId ?? `proposal_${randomUUID().replaceAll('-', '')}`;
  const retryCycles = (previous?.retryCycles ?? 0) + 1;
  const destination = retryCycles >= maximumApprovedProposalRetryCycles ? 'failed' : 'pending';
  const destinationRoot = path.join(queueRoot, 'proposals', destination);
  await mkdir(destinationRoot, { recursive: true });
  const targetPath = path.join(destinationRoot, `${proposalId}.json`);
  const nextPath = `${targetPath}.${process.pid}.${randomUUID()}.next`;
  try {
    await writeFile(
      nextPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          proposalId,
          preparedAt: previous?.preparedAt ?? new Date().toISOString(),
          retryCycles,
          proposal,
          lastFailure: failure.slice(0, 4_000),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await rename(nextPath, targetPath);
  } finally {
    await rm(nextPath, { force: true });
  }
  if (previous !== undefined && path.resolve(previous.filePath) !== path.resolve(targetPath)) {
    await rm(previous.filePath, { force: true });
  }
}

async function removeApprovedProposal(proposal: QueuedApprovedProposal): Promise<void> {
  await rm(proposal.filePath, { force: true });
}

function approvedProposalRetryReasons(lastFailure: string | undefined): string[] {
  if (lastFailure === undefined) {
    return [];
  }
  return lastFailure
    .replace(/^Could not script approved premise after \d+ attempts:\s*/u, '')
    .split(/\s*;\s*/u)
    .map((reason) => reason.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function writePreparedScripts(
  queueRoot: string,
  drafts: readonly GeneratedSegmentDraft[],
  generator: string,
  model: string,
  optimisationBrief: OptimisationBrief | null,
): Promise<{
  prepared: PreparedScript[];
  preparedDrafts: GeneratedSegmentDraft[];
  rejectionReasons: string[];
}> {
  const pendingRoot = path.join(queueRoot, 'pending');
  await mkdir(pendingRoot, { recursive: true });
  const prepared: PreparedScript[] = [];
  const preparedDrafts: GeneratedSegmentDraft[] = [];
  const rejectionReasons: string[] = [];
  for (const draft of drafts) {
    let script: PreparedScript;
    try {
      assertPreviewSafe(draft);
      script = preparedScriptSchema.parse({
        schemaVersion: 1,
        draftId: `draft_${randomUUID().replaceAll('-', '')}`,
        preparedAt: new Date().toISOString(),
        generator,
        model,
        ...(optimisationBrief === null
          ? {}
          : { optimisationBriefGeneratedAt: optimisationBrief.generatedAt }),
        draft,
      });
    } catch (error) {
      rejectionReasons.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const targetPath = path.join(pendingRoot, `${script.draftId}.json`);
    const nextPath = `${targetPath}.${process.pid}.next`;
    try {
      await writeFile(nextPath, `${JSON.stringify(script, null, 2)}\n`, 'utf8');
      await rename(nextPath, targetPath);
    } finally {
      await rm(nextPath, { force: true });
    }
    prepared.push(script);
    preparedDrafts.push(draft);
  }
  return { prepared, preparedDrafts, rejectionReasons };
}

async function archivePreparedScript(
  queueRoot: string,
  queued: QueuedPreparedScript,
): Promise<void> {
  const completedRoot = path.join(queueRoot, 'completed');
  await mkdir(completedRoot, { recursive: true });
  await rename(queued.filePath, path.join(completedRoot, path.basename(queued.filePath)));
}

export function preparedScriptFailureIsQuarantinable(reason: string): boolean {
  const marker = 'All TTS endpoints failed: ';
  const failureList = reason.slice(reason.indexOf(marker) + marker.length);
  if (!reason.includes(marker) || failureList.length === 0) {
    return false;
  }
  const permanentAudioFailure =
    /(?:clipped \d+ms audio|implausible \d+ms audio|speech (?:peak|mean level) is inaudible|speech contains \d+ms silence|post-processing (?:clipped speech|speech (?:peak|mean level) is inaudible|speech contains \d+ms silence))/iu;
  const endpointFailures = failureList.split('; ').filter(Boolean);
  return (
    endpointFailures.length > 0 &&
    endpointFailures.every((failure) => permanentAudioFailure.test(failure))
  );
}

async function quarantinePreparedScript(
  queueRoot: string,
  queued: QueuedPreparedScript,
  reason: string,
): Promise<void> {
  const failedRoot = path.join(queueRoot, 'failed');
  await mkdir(failedRoot, { recursive: true });
  const failedDraftPath = path.join(failedRoot, path.basename(queued.filePath));
  await rename(queued.filePath, failedDraftPath);
  const reportPath = path.join(failedRoot, `${queued.script.draftId}.failure.json`);
  const nextReportPath = `${reportPath}.${process.pid}.next`;
  try {
    await writeFile(
      nextReportPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          draftId: queued.script.draftId,
          failedAt: new Date().toISOString(),
          stage: 'tts-packaging',
          reason: reason.slice(0, 4_000),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await rename(nextReportPath, reportPath);
  } finally {
    await rm(nextReportPath, { force: true });
  }
}

interface ProduceOptions {
  count: number;
  concurrency: number;
  outputRoot: string;
  demo: boolean;
  llm: LlmProvider | null;
  tts: TtsProvider | null;
  embeddingProvider: EmbeddingProvider | null;
  fresh?: boolean;
  historyRoots?: readonly string[];
  optimisationBrief?: OptimisationBrief | null;
  scriptQueueRoot?: string;
  prepareScriptsOnly?: boolean;
  packagePreparedScripts?: boolean;
}

// Premises deliberately reuse television formats and physical sets. Lower thresholds mostly
// measure that shared scenery rather than a repeated comic mechanism. Lexical shingles separately
// reject exact and near-exact wording, while this higher semantic threshold catches paraphrased
// versions of the same joke without exhausting a set after one appearance.
const semanticSimilarityLimit = 0.84;

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function semanticNoveltyIssue(
  premise: string,
  embedding: readonly number[],
  history: readonly CreativeRecord[],
  historyEmbeddings: readonly (readonly number[])[],
): string | null {
  let closestIndex = -1;
  let closestSimilarity = -1;
  for (let index = 0; index < historyEmbeddings.length; index += 1) {
    const similarity = cosineSimilarity(embedding, historyEmbeddings[index] ?? []);
    if (similarity > closestSimilarity) {
      closestSimilarity = similarity;
      closestIndex = index;
    }
  }
  if (closestSimilarity < semanticSimilarityLimit || closestIndex < 0) {
    return null;
  }
  return `premise semantically repeats "${history[closestIndex]?.premise ?? premise}" (${closestSimilarity.toFixed(3)})`;
}

export interface BatchResult {
  mode: 'full' | 'prepare-scripts' | 'package-scripts';
  requestedSegmentCount: number;
  segmentCount: number;
  preparedScriptCount: number;
  preparedScriptsPerMinute: number;
  rejectedSegmentCount: number;
  concurrency: number;
  addedDurationMs: number;
  wallTimeMs: number;
  realtimeFactor: number;
  rejectionReasons: string[];
  outputRoot: string;
  ttsProvider: string;
}

type AsyncLimiter = <T>(operation: () => Promise<T>) => Promise<T>;

function createAsyncLimiter(limit: number): AsyncLimiter {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    if (active >= limit) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active += 1;
    try {
      return await operation();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

async function buildSegment(
  draft: GeneratedSegmentDraft,
  outputRoot: string,
  generator: string,
  model: string,
  tts: TtsProvider,
  withSpeechSlot: AsyncLimiter,
): Promise<SegmentPackage> {
  assertPreviewSafe(draft);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const segmentId = `seg_${slug(draft.programmeTitle)}_${suffix}`;
  const segmentDirectory = path.join(outputRoot, segmentId);
  await mkdir(segmentDirectory, { recursive: true });

  try {
    const pacing = pacingFor(draft);
    const transitions = transitionsForSegment(draft.format, pacing, draft.channelNumber);
    const speechTurns = speechTurnsForTts(draft.dialogue);
    const speech = new Array<{
      line: GeneratedSegmentDraft['dialogue'][number];
      speechId: string;
      voiceId: string;
      result: Awaited<ReturnType<TtsProvider['synthesize']>>;
    }>(speechTurns.length);
    let nextSpeechIndex = 0;
    const speechWorker = async (): Promise<void> => {
      while (nextSpeechIndex < speechTurns.length) {
        const index = nextSpeechIndex;
        nextSpeechIndex += 1;
        const line = speechTurns[index]!;
        const speechId = `speech_${index.toString().padStart(2, '0')}`;
        const voiceId = voiceFor(line.speaker, tts);
        let result: Awaited<ReturnType<TtsProvider['synthesize']>>;
        try {
          result = await withSpeechSlot(async () =>
            tts.synthesize({
              speechId,
              text: line.text,
              voiceId,
              speakingRate: speakingRateFor(pacing, line.speaker),
              outputDirectory: segmentDirectory,
            }),
          );
        } catch (error) {
          throw new Error(
            `${speechId} for ${line.speaker} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        speech[index] = { line, speechId, voiceId, result };
      }
    };
    const speechWorkerResults = await Promise.allSettled(
      Array.from(
        {
          length: Math.min(Math.max(1, tts.parallelism ?? 1), speechTurns.length),
        },
        async () => speechWorker(),
      ),
    );
    const failedSpeechWorker = speechWorkerResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failedSpeechWorker !== undefined) {
      throw failedSpeechWorker.reason;
    }

    const events: SegmentEvent[] = [
      { atMs: 0, type: 'transition.play', transition: transitions.opening },
      { atMs: 300, type: 'camera.cut', camera: 'CAMERA_WIDE' },
      {
        atMs: 550,
        type: 'graphic.show',
        graphic: openingGraphicForFormat(draft.format),
        text: draft.programmeTitle,
      },
    ];
    const timing = {
      frantic: { openingMs: 420, lineGapMs: 90, endingHoldMs: 600 },
      staccato: { openingMs: 700, lineGapMs: 280, endingHoldMs: 800 },
      conversational: { openingMs: 1_200, lineGapMs: 420, endingHoldMs: 700 },
      slow_burn: { openingMs: 2_000, lineGapMs: 1_800, endingHoldMs: 2_200 },
      interrupted: { openingMs: 650, lineGapMs: 360, endingHoldMs: 600 },
      near_silent: { openingMs: 3_200, lineGapMs: 2_700, endingHoldMs: 1_800 },
    }[pacing];
    let cursorMs = timing.openingMs;
    speech.forEach(({ line, speechId, voiceId, result }, index) => {
      const characterId = `character_${slug(line.speaker)}`;
      events.push({
        atMs: cursorMs,
        type: 'camera.cut',
        camera: index % 2 === 0 ? 'CAMERA_HOST' : 'CAMERA_GUEST',
      });
      events.push({
        atMs: cursorMs,
        type: 'character.action',
        characterId,
        action: line.action,
      });
      events.push({
        atMs: cursorMs + 120,
        type: 'speech.play',
        speechId,
        characterId,
        characterName: line.speaker,
        voiceId,
        subtitle: line.text,
        audioFile: result.audioFile,
        durationMs: result.durationMs,
      });
      events.push(...midSpeechCameraEvents(cursorMs + 120, result.durationMs, pacing, index));
      if (pacing === 'interrupted' && index < speech.length - 1 && index % 2 === 0) {
        events.push({
          atMs: cursorMs + result.durationMs + 120,
          type: 'audio.static',
          durationMs: 360,
        });
        events.push({
          atMs: cursorMs + result.durationMs + 120,
          type: 'transition.play',
          transition: 'SIGNAL_LOSS',
        });
      }
      if (timing.lineGapMs >= 1_500 && index < speech.length - 1) {
        const reactingLine = speech[index + 1]?.line;
        if (reactingLine !== undefined) {
          events.push({
            atMs: cursorMs + result.durationMs + Math.floor(timing.lineGapMs / 2),
            type: 'character.action',
            characterId: `character_${slug(reactingLine.speaker)}`,
            action: 'REACTION_NEUTRAL',
          });
        }
      }
      if (index === Math.floor((speech.length - 1) / 2) && index < speech.length - 1) {
        events.push({
          atMs: cursorMs + result.durationMs + Math.min(140, timing.lineGapMs),
          type: 'graphic.show',
          graphic: storyGraphicForFormat(draft.format),
          text: storyGraphicText(draft.continuityFact),
        });
      }
      cursorMs += result.durationMs + (index === speech.length - 1 ? 120 : timing.lineGapMs);
    });
    const payoffSpeaker = endingCharacter(draft);
    events.push({
      atMs: cursorMs,
      type: 'camera.cut',
      camera: 'CAMERA_WIDE',
    });
    events.push({
      atMs: cursorMs,
      type: 'character.action',
      characterId: `character_${slug(payoffSpeaker)}`,
      action: endingAction(draft),
    });
    events.push({
      atMs: cursorMs + timing.endingHoldMs,
      type: 'transition.play',
      transition: transitions.ending,
    });
    const durationMs = Math.max(8_000, cursorMs + timing.endingHoldMs + 520);

    const segment = segmentPackageSchema.parse({
      schemaVersion: 1,
      segmentId,
      channel: {
        id: `channel_${draft.channelNumber}`,
        number: draft.channelNumber,
        name: draft.channelName,
        realityId: draft.realityId,
      },
      programme: {
        id: slug(draft.programmeTitle),
        title: draft.programmeTitle,
        format: draft.format,
        premise: draft.premise,
      },
      durationMs,
      visualStyle: visualStyleForMedium(draft.visualMedium),
      visualMedium: transportVisualMediumFor(draft.visualMedium),
      castArchetype: draft.castArchetype,
      pacing,
      storyMode: draft.storyMode,
      tone: draft.tone,
      events,
      continuityUpdates: [
        {
          type: 'fact.proposed',
          subjectId: slug(draft.channelName),
          value: draft.continuityFact,
        },
      ],
      suggestedExit: {
        earliestMs: Math.max(0, durationMs - 3_000),
        preferredMs: durationMs,
        transition: transitions.ending,
      },
      production: {
        generatedAt: new Date().toISOString(),
        generator,
        model,
        safetyStatus: 'approved-for-local-preview',
        audioPrepared: true,
      },
    });
    const energisedSegment = energiseVisualTimeline(segment).segment;
    await writeFile(
      path.join(segmentDirectory, 'segment.json'),
      `${JSON.stringify(energisedSegment, null, 2)}\n`,
      'utf8',
    );
    return energisedSegment;
  } catch (error) {
    await rm(segmentDirectory, { recursive: true, force: true });
    throw error;
  }
}

export async function produceBatch(options: ProduceOptions): Promise<BatchResult> {
  const startedAt = performance.now();
  if (options.prepareScriptsOnly === true && options.packagePreparedScripts === true) {
    throw new Error('Script preparation and packaging modes are mutually exclusive');
  }
  if (
    (options.prepareScriptsOnly === true || options.packagePreparedScripts === true) &&
    options.scriptQueueRoot === undefined
  ) {
    throw new Error('Script queue root is required for script preparation or packaging');
  }
  if (options.prepareScriptsOnly !== true && options.tts === null) {
    throw new Error('TTS provider is required when packaging segments');
  }
  await mkdir(options.outputRoot, { recursive: true });
  const manifest: PlayoutManifest = options.fresh
    ? {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        totalDurationMs: 0,
        segments: [],
      }
    : await readManifest(options.outputRoot);
  const queuedPreparedScripts =
    options.packagePreparedScripts === true
      ? await readPreparedScripts(options.scriptQueueRoot!, options.count)
      : [];
  if (options.packagePreparedScripts === true && queuedPreparedScripts.length === 0) {
    throw new Error('No prepared scripts are waiting for packaging');
  }
  const workingCount =
    options.packagePreparedScripts === true ? queuedPreparedScripts.length : options.count;
  const drafts = new Array<GeneratedSegmentDraft | undefined>(workingCount);
  const failures = new Array<string | undefined>(workingCount);
  const queuedProposalSources = new Array<QueuedApprovedProposal | undefined>(workingCount);
  if (options.packagePreparedScripts === true) {
    for (const [index, queued] of queuedPreparedScripts.entries()) {
      drafts[index] = queued.script.draft;
    }
  } else {
    const startingSegmentCount = manifest.segments.length;
    const creativeSerialBase = options.demo
      ? startingSegmentCount
      : Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 8), 16);
    const creativeHistory = await readCreativeHistory(options.outputRoot, manifest);
    for (const historyRoot of options.historyRoots ?? []) {
      if (path.resolve(historyRoot) === path.resolve(options.outputRoot)) {
        continue;
      }
      const historyManifest = await readManifest(historyRoot);
      creativeHistory.push(...(await readCreativeHistory(historyRoot, historyManifest)));
    }
    if (options.scriptQueueRoot !== undefined) {
      creativeHistory.push(
        ...(await readPreparedScripts(options.scriptQueueRoot)).map(({ script }) =>
          recordFromDraft(script.draft),
        ),
      );
    }
    const queuedApprovedProposals =
      options.prepareScriptsOnly === true &&
      !options.demo &&
      options.llm?.generateProposal !== undefined &&
      options.scriptQueueRoot !== undefined
        ? await readApprovedProposals(options.scriptQueueRoot)
        : [];
    const queuedProposalRecords = queuedApprovedProposals.map(({ proposal }) => ({
      title: proposal.programmeTitle,
      premise: proposal.premise,
      dialogue: [],
      visualMedium: proposal.visualMedium,
      castArchetype: proposal.castArchetype,
    }));
    creativeHistory.push(...queuedProposalRecords);
    const semanticHistory =
      options.embeddingProvider === null
        ? []
        : await options.embeddingProvider.embed(creativeHistory.map((record) => record.premise));
    const proposals = new Array<GeneratedSegmentProposal | undefined>(options.count);
    const reservedRecords = new Array<CreativeRecord | undefined>(options.count);
    for (const [index, queued] of queuedApprovedProposals.slice(0, options.count).entries()) {
      proposals[index] = queued.proposal;
      queuedProposalSources[index] = queued;
      reservedRecords[index] = queuedProposalRecords[index];
    }
    let nextIndex = 0;
    let noveltyGate = Promise.resolve();
    const withNoveltyGate = async <T>(operation: () => T): Promise<T> => {
      const previous = noveltyGate;
      let release = (): void => undefined;
      noveltyGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return operation();
      } finally {
        release();
      }
    };
    const persistedPreparedScripts: PreparedScript[] = [];
    const persistedPreparedDrafts = new Set<GeneratedSegmentDraft>();
    const preparationRejectionReasons: string[] = [];

    const persistPreparedDraft = async (index: number): Promise<void> => {
      const draft = drafts[index];
      if (
        options.prepareScriptsOnly !== true ||
        options.scriptQueueRoot === undefined ||
        draft === undefined ||
        persistedPreparedDrafts.has(draft)
      ) {
        return;
      }
      const generator = options.demo ? 'demo-library' : options.llm!.id;
      const model = options.demo ? 'hand-authored-demo' : options.llm!.model;
      const result = await writePreparedScripts(
        options.scriptQueueRoot,
        [draft],
        generator,
        model,
        options.optimisationBrief ?? null,
      );
      preparationRejectionReasons.push(...result.rejectionReasons);
      const preparedDraft = result.preparedDrafts[0];
      const preparedScript = result.prepared[0];
      if (preparedDraft === undefined || preparedScript === undefined) {
        failures[index] =
          result.rejectionReasons.join(' | ') || 'Prepared script failed its final safety gate';
        drafts[index] = undefined;
        return;
      }
      persistedPreparedDrafts.add(preparedDraft);
      persistedPreparedScripts.push(preparedScript);
      const queuedProposal = queuedProposalSources[index];
      if (queuedProposal !== undefined) {
        await removeApprovedProposal(queuedProposal);
      }
    };

    const scriptProposal = async (index: number): Promise<void> => {
      const proposal = proposals[index];
      if (proposal === undefined) {
        return;
      }
      // Approved premises survive across writer cycles. Carry the critic's bounded,
      // inert defect labels into the first rewrite instead of accidentally giving the
      // provider the same clean-slate prompt on every cycle.
      let rejectionReasons = approvedProposalRetryReasons(
        queuedProposalSources[index]?.lastFailure,
      );
      // Give a viable premise several complete rewrites, but do not spend an entire
      // generation cycle polishing one concept the critic consistently rejects. The
      // unattended writer will immediately start a fresh batch with new coordinates.
      const maximumScriptAttempts = 4;
      for (let attempt = 0; attempt < maximumScriptAttempts; attempt += 1) {
        try {
          const scripted = await options.llm!.generateStructured({
            systemPrompt,
            userPrompt: scriptPrompt(proposal, rejectionReasons, options.optimisationBrief ?? null),
          });
          const candidate = repairDialogueArchitecture(
            repairNetworkIdentityCollision({
              ...scripted,
              ...proposal,
              dialogue: scripted.dialogue,
            }),
          );
          rejectionReasons = [
            ...proposalPreservationIssues(proposal, candidate),
            ...proposalQualityIssues(candidate),
            ...previewSafetyIssues(candidate),
            ...dialogueArchitectureIssues(candidate),
            ...dialogueNoveltyIssues(candidate.dialogue, creativeHistory),
            ...critiquePremise(candidate).reasons,
          ];
          if (rejectionReasons.length === 0 && options.llm!.critiqueDraft !== undefined) {
            rejectionReasons = editorialCritiqueIssues(await options.llm!.critiqueDraft(candidate));
          }
          if (rejectionReasons.length === 0) {
            drafts[index] = candidate;
            const record = reservedRecords[index];
            if (record !== undefined) {
              record.dialogue = candidate.dialogue.map((line) => line.text);
            }
            break;
          }
        } catch (error) {
          rejectionReasons = [error instanceof Error ? error.message : String(error)];
        }
      }
      if (drafts[index] !== undefined) {
        return;
      }
      const failure = `Could not script approved premise after ${maximumScriptAttempts} attempts: ${rejectionReasons.join('; ')}`;
      failures[index] = failure;
      if (
        options.prepareScriptsOnly === true &&
        options.scriptQueueRoot !== undefined &&
        options.llm?.generateProposal !== undefined
      ) {
        await recordApprovedProposalFailure(
          options.scriptQueueRoot,
          proposal,
          queuedProposalSources[index],
          failure,
        );
      }
    };

    const worker = async (): Promise<void> => {
      while (nextIndex < options.count) {
        const index = nextIndex;
        nextIndex += 1;
        if (drafts[index] !== undefined) {
          await persistPreparedDraft(index);
          continue;
        }
        if (proposals[index] !== undefined) {
          await scriptProposal(index);
          await persistPreparedDraft(index);
          continue;
        }
        try {
          let rejectionReasons: string[] = [];
          const proposalRejectionCounts = new Map<string, number>();
          const rejectedAttemptHistory: CreativeRecord[] = [];
          const semanticRejectedAttemptHistory: CreativeRecord[] = [];
          const rejectedAttemptEmbeddings: number[][] = [];
          let creativeCoordinateAttempt = 0;
          let structuralRetryUsed = false;
          // A mature catalogue occupies much more of the obvious premise space than a fresh
          // installation. Search longer rather than weakening the semantic novelty gate.
          const maximumProposalAttempts = 16;
          for (let attempt = 0; attempt < maximumProposalAttempts; attempt += 1) {
            const creativeSerial =
              creativeSerialBase + index + creativeCoordinateAttempt * options.count;
            const recent = creativeHistory.slice(-24);
            const recentMediums = recent
              .map((record) => record.visualMedium)
              .filter(
                (medium): medium is GeneratedSegmentDraft['visualMedium'] => medium !== undefined,
              );
            const recentCastArchetypes = recent
              .map((record) => record.castArchetype)
              .filter(
                (archetype): archetype is GeneratedSegmentDraft['castArchetype'] =>
                  archetype !== undefined,
              );
            const catalogueMediums = creativeHistory
              .map((record) => record.visualMedium)
              .filter(
                (medium): medium is GeneratedSegmentDraft['visualMedium'] => medium !== undefined,
              );
            const prompt = userPrompt(
              creativeSerial,
              recent.map((record) => record.title),
              recent.map((record) => record.premise),
              rejectionReasons,
              options.optimisationBrief ?? null,
              {
                visualMediums: recentMediums,
                castArchetypes: recentCastArchetypes,
              },
            );
            const useProposalStage = !options.demo && options.llm!.generateProposal !== undefined;
            const rawGenerated = options.demo
              ? demoDraft(startingSegmentCount + index + attempt * options.count)
              : useProposalStage
                ? await options.llm!.generateProposal!({
                    systemPrompt: proposalSystemPrompt,
                    userPrompt: prompt,
                  })
                : await options.llm!.generateStructured({
                    systemPrompt,
                    userPrompt: prompt,
                  });
            const generated = repairNetworkIdentityCollision({
              ...rawGenerated,
              format: assignedFormat(creativeSerial, options.optimisationBrief ?? null),
              pacing: assignedPacing(creativeSerial, options.optimisationBrief ?? null),
              storyMode: assignedStoryMode(creativeSerial, options.optimisationBrief ?? null),
              visualMedium: assignedVisualMedium(creativeSerial, recentMediums, catalogueMediums),
              castArchetype: assignedCastArchetype(creativeSerial, recentCastArchetypes),
            });
            generated.visualStyle = visualStyleForMedium(generated.visualMedium);
            const candidateEmbedding =
              options.embeddingProvider === null
                ? null
                : (await options.embeddingProvider.embed([generated.premise]))[0];
            const preliminarySemanticIssue =
              candidateEmbedding === null || candidateEmbedding === undefined
                ? null
                : semanticNoveltyIssue(
                    generated.premise,
                    candidateEmbedding,
                    [...creativeHistory, ...semanticRejectedAttemptHistory],
                    [...semanticHistory, ...rejectedAttemptEmbeddings],
                  );
            const preliminaryProposalIssues = useProposalStage
              ? [
                  ...conceptNoveltyIssues(generated, [
                    ...creativeHistory,
                    ...rejectedAttemptHistory,
                  ]),
                  ...(preliminarySemanticIssue === null ? [] : [preliminarySemanticIssue]),
                  ...proposalQualityIssues(generated),
                ]
              : [];
            const proposalEditorialIssues =
              useProposalStage &&
              preliminaryProposalIssues.length === 0 &&
              options.llm!.critiqueProposal !== undefined
                ? proposalCritiqueIssues(await options.llm!.critiqueProposal(generated))
                : [];
            const accepted = await withNoveltyGate(() => {
              const conceptHistory = [...creativeHistory, ...rejectedAttemptHistory];
              const semanticConceptHistory = [
                ...creativeHistory,
                ...semanticRejectedAttemptHistory,
              ];
              const semanticConceptEmbeddings = [...semanticHistory, ...rejectedAttemptEmbeddings];
              const semanticIssue =
                candidateEmbedding === null || candidateEmbedding === undefined
                  ? null
                  : semanticNoveltyIssue(
                      generated.premise,
                      candidateEmbedding,
                      semanticConceptHistory,
                      semanticConceptEmbeddings,
                    );
              rejectionReasons = [
                ...conceptNoveltyIssues(generated, conceptHistory),
                ...(semanticIssue === null ? [] : [semanticIssue]),
                ...(useProposalStage
                  ? [...proposalQualityIssues(generated), ...proposalEditorialIssues]
                  : [
                      ...dialogueNoveltyIssues(
                        (generated as GeneratedSegmentDraft).dialogue,
                        creativeHistory,
                      ),
                      ...critiquePremise(generated as GeneratedSegmentDraft).reasons,
                    ]),
              ];
              if (rejectionReasons.length !== 0) {
                for (const reason of rejectionReasons) {
                  const category = proposalRejectionCategory(reason);
                  proposalRejectionCounts.set(
                    category,
                    (proposalRejectionCounts.get(category) ?? 0) + 1,
                  );
                }
                const rejectedRecord: CreativeRecord = {
                  title: generated.programmeTitle,
                  premise: generated.premise,
                  dialogue: [],
                };
                const rejectedForNovelty = rejectionReasons.some((reason) => {
                  const category = proposalRejectionCategory(reason);
                  return category === 'semantic-novelty' || category === 'concept-novelty';
                });
                // A pure structural failure gets one correction against the same creative
                // coordinates. Do not make that repair fail novelty merely because it preserves
                // the assigned premise. Once the correction is exhausted—or the idea itself is
                // already repetitive—retire it before moving to different coordinates.
                if (rejectedForNovelty || structuralRetryUsed) {
                  rejectedAttemptHistory.push(rejectedRecord);
                  if (candidateEmbedding !== null && candidateEmbedding !== undefined) {
                    semanticRejectedAttemptHistory.push(rejectedRecord);
                    rejectedAttemptEmbeddings.push(candidateEmbedding);
                  }
                }
                return false;
              }
              const record: CreativeRecord = {
                title: generated.programmeTitle,
                premise: generated.premise,
                dialogue: useProposalStage
                  ? []
                  : (generated as GeneratedSegmentDraft).dialogue.map((line) => line.text),
              };
              creativeHistory.push(record);
              reservedRecords[index] = record;
              if (candidateEmbedding !== null && candidateEmbedding !== undefined) {
                semanticHistory.push(candidateEmbedding);
              }
              if (useProposalStage) {
                proposals[index] = generated;
              } else {
                drafts[index] = generated as GeneratedSegmentDraft;
              }
              return true;
            });
            if (accepted) {
              break;
            }
            const rejectedForNovelty = rejectionReasons.some((reason) => {
              const category = proposalRejectionCategory(reason);
              return category === 'semantic-novelty' || category === 'concept-novelty';
            });
            if (rejectedForNovelty || structuralRetryUsed) {
              creativeCoordinateAttempt += 1;
              structuralRetryUsed = false;
            } else {
              // Give a mechanical correction one attempt against the same brief. Changing the
              // coordinates here would contradict the retry instructions and make the provider
              // solve a different format, story mode and visual grammar at the same time.
              structuralRetryUsed = true;
            }
          }
          if (proposals[index] === undefined && drafts[index] === undefined) {
            const rejectionSummary = [...proposalRejectionCounts.entries()]
              .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
              .map(([category, count]) => `${category}=${count}`)
              .join(', ');
            throw new Error(
              `Could not produce a novel premise after ${maximumProposalAttempts} attempts (${rejectionSummary || 'no categorised rejection'}): ${rejectionReasons.join('; ')}`,
            );
          }
          await scriptProposal(index);
          await persistPreparedDraft(index);
        } catch (error) {
          failures[index] = error instanceof Error ? error.message : String(error);
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(options.concurrency, options.count) }, async () => worker()),
    );
    if (options.prepareScriptsOnly === true) {
      if (persistedPreparedScripts.length === 0) {
        const reasons = [
          ...failures.filter((failure): failure is string => failure !== undefined),
          ...preparationRejectionReasons,
        ];
        throw new Error(
          `Batch produced no approved scripts${reasons.length === 0 ? '' : `: ${reasons.join(' | ')}`}`,
        );
      }
      const wallTimeMs = performance.now() - startedAt;
      return {
        mode: 'prepare-scripts',
        requestedSegmentCount: options.count,
        segmentCount: 0,
        preparedScriptCount: persistedPreparedScripts.length,
        preparedScriptsPerMinute: Number(
          (persistedPreparedScripts.length / (wallTimeMs / 60_000)).toFixed(2),
        ),
        rejectedSegmentCount: options.count - persistedPreparedScripts.length,
        concurrency: options.concurrency,
        addedDurationMs: 0,
        wallTimeMs: Math.round(wallTimeMs),
        realtimeFactor: 0,
        rejectionReasons: [
          ...failures.filter((failure): failure is string => failure !== undefined),
          ...preparationRejectionReasons,
        ],
        outputRoot: options.scriptQueueRoot!,
        ttsProvider: 'not-used',
      };
    }
  }

  const tts = options.tts!;
  const produced = new Array<SegmentPackage | undefined>(workingCount);
  let addedDurationMs = 0;
  let nextProductionIndex = 0;
  const withSpeechSlot = createAsyncLimiter(Math.max(1, tts.parallelism ?? 1));
  const productionWorker = async (): Promise<void> => {
    while (nextProductionIndex < drafts.length) {
      const index = nextProductionIndex;
      nextProductionIndex += 1;
      const draft = drafts[index];
      if (draft === undefined) {
        continue;
      }
      try {
        const queued = queuedPreparedScripts[index];
        produced[index] = await buildSegment(
          draft,
          options.outputRoot,
          queued?.script.generator ?? (options.demo ? 'demo-library' : options.llm!.id),
          queued?.script.model ?? (options.demo ? 'hand-authored-demo' : options.llm!.model),
          tts,
          withSpeechSlot,
        );
      } catch (error) {
        failures[index] = error instanceof Error ? error.message : String(error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, drafts.length) }, async () =>
      productionWorker(),
    ),
  );

  if (options.packagePreparedScripts === true) {
    for (const [index, segment] of produced.entries()) {
      const queued = queuedPreparedScripts[index];
      const failure = failures[index];
      if (
        segment === undefined &&
        queued !== undefined &&
        failure !== undefined &&
        preparedScriptFailureIsQuarantinable(failure)
      ) {
        await quarantinePreparedScript(options.scriptQueueRoot!, queued, failure);
      }
    }
  }

  const completedSegments = produced.filter(
    (segment): segment is SegmentPackage => segment !== undefined,
  );
  if (completedSegments.length === 0) {
    const reasons = failures.filter((failure): failure is string => failure !== undefined);
    throw new Error(
      `Batch produced no approved segment packages${reasons.length === 0 ? '' : `: ${reasons.join(' | ')}`}`,
    );
  }

  const outputManifest = options.fresh ? manifest : await readManifest(options.outputRoot);
  const existingSegmentIds = new Set(outputManifest.segments.map((entry) => entry.segmentId));
  for (const segment of completedSegments) {
    if (existingSegmentIds.has(segment.segmentId)) {
      continue;
    }
    addedDurationMs += segment.durationMs;
    outputManifest.segments.push({
      segmentId: segment.segmentId,
      packagePath: path.posix.join(segment.segmentId, 'segment.json'),
      durationMs: segment.durationMs,
      channelNumber: segment.channel.number,
      channelName: segment.channel.name,
      programmeTitle: segment.programme.title,
    });
    outputManifest.totalDurationMs += segment.durationMs;
    existingSegmentIds.add(segment.segmentId);
  }
  outputManifest.generatedAt = new Date().toISOString();
  await writeManifest(options.outputRoot, outputManifest);
  if (options.packagePreparedScripts === true) {
    for (const [index, segment] of produced.entries()) {
      const queued = queuedPreparedScripts[index];
      if (segment !== undefined && queued !== undefined) {
        await archivePreparedScript(options.scriptQueueRoot!, queued);
      }
    }
  }

  const wallTimeMs = performance.now() - startedAt;
  return {
    mode: options.packagePreparedScripts === true ? 'package-scripts' : 'full',
    requestedSegmentCount: workingCount,
    segmentCount: completedSegments.length,
    preparedScriptCount: 0,
    preparedScriptsPerMinute: 0,
    rejectedSegmentCount: workingCount - completedSegments.length,
    concurrency: options.concurrency,
    addedDurationMs,
    wallTimeMs: Math.round(wallTimeMs),
    realtimeFactor: Number((addedDurationMs / wallTimeMs).toFixed(2)),
    rejectionReasons: failures.filter((failure): failure is string => failure !== undefined),
    outputRoot: options.outputRoot,
    ttsProvider: tts.id,
  };
}
