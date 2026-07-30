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
  {
    channelNumber: 9_771_204_685,
    channelName: 'Break-Room Constellation',
    programmeTitle: 'The Folding Tablecloth',
    format: 'sitcom',
    realityId: 'CELESTIAL-OFFICE-12',
    visualStyle: 'graphic_cel_shaded_cosmic_workplace',
    visualMedium: 'cel_shaded',
    castArchetype: 'celestial',
    pacing: 'frantic',
    storyMode: 'status_transfer',
    premise:
      'During a workplace promotion dispute, Senior Star needs the folding tablecloth to mark their station, but formal authority transfers to Junior Star when Senior Star demands to be addressed by title.',
    tone: ['frantic', 'petty', 'cosmic'],
    dialogue: [
      {
        speaker: 'Senior Star',
        text: 'Keep the folding tablecloth flat. It marks my senior station.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Junior Star',
        text: 'It also covers my lunch.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Senior Star',
        text: 'Your lunch is outside the promotion zone.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Junior Star',
        text: 'Should I call you Senior Star?',
        action: 'PAUSE',
      },
      {
        speaker: 'Senior Star',
        text: 'You should know my title without asking.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Junior Star',
        text: 'Then I will call you the person near the cloth.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Senior Star',
        text: 'Address me as Senior Star immediately.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Junior Star',
        text: 'Thank you. You have ended your own authority.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Senior Star',
        text: 'May I remain beside the tablecloth?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Junior Star',
        text: 'Yes. Please hold the junior corner.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Demanding a formal title transfers break-room authority to the nearest junior.',
    endingBeat:
      'Junior Star declares the tablecloth their new station while Senior Star requests permission to keep one corner.',
  },
  {
    channelNumber: 8_216_994_507,
    channelName: 'Folded Property Desk',
    programmeTitle: 'The Suitcase Chooses First',
    format: 'public_access',
    realityId: 'PAPER-CLAIMS-27',
    visualStyle: 'layered_paper_lost_property_hearing',
    visualMedium: 'paper_cutout',
    castArchetype: 'paper_puppets',
    pacing: 'slow_burn',
    storyMode: 'social_protocol',
    premise:
      'At a paper-cutout lost-property hearing, resident Aro wants to reclaim a suitcase, but clerk Nemi refuses because local etiquette permits claims only from people the luggage recognises first.',
    tone: ['patient', 'procedural', 'personally inconvenient'],
    dialogue: [
      {
        speaker: 'Aro',
        text: 'That is my suitcase beside you.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Nemi',
        text: 'It has not confirmed the relationship.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Aro',
        text: 'My initials are on the handle.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Suitcase',
        text: 'Those initials never carried me upstairs.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Aro',
        text: 'You have wheels and strong opinions.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Nemi',
        text: 'The suitcase has recognised your tone.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Lost luggage must recognise a claimant before ownership is restored.',
    endingBeat:
      'Nemi stamps the claim approved while the suitcase presents Aro with its own collection ticket.',
  },
  {
    channelNumber: 6_732_510_884,
    channelName: 'Block Borough Traffic',
    programmeTitle: 'Parking Inside the Headline',
    format: 'news',
    realityId: 'PIXEL-ROADS-16',
    visualStyle: 'eight_bit_traffic_caption_news',
    visualMedium: 'pixel_broadcast',
    castArchetype: 'geometric_aliens',
    pacing: 'staccato',
    storyMode: 'format_literalism',
    premise:
      'During an eight-bit traffic bulletin, reporter Jex wants to name a stalled bus, but anchor Pavo refuses because the live caption grants every named vehicle a parking space inside the headline.',
    tone: ['urgent', 'literal', 'municipal'],
    dialogue: [
      {
        speaker: 'Jex',
        text: 'The number twelve bus blocks Market Lane.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Caption',
        text: 'Space reserved for number twelve.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Pavo',
        text: 'Please stop furnishing the headline.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Jex',
        text: 'A delivery van is behind it.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Caption',
        text: 'Compact space reserved behind bus.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Pavo',
        text: 'Traffic remains severe and typographically accommodated.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Vehicles named by Block Borough Traffic receive spaces inside its headline.',
    endingBeat:
      'Pavo reads the bulletin from one remaining letter while two tiny vehicles occupy the caption.',
  },
  {
    channelNumber: 7_508_362_941,
    channelName: 'Recovered Evening Continuity',
    programmeTitle: 'Beautifully Preserved',
    format: 'ident',
    realityId: 'ARCHIVE-MISSING-52',
    visualStyle: 'scratched_archive_continuity_booth',
    visualMedium: 'archive_film',
    castArchetype: 'humanoid',
    pacing: 'near_silent',
    storyMode: 'semantic_contract',
    premise:
      'Inside an archive-film continuity booth, announcer Olan wants to introduce a restored programme, but curator Tess refuses because saying beautifully preserved contractually accepts responsibility for every missing frame.',
    tone: ['reverent', 'careful', 'understaffed'],
    dialogue: [
      {
        speaker: 'Olan',
        text: 'Tonight we present a beautifully preserved classic.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Tess',
        text: 'Thank you for accepting the missing frames.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Olan',
        text: 'I accepted an adjective, not storage.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Tess',
        text: 'The adjective is now shelving reels.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Calling archive material beautifully preserved assigns responsibility for its missing frames.',
    endingBeat:
      'Tess hangs four empty film frames beneath Olan’s name while the restored title waits unintroduced.',
  },
  {
    channelNumber: 9_318_775_206,
    channelName: 'Electric Horizon Outlet',
    programmeTitle: 'Closing Time Sold Separately',
    format: 'shopping',
    realityId: 'NEON-SUNSET-63',
    visualStyle: 'neon_wireframe_horizon_showroom',
    visualMedium: 'neon_wireframe',
    castArchetype: 'geometric_aliens',
    pacing: 'frantic',
    storyMode: 'product_consequence',
    premise:
      'In a neon-wireframe shopping arena, host Hex wants caller Yani to buy a personal horizon kit, but Yani refuses because the product assigns its owner every evening closing announcement.',
    tone: ['electric', 'sales-driven', 'overcommitted'],
    dialogue: [
      {
        speaker: 'Hex',
        text: 'Own a horizon that fits any room.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Yani',
        text: 'Who announces when it closes?',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Hex',
        text: 'The proud owner does.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Yani',
        text: 'Every evening without exception?',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Hex',
        text: 'Weekends include two ceremonial closings.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Yani',
        text: 'I already close my curtains.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Hex',
        text: 'Excellent relevant experience for the role.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Yani',
        text: 'I withdraw my entire evening.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Personal horizon owners must deliver every evening closing announcement.',
    endingBeat:
      'Hex pins an employee badge to the unsold horizon and asks it to announce its own closing.',
  },
  {
    channelNumber: 6_405_883_719,
    channelName: 'Tape Four Community Pets',
    programmeTitle: 'Advice for the Invisible Dog',
    format: 'public_access',
    realityId: 'VHS-PETS-04',
    visualStyle: 'tracking_error_pet_advice_desk',
    visualMedium: 'public_access_vhs',
    castArchetype: 'mixed',
    pacing: 'conversational',
    storyMode: 'service_mismatch',
    premise:
      'At a VHS community pet-advice desk, caller Seli wants help training a noisy dog, but adviser Bram refuses because the booking provides obedience service only for the dog’s imaginary friend.',
    tone: ['earnest', 'domestic', 'poorly booked'],
    dialogue: [
      {
        speaker: 'Seli',
        text: 'My dog barks whenever nobody knocks.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Bram',
        text: 'Describe the imaginary friend on your booking.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Seli',
        text: 'The dog invented him yesterday.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Bram',
        text: 'Then he is our registered client.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Dog',
        text: 'He refuses to sit.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Bram',
        text: 'Finally, a useful witness statement.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Tape Four accepts obedience bookings for imaginary pets and companions.',
    endingBeat:
      'Bram awards an empty cushion a training certificate while the dog waits beside the caller.',
  },
  {
    channelNumber: 8_607_229_145,
    channelName: 'Frame-by-Frame Departures',
    programmeTitle: 'The Travel Label Stays Home',
    format: 'advert',
    realityId: 'STOPMOTION-TRAVEL-18',
    visualStyle: 'stop_motion_luggage_commercial',
    visualMedium: 'stop_motion',
    castArchetype: 'talking_objects',
    pacing: 'staccato',
    storyMode: 'object_agency',
    premise:
      'At a stop-motion travel advert, guide Prit wants to promote a weekend suitcase, but its travel label refuses to name the destination until the traveller chooses somewhere the label can avoid.',
    tone: ['bright', 'particular', 'travel-weary'],
    dialogue: [
      {
        speaker: 'Prit',
        text: 'Pack Friday and arrive refreshed.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Tag',
        text: 'Destination remains personally unacceptable.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Traveller Ula',
        text: 'We have not chosen one.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Tag',
        text: 'Please choose somewhere without me.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Prit',
        text: 'The tag is included.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Tag',
        text: 'Then advertise the suitcase as staying home.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Frame-by-Frame luggage tags may decline destinations before they are chosen.',
    endingBeat:
      'Prit ties a HOME label to the suitcase and sells the traveller an empty departure card.',
  },
  {
    channelNumber: 7_164_908_332,
    channelName: 'Cut-and-Paste Household',
    programmeTitle: 'The Least Attached Roommate',
    format: 'sitcom',
    realityId: 'COLLAGE-FLAT-39',
    visualStyle: 'collage_zine_shared_flat',
    visualMedium: 'collage_zine',
    castArchetype: 'mixed',
    pacing: 'interrupted',
    storyMode: 'status_transfer',
    premise:
      'In a collage-zine shared flat, roommate Bex wants to choose the wall poster, but house veto passes to whoever can explain the fewest existing pictures.',
    tone: ['domestic', 'defensive', 'visually crowded'],
    dialogue: [
      {
        speaker: 'Bex',
        text: 'I brought one quiet landscape.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Rilo',
        text: 'Explain the giant spoon first.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Bex',
        text: 'I assumed that was yours.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Rilo',
        text: 'Perfect. You now hold the veto.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Wall-decoration veto passes to the roommate least attached to existing pictures.',
    endingBeat:
      'Bex covers the unexplained spoon with the quiet landscape while Rilo submits an appeal in cut-out letters.',
  },
  {
    channelNumber: 9_024_617_853,
    channelName: 'Tiny Reading Room Procedure',
    programmeTitle: 'Last Out Leaves First',
    format: 'emergency',
    realityId: 'DIORAMA-LIBRARY-02',
    visualStyle: 'miniature_library_procedure_notice',
    visualMedium: 'miniature_diorama',
    castArchetype: 'humanoid',
    pacing: 'near_silent',
    storyMode: 'social_protocol',
    premise:
      'Inside a miniature library advisory, librarian Fen wants to reopen the reading room, but inspector Ora refuses because exit etiquette requires the last visitor to leave first.',
    tone: ['calm', 'whispered', 'administratively circular'],
    dialogue: [
      {
        speaker: 'Fen',
        text: 'The reading room is completely empty.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Ora',
        text: 'Then the last visitor has not left first.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Fen',
        text: 'There is nobody left to leave.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Ora',
        text: 'Please remain last until someone arrives.',
        action: 'FREEZE',
      },
    ],
    continuityFact:
      'Tiny Reading Room etiquette requires the final visitor to exit before anyone else.',
    endingBeat:
      'Fen sits beside the open doorway with a LAST VISITOR card while Ora quietly reopens the queue.',
  },
  {
    channelNumber: 6_950_342_178,
    channelName: 'Agreement Renewal Network',
    programmeTitle: 'I Understand Extends the Trial',
    format: 'shopping',
    realityId: 'VECTOR-APOLOGY-71',
    visualStyle: 'corporate_vector_subscription_webinar',
    visualMedium: 'corporate_vector',
    castArchetype: 'humanoid',
    pacing: 'slow_burn',
    storyMode: 'semantic_contract',
    premise:
      'In a corporate-vector shopping webinar, host Dena wants customer Kori to buy an apology subscription, but Kori refuses because saying I understand contractually renews it for the next disagreement.',
    tone: ['polished', 'patient', 'contractually tense'],
    dialogue: [
      {
        speaker: 'Dena',
        text: 'Your first apology arrives fully formatted.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Kori',
        text: 'I do not want automatic renewal.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Dena',
        text: 'Simply avoid saying I understand.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Kori',
        text: 'I understand the cancellation rule.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Dena',
        text: 'Thank you for renewing.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Kori',
        text: 'I reject my understanding.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Saying I understand renews an Agreement Network apology subscription.',
    endingBeat:
      'Dena adds NEXT DISAGREEMENT to the receipt while Kori studies a card reading PLEASE REMAIN CONFUSED.',
  },
  {
    channelNumber: 8_883_107_426,
    channelName: 'Soft Crumb Workplace',
    programmeTitle: 'Please Correct the Icing Again',
    format: 'sitcom',
    realityId: 'CLAY-BAKERY-88',
    visualStyle: 'claymation_bakery_floor_comedy',
    visualMedium: 'claymation',
    castArchetype: 'humanoid',
    pacing: 'frantic',
    storyMode: 'visual_physics',
    premise:
      'In a claymation bakery workplace, baker Luma wants to present a straight celebration loaf, but each spoken correction moves its icing farther toward the critic.',
    tone: ['tactile', 'competitive', 'increasingly tilted'],
    dialogue: [
      {
        speaker: 'Luma',
        text: 'The icing is perfectly level.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Pell',
        text: 'The left edge looks low.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Luma',
        text: 'Please correct the right edge instead.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Pell',
        text: 'Now it leans toward me.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Luma',
        text: 'Stand on the opposite side.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Pell',
        text: 'The icing is following criticism.',
        action: 'REACTION_SHOCKED',
      },
      {
        speaker: 'Luma',
        text: 'Then compliment it from the doorway.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Pell',
        text: 'I admire its independent angle.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Soft Crumb icing leans toward whoever corrects it aloud.',
    endingBeat:
      'Luma presents the leaning loaf beside a card that credits Pell as structural criticism.',
  },
  {
    channelNumber: 7_827_466_590,
    channelName: 'Pencil Line Newsroom',
    programmeTitle: 'Carry in the Correction',
    format: 'news',
    realityId: 'DRAWN-NEWS-14',
    visualStyle: 'hand_drawn_correction_bulletin',
    visualMedium: 'hand_drawn',
    castArchetype: 'paper_puppets',
    pacing: 'staccato',
    storyMode: 'format_literalism',
    premise:
      'During a hand-drawn arts bulletin, anchor Miro wants a live correction, but reporter Sava refuses because every correction box must be carried into the drawing before it can be read.',
    tone: ['serious', 'sketched', 'physically editorial'],
    dialogue: [
      {
        speaker: 'Miro',
        text: 'We misspelled the gallery name.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Sava',
        text: 'The correction box remains outside frame.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Miro',
        text: 'Please read it from there.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Sava',
        text: 'It is not yet drawn journalism.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Miro',
        text: 'Carry in the smallest correction.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Sava',
        text: 'That correction concerns our available strength.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Pencil Line corrections must enter the drawing before broadcast.',
    endingBeat:
      'Sava carries a tiny correction box beside the misspelled gallery while the larger apology waits beyond the frame.',
  },
  {
    channelNumber: 9_471_205_884,
    channelName: 'Cold Desk Notices',
    programmeTitle: 'The Complaint Must Stay Frozen',
    format: 'public_access',
    realityId: 'FREEZER-CIVIC-04',
    visualStyle: 'photographic_freezer_civic_cutout',
    visualMedium: 'collage_zine',
    castArchetype: 'humanoid',
    pacing: 'slow_burn',
    storyMode: 'visual_physics',
    premise:
      'At a photographic civic complaint desk inside a freezer aisle, resident Ilo wants clerk Mara to approve a melted apology, but expressing sympathy changes the evidence from valid to invalid.',
    tone: ['cold', 'bureaucratic', 'quietly considerate'],
    dialogue: [
      {
        speaker: 'Ilo',
        text: 'The apology was solid when it arrived.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Mara',
        text: 'Please place the remaining apology under the glass cover.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Ilo',
        text: 'I am sorry that it melted.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Mara',
        text: 'That sympathy has warmed the evidence by two degrees.',
        action: 'REACTION_NEUTRAL',
      },
      {
        speaker: 'Ilo',
        text: 'I withdraw my concern for its condition.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Mara',
        text: 'Good. The complaint is becoming firm again.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Cold Desk complaint evidence warms whenever sympathy is expressed.',
    endingBeat:
      'Mara and Ilo face the evidence in complete unsympathetic silence while the temperature display slowly returns to valid.',
  },
  {
    channelNumber: 9_908_441_307,
    channelName: 'Forecast Filing Department',
    programmeTitle: 'Cloud Three Is Off Duty',
    format: 'news',
    realityId: 'WEATHER-FILE-33',
    visualStyle: 'glossy_3d_weather_plate_with_drawn_cast',
    visualMedium: 'collage_zine',
    castArchetype: 'geometric_aliens',
    pacing: 'interrupted',
    storyMode: 'visual_physics',
    premise:
      "At a glossy plastic weather archive, anchor Sol wants to forecast clear skies, but opening a cloud's tiny door moves its stored weather into the studio until someone closes it from inside.",
    tone: ['official', 'toy-like', 'increasingly damp'],
    dialogue: [
      {
        speaker: 'Sol',
        text: 'Clear skies are filed for the afternoon.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Nera',
        text: 'Cloud Three has opened its staff entrance.',
        action: 'LOOK_AT',
      },
      {
        speaker: 'Sol',
        text: 'Close the cloud before the forecast notices.',
        action: 'REACTION_ANGRY',
      },
      {
        speaker: 'Nera',
        text: 'The handle is on the rainy side.',
        action: 'REACTION_CONFUSED',
      },
      {
        speaker: 'Sol',
        text: 'Then report from inside the cloud.',
        action: 'POINT_AT',
      },
      {
        speaker: 'Nera',
        text: 'I am already tomorrow in there.',
        action: 'FREEZE',
      },
    ],
    continuityFact: 'Opening an archive cloud door releases its stored weather into the studio.',
    endingBeat:
      'Sol continues the clear-sky forecast while Nera waves from behind the closed rain door.',
  },
] satisfies GeneratedSegmentDraft[];

export const signalSurfDrafts = drafts.map((draft) => generatedSegmentDraftSchema.parse(draft));
