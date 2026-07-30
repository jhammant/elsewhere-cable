import { generatedSegmentDraftSchema, type GeneratedSegmentDraft } from '@elsewhere-cable/schemas';

const drafts = [
  {
    channelNumber: 9_804_771_362,
    channelName: 'Domestic Heat Allocation',
    programmeTitle: 'Cold Enough for the Bathroom',
    format: 'sitcom',
    realityId: 'THERMAL-HOUSE-71',
    visualStyle: 'thermal_household_comedy',
    visualMedium: 'thermal_camera',
    castArchetype: 'mixed',
    pacing: 'near_silent',
    storyMode: 'social_protocol',
    premise:
      'In a family bathroom, Pera wants the first shower with a refrigerator pack, but roommate Rook refuses because household custom gives priority to the coldest heat signature.',
    tone: ['quiet', 'competitive', 'domestic'],
    dialogue: [
      {
        speaker: 'Pera',
        text: 'I booked the bathroom before breakfast.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Rook',
        text: 'The boiler booked it for the coldest applicant.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Pera',
        text: 'I have held these chilled peas for twenty minutes.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Boiler',
        text: 'The peas are colder. Please hand them the towel.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Bathroom priority belongs to the coldest household heat signature.',
    endingBeat:
      'Pera wraps the towel around the chilled peas while the boiler grants them the first turn.',
  },
  {
    channelNumber: 8_771_600_294,
    channelName: 'Civic Assembly Diagrams',
    programmeTitle: 'Step Four Requests the Floor',
    format: 'public_access',
    realityId: 'BLUEPRINT-STAIR-04',
    visualStyle: 'dimensioned_staircase_helpdesk',
    visualMedium: 'blueprint_schematic',
    castArchetype: 'paper_puppets',
    pacing: 'staccato',
    storyMode: 'service_mismatch',
    premise:
      'At a civic assembly service, resident Nilo wants help finishing a staircase, but worker Venn refuses because Step Four has filed a complaint against Step Three.',
    tone: ['precise', 'procedural', 'petty'],
    dialogue: [
      {
        speaker: 'Nilo',
        text: 'I only need the final three steps.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Venn',
        text: 'Step Four has requested an independent hearing.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Nilo',
        text: 'It is a rectangle on your drawing.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Step Four',
        text: 'A rectangle repeatedly stood upon by Step Three.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Venn',
        text: 'Would a landing satisfy both parties?',
        action: 'PAUSE',
      },
      {
        speaker: 'Step Four',
        text: 'Only if I may chair the landing.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Uninstalled staircase steps may request civic hearings.',
    endingBeat:
      'Venn places Step Four behind the hearing desk and labels the unfinished staircase public seating.',
  },
  {
    channelNumber: 9_662_118_405,
    channelName: 'Rose Window Weather',
    programmeTitle: 'The Driest Umbrella Wins',
    format: 'news',
    realityId: 'GLASS-FORECAST-19',
    visualStyle: 'stained_glass_weather_bulletin',
    visualMedium: 'stained_glass',
    castArchetype: 'geometric_aliens',
    pacing: 'slow_burn',
    storyMode: 'status_transfer',
    premise:
      'During weather news coverage, anchor Sola wants to credit the forecaster, but official Pell refuses because forecast authority transfers to whichever umbrella keeps its owner driest.',
    tone: ['reverent', 'local', 'competitive'],
    dialogue: [
      {
        speaker: 'Sola',
        text: 'Rain reaches the eastern roofs after lunch.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Pell',
        text: 'Please identify the driest umbrella in shot.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Forecaster Iri',
        text: 'Mine is wet because I checked the weather.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Studio Umbrella',
        text: 'I remained indoors and reviewed no evidence.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Pell',
        text: 'That is exemplary forecasting dryness.',
        action: 'PAUSE',
      },
      {
        speaker: 'Sola',
        text: 'Fine. The umbrella may point at itself.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Forecast authority transfers to the driest umbrella in view.',
    endingBeat:
      'Sola gives the studio umbrella the weather pointer while Iri stands beneath it in the rain graphic.',
  },
  {
    channelNumber: 7_993_440_816,
    channelName: 'Street Copy Sales',
    programmeTitle: 'Ticket Demands a Seat',
    format: 'advert',
    realityId: 'XEROX-BOXOFFICE-23',
    visualStyle: 'photocopied_ticket_advert',
    visualMedium: 'xerox_punk',
    castArchetype: 'talking_objects',
    pacing: 'frantic',
    storyMode: 'object_agency',
    premise:
      'At a street-poster advert, promoter Kess wants to sell concert tickets, but a talking ticket refuses to print the price until it receives its own front-row seat.',
    tone: ['loud', 'commercial', 'unionised'],
    dialogue: [
      {
        speaker: 'Kess',
        text: 'Doors at eight. Tickets are nearly gone.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Ticket',
        text: 'One ticket remains entirely unseated.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Kess',
        text: 'You are the permission to occupy a seat.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Ticket',
        text: 'Permission deserves to experience its own work.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Customer Fen',
        text: 'Can I buy the seat behind it?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Ticket',
        text: 'Only if you promise not to read over my shoulder.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Kess',
        text: 'Fine. Row A, seat zero.',
        action: 'PAUSE',
      },
      {
        speaker: 'Ticket',
        text: 'Price printed. View restricted by myself.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Concert tickets may reserve seats for their own attendance.',
    endingBeat:
      'Kess pins the ticket over seat zero on the poster and prints the customer directly behind it.',
  },
  {
    channelNumber: 8_410_773_205,
    channelName: 'Small Night Continuity',
    programmeTitle: 'The Moon Refuses Sign-Off',
    format: 'ident',
    realityId: 'STORYBOOK-NIGHT-08',
    visualStyle: 'watercolour_bedtime_ident',
    visualMedium: 'storybook_wash',
    castArchetype: 'celestial',
    pacing: 'near_silent',
    storyMode: 'format_literalism',
    premise:
      'During a bedtime station ident, announcer Vale wants to finish the channel name, but the moon refuses the closing cue until its night-shift handover includes breakfast.',
    tone: ['gentle', 'professional', 'sleepy'],
    dialogue: [
      {
        speaker: 'Vale',
        text: 'This concludes Small Night Continuity.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Moon',
        text: 'Your conclusion omits the morning handover.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Vale',
        text: 'The sun normally brings its own breakfast.',
        action: 'PAUSE',
      },
      {
        speaker: 'Moon',
        text: 'Then the channel may remain quietly open.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Night-shift celestial staff require breakfast before station sign-off.',
    endingBeat:
      'Vale places a breakfast caption beneath the moon and leaves the closing cue waiting beside it.',
  },
  {
    channelNumber: 9_274_880_631,
    channelName: 'Eighty-Column Retail',
    programmeTitle: 'Telephone for Unanswered Questions',
    format: 'shopping',
    realityId: 'TERMINAL-PHONE-80',
    visualStyle: 'phosphor_phone_sales_terminal',
    visualMedium: 'ascii_terminal',
    castArchetype: 'talking_objects',
    pacing: 'frantic',
    storyMode: 'product_consequence',
    premise:
      'In a terminal shopping channel, host Quill wants a customer to buy a telephone product that calls unanswered questions, but customer Daro refuses after it rings the price graphic.',
    tone: ['technical', 'urgent', 'sales-driven'],
    dialogue: [
      {
        speaker: 'Quill',
        text: 'Ask once, and the telephone pursues the missing answer.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Daro',
        text: 'What does it cost?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Telephone',
        text: 'Calling price graphic now.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Price Graphic',
        text: 'I display numbers. I do not interpret them.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Quill',
        text: 'That question is still within the free trial.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Daro',
        text: 'How do I cancel?',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Telephone',
        text: 'Calling cancellation question now.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Quill',
        text: 'Please stop improving the demonstration.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The unanswered-question telephone treats price graphics as callable experts.',
    endingBeat:
      'The telephone calls the cancellation question while Quill quietly replaces the price with a question mark.',
  },
  {
    channelNumber: 6_881_250_947,
    channelName: 'Axonometric Seating Advice',
    programmeTitle: 'Chair Authority, Final Screw',
    format: 'public_access',
    realityId: 'ISOMETRIC-CHAIR-06',
    visualStyle: 'isometric_furniture_advice',
    visualMedium: 'isometric_manual',
    castArchetype: 'humanoid',
    pacing: 'staccato',
    storyMode: 'status_transfer',
    premise:
      'At a civic furniture demonstration, resident Fenn wants to sit down, but clerk Orra refuses because chair authority transfers to whoever installs the final screw.',
    tone: ['helpful', 'diagrammatic', 'competitive'],
    dialogue: [
      {
        speaker: 'Fenn',
        text: 'The chair is complete enough for sitting.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Orra',
        text: 'It still lacks an authorised decision-maker.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Fenn',
        text: 'I assembled every other part.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Caller Tibb',
        text: 'I can install the final screw remotely.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Orra',
        text: 'Then Tibb controls the chair.',
        action: 'PAUSE',
      },
      {
        speaker: 'Fenn',
        text: 'Tibb, may I have permission to sit?',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Chair authority transfers to the installer of the final screw.',
    endingBeat:
      'Fenn holds the final screw toward the telephone while Orra adds Caller Tibb to the assembly diagram.',
  },
  {
    channelNumber: 9_115_304_772,
    channelName: 'Ink Clock Bulletin',
    programmeTitle: 'The Time Remains Uncorrected',
    format: 'news',
    realityId: 'INK-TIME-11',
    visualStyle: 'brush_ink_time_bulletin',
    visualMedium: 'ink_monochrome',
    castArchetype: 'paper_puppets',
    pacing: 'conversational',
    storyMode: 'visual_physics',
    premise:
      'During an ink-drawn news bulletin, anchor Mira wants to report the correct time, but the studio clock moves backward whenever a correction is spoken.',
    tone: ['serious', 'measured', 'increasingly late'],
    dialogue: [
      {
        speaker: 'Mira',
        text: 'The time is six fourteen.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Clock',
        text: 'That was true one minute ago.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Mira',
        text: 'Correction, it is six fifteen.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Clock',
        text: 'Thank you. We are now at six thirteen.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Mira',
        text: 'The time remains professionally disputed.',
        action: 'PAUSE',
      },
      {
        speaker: 'Clock',
        text: 'Excellent. I can proceed normally.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Spoken time corrections move the Ink Clock backward.',
    endingBeat:
      'Mira removes the correction card and lets the clock point confidently at the disputed minute.',
  },
  {
    channelNumber: 7_440_982_116,
    channelName: 'Shadow Facilities Notice',
    programmeTitle: 'The Spotlight Has Been Promoted',
    format: 'emergency',
    realityId: 'SHADOW-OFFICE-44',
    visualStyle: 'shadow_puppet_facilities_advisory',
    visualMedium: 'shadow_theatre',
    castArchetype: 'paper_puppets',
    pacing: 'interrupted',
    storyMode: 'service_mismatch',
    premise:
      'During a harmless public facilities advisory, representative Senn wants resident Pol to dim a spotlight, but Pol refuses because the promoted light now requires supervisor service.',
    tone: ['calm', 'official', 'theatrical'],
    dialogue: [
      {
        speaker: 'Senn',
        text: 'Please dim the promoted spotlight after use.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Pol',
        text: 'It no longer accepts resident-level instructions.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Spotlight',
        text: 'Facilities matters may be addressed to my shadow.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Senn',
        text: 'Fine. Acting Manager, kindly supervise your darkness.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Promoted spotlights accept facilities requests only through supervisor service.',
    endingBeat:
      'Senn gives the shadow a supervisor badge while the spotlight illuminates its own empty chair.',
  },
  {
    channelNumber: 8_940_117_553,
    channelName: 'Delayed Family Picture',
    programmeTitle: 'Surprise Arrives Three Seconds Early',
    format: 'sitcom',
    realityId: 'SIGNAL-HOME-03',
    visualStyle: 'broken_signal_family_comedy',
    visualMedium: 'signal_corruption',
    castArchetype: 'mixed',
    pacing: 'interrupted',
    storyMode: 'format_literalism',
    premise:
      'In a family surprise-party broadcast, Mara wants to hide the cake, but neighbour Pell refuses because the television signal announces every secret three seconds early.',
    tone: ['warm', 'frustrated', 'glitchy'],
    dialogue: [
      {
        speaker: 'Mara',
        text: 'Put the cake behind the television.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Signal',
        text: 'Cake now hidden behind television.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Pell',
        text: 'It announces plans before we perform them.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Mara',
        text: 'Then I am definitely not moving the cake.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'The Delayed Family Picture signal announces secrets three seconds early.',
    endingBeat:
      'Mara leaves the cake in plain view while the signal confidently reports its successful concealment.',
  },
] satisfies GeneratedSegmentDraft[];

export const signalSurfDrafts = drafts.map((draft) => generatedSegmentDraftSchema.parse(draft));
