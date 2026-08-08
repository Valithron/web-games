export const GREENHOLD_STORY = {
  start: "intro",
  nodes: {
    intro: {
      title: "A Place in the Margin",
      text: [
        "You come to Greenhold with sound boots, a light purse, and no one waiting for you. The barony is short of hands, which gives a stranger a fair chance.",
        "The barony lies in a broad green basin beneath forested ridges. The castle, market, orchards, mills, and roads are all busy at once. Lord Ryan is keeping his first autumn accounts as Baron, and the household needs another pair of hands."
      ],
      choices: [
        { text: "Offer your help in the records room", next: "arrival", effects: { flags: ["metGabi"], rel: { Gabi: 1 } } },
        { text: "Ask where the watch needs you", next: "arrival", effects: { flags: ["metSterling"], rel: { Sterling: 1 } } },
        { text: "Follow the lively young lady toward the market", next: "arrival", effects: { flags: ["metAshley"], rel: { Ashley: 1 } } }
      ]
    },

    arrival: {
      title: "The First Small Duty",
      text: [
        "By noon, you have no title and no proper place in the household, but you have already been given work. In Greenhold, that is close enough to an invitation.",
        "Lady Gabi is sorting household tallies with the calm of a woman who has already solved three problems and is waiting for the fourth to confess. Sir Sterling is watching the eastern gate. Lady Ashley is quietly rearranging the market schedule while pretending she is only reading it."
      ],
      choices: [
        { text: "Sit with Gabi and compare the road accounts", next: "recordsWithGabi", effects: { flags: ["metGabi", "recordsInterest"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } },
        { text: "Join Sterling at the gate and ask about the road", next: "gateWithSterling", effects: { flags: ["metSterling", "roadInterest"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Help Ashley untangle the market schedule", next: "marketWithAshley", effects: { flags: ["metAshley", "scheduleInterest"], rel: { Ashley: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    recordsWithGabi: {
      title: "The Keeper of the Household",
      text: [
        "Gabi gives you a stack of road-maintenance entries and a narrower stack of receipts. The first stack is dull in the respectable way. The second is dull in the suspicious way, with three payments to the Ash Bridge Wayhouse despite the wayhouse being listed as abandoned two years ago.",
        "Gabi does not dramatize the discrepancy. She places one finger on the repeated seal and says, 'If this is an error, it has been remarkably punctual.'"
      ],
      choices: [
        { text: "Ask who approved the payments", next: "ledgerReview", effects: { flags: ["paymentClue"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } },
        { text: "Ask Gabi to show you the supply records as well", next: "ledgerReview", effects: { flags: ["supplyClue"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    gateWithSterling: {
      title: "The Eastern Gate",
      text: [
        "Sir Sterling watches the east road with the patience of a man who has already imagined every bad outcome and is now waiting to see which one has the courtesy to arrive. He points out that the road is busy for harvest season, but the small wayhouse beyond Ash Bridge has seen no registered keeper since the roof fell in.",
        "'Road offices do not usually spend money on empty roofs,' he says. 'Usually.'"
      ],
      choices: [
        { text: "Ask what would make an empty wayhouse useful", next: "ledgerReview", effects: { flags: ["roadClue"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Ask Sterling to show you the safest approach to Ash Bridge", next: "ledgerReview", effects: { flags: ["safeRoute"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    marketWithAshley: {
      title: "A Schedule with Too Many Hands",
      text: [
        "Lady Ashley has discovered that two grain carts, a load of lamp oil, and a tournament judge are all expected at the same gate at the same hour. She is younger than everyone pretending not to need her, which means she has already noticed more than they have.",
        "When you point out that the oil receipt bears the same faded mark as a wayhouse payment, Ashley's expression sharpens. Her delight in a pattern is sincere. So is her hope that someone will let her follow it."
      ],
      choices: [
        { text: "Give Ashley the credit and ask what she sees", next: "ledgerReview", effects: { flags: ["scheduleClue", "ashleyInterest"], rel: { Ashley: 2 }, vars: { clueCount: 1 } }, requires: { flags: ["genderMale"] } },
        { text: "Ask Ashley to mark every matching receipt", next: "ledgerReview", effects: { flags: ["scheduleClue"], rel: { Ashley: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    ledgerReview: {
      title: "The Quiet Ledger",
      text: [
        "The payments are modest: nails, lamp oil, oats, and a few pence for cart repair. None could fund a rebellion. Together they describe a place that someone has expected to remain useful, and an office that has continued to pay for it while pretending not to know why.",
        "Gabi finds two missing letters from the same season. Sterling finds a road seal pressed into a wax scrap that does not belong to the current clerk. Ashley finds that the entries stop whenever a particular hand takes leave. A small matter has acquired the shape of deliberate work."
      ],
      choices: [
        { text: "Take the discrepancy directly to Ryan", next: "ryanBrief", effects: { flags: ["approachedRyan"], rel: { Ryan: 1 } } },
        { text: "Ask Kenly how a court would read the missing correspondence", next: "kenlyHall", effects: { flags: ["approachedKenly"], rel: { Kenly: 1 } } },
        { text: "Ask Cydney what a foreign merchant would notice here", next: "cydneyCorrespondence", effects: { flags: ["approachedCydney"], rel: { Cydney: 1 } } }
      ]
    },

    ryanBrief: {
      title: "The Baron Reads the Margin",
      text: [
        "Ryan listens without interrupting. He is twenty-nine, in his first year as Baron, and has the steady concentration of a former steward who knows that a problem becomes more expensive each time it is politely postponed.",
        "'My title is secure,' he says before you can ask. 'Witnessed, recorded, confirmed, and paid for in all the dull ways the Crown prefers. Whoever is doing this need not defeat my succession. They need only make my first year look careless.'"
      ],
      choices: [
        { text: "Ask for permission to inspect the old records", next: "inquiryPlan", effects: { flags: ["ryanPermission"], rel: { Ryan: 1 }, vars: { clueCount: 1 } } },
        { text: "Ask what the former baron's son knew of the eastern road", next: "inquiryPlan", effects: { flags: ["heirLead"], rel: { Ryan: 1 }, vars: { clueCount: 1 } } },
        { text: "Tell Ryan you will find the practical failure before it becomes public", next: "inquiryPlan", effects: { flags: ["earnedRyanTrust"], rel: { Ryan: 2 }, vars: { clueCount: 1 } }, requires: { flags: ["genderFemale"] } }
      ]
    },

    kenlyHall: {
      title: "Precedence and Other Weapons",
      text: [
        "Lady Kenly receives the question in a side hall where the portraits are expensive enough to have opinions. She is gracious with the absent letters, then becomes very precise. A missing document is not proof of guilt, but a missing document from a chain of obligations is an invitation for someone else to write the story.",
        "'If you accuse the wrong person in public,' she says, 'you will make the truth defend itself against your manners. It is a tiring arrangement for everyone.'"
      ],
      choices: [
        { text: "Ask Kenly to help you identify who could be summoned without insult", next: "inquiryPlan", effects: { flags: ["courtLead"], rel: { Kenly: 1 }, vars: { clueCount: 1 } } },
        { text: "Share a private joke about portraits and ask for her honest reading", next: "inquiryPlan", effects: { flags: ["courtLead", "kenlyInterest"], rel: { Kenly: 2 }, vars: { clueCount: 1 } }, requires: { flags: ["genderMale"] } }
      ]
    },

    cydneyCorrespondence: {
      title: "A Foreign Eye",
      text: [
        "Lady Cydney reads the copy of the wayhouse entry twice. She comes from Avarra, where lineage, faith, commerce, and office are braided so tightly that a merchant's courtesy can carry the weight of a letter sealed in wax.",
        "'An abandoned wayhouse is not necessarily empty,' she says. 'It may be a place where people prefer not to be seen arriving. That does not make it sinister. It makes it worth counting who benefits from the quiet.'"
      ],
      choices: [
        { text: "Ask Cydney to compare the seal with Avarran trade marks", next: "inquiryPlan", effects: { flags: ["foreignLead"], rel: { Cydney: 1 }, vars: { clueCount: 1 } } },
        { text: "Tell Cydney you would rather hear her judgment than flatter her expertise", next: "inquiryPlan", effects: { flags: ["foreignLead", "cydneyInterest"], rel: { Cydney: 2 }, vars: { clueCount: 1 } }, requires: { flags: ["genderMale"] } }
      ]
    },

    inquiryPlan: {
      title: "Four Ways to Be Sensible",
      text: [
        "The first impulse is to search everything. Gabi objects that searching everything is how a person loses the one paper that matters. Ryan agrees, which is how you learn that his barony is governed by people disagreeing usefully.",
        "There are several places to begin: the archive, the supply stores, the clerk's pattern of absences, or the road itself. The choice will not decide the truth, but it will decide who first decides whether to trust you."
      ],
      choices: [
        { text: "Follow the formal archive trail", next: "archiveMeasured", effects: { flags: ["formalTrail"] } },
        { text: "Search the restricted bundle without waiting for a second order", next: "archiveUnauthorized", effects: { flags: ["impatientTrail"], vars: { danger: 1 } } },
        { text: "Trace supplies through Gabi's stores", next: "gabiStorehouse", effects: { flags: ["supplyTrail"] } },
        { text: "Have Ashley chart the recurring names and dates", next: "ashleyPattern", effects: { flags: ["patternTrail"] } },
        { text: "Ask Sterling to test the road story against the watch logs", next: "sterlingQuestion", effects: { flags: ["watchTrail"] } }
      ]
    },

    archiveMeasured: {
      title: "Dust in Order",
      text: [
        "The formal archive is kept in a chamber that smells of dust, beeswax, and an argument no one has finished having. Gabi provides the keys. Ryan provides the authority. Ashley provides a list of dates so exact that even the archive clerk stops pretending this is routine.",
        "The payments correspond to the first year after the former baron's son died. A road order was issued then, but the file containing its purpose has been removed from the bundle."
      ],
      choices: [
        { text: "Ask Ashley to compare the surviving entries", next: "ashleyPattern", effects: { flags: ["heirLead", "patternTrail"], rel: { Ashley: 1 }, vars: { clueCount: 1 } } },
        { text: "Record the gap and request the restricted bundle", next: "archiveUnauthorized", effects: { flags: ["heirLead"], vars: { clueCount: 1 } } },
        { text: "Pause and ask Gabi who last handled the file", next: "gabiStorehouse", effects: { flags: ["heirLead"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    archiveUnauthorized: {
      title: "The Drawer with No Dust",
      text: [
        "The restricted bundle is in a drawer that has been opened recently. The lock is old. The scrape beside it is new. Inside, you find a copied road order, a torn memorandum, and the impression of a seal whose face has been filed just enough to hide a name.",
        "Someone has not merely omitted a letter. Someone has been curating the omissions."
      ],
      choices: [
        { text: "Handle the papers carefully and send for Ryan", next: "archiveTrap", effects: { flags: ["forgedSeal", "carefulEvidence"], rel: { Ryan: 1 }, vars: { clueCount: 2 } } },
        { text: "Take the seal impression and pursue the clerk immediately", next: "archiveTrap", effects: { flags: ["forgedSeal", "clerkPressed"], vars: { clueCount: 1, danger: 1 } } },
        { text: "Put everything back and pretend you saw nothing", next: "packetLie", effects: { flags: ["withheldEvidence"] } }
      ]
    },

    archiveTrap: {
      title: "A Door That Should Have Stayed Open",
      text: [
        "The archive clerk returns before Ryan does. He is a narrow man named Oren Vale, and he is carrying no book, no key, and no reason to be in the chamber. He smiles when he sees the drawer open.",
        "'You are new,' he says. It is not a question. Somewhere beyond the wall, a bar drops into place."
      ],
      choices: [
        { text: "Call out for the watch and keep the evidence in view", next: "gatherFacts", effects: { flags: ["clerkExposed", "carefulEvidence"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Confront Oren alone and block the door", next: "death", effects: { flags: ["archiveCarelessness"] } }
      ]
    },

    gabiStorehouse: {
      title: "What the Stores Remember",
      text: [
        "Gabi leads you through the stores, where every sack, barrel, and bundle has a place because someone has suffered the consequences of there not being one. The wayhouse received lamp oil and oats after it was supposedly abandoned, but never enough for a permanent garrison.",
        "The quantities are suited to passing people, not settled ones. Gabi finds the same carrier's mark on three deliveries. She also finds that the carrier was paid by a road tollman named Hobb."
      ],
      choices: [
        { text: "Ask Gabi to trace the carrier's delivery days", next: "gatherFacts", effects: { flags: ["hobbLead", "carrierLead"], rel: { Gabi: 1 }, vars: { clueCount: 2 } } },
        { text: "Ask who in Greenhold remembers the wayhouse before its closure", next: "localWitness", effects: { flags: ["witnessLead"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    ashleyPattern: {
      title: "A Pattern Worth Protecting",
      text: [
        "Ashley spreads the entries across a table and turns them into a timeline. Her work reveals that the payments rise whenever eastern merchants use the road heavily, then fall again before anyone could call them a standing levy.",
        "She is pleased until she realizes the pattern points toward an old road office established by the former baron's son. Then she becomes serious. 'If I am right, someone has been using a dead man's order as cover for a living arrangement.'"
      ],
      choices: [
        { text: "Tell Ashley her pattern is the heart of the inquiry", next: "gatherFacts", effects: { flags: ["patternProof", "ashleyInterest"], rel: { Ashley: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } },
        { text: "Ask Ashley to make a clean copy before anyone sees the original", next: "gatherFacts", effects: { flags: ["patternProof"], rel: { Ashley: 1 }, vars: { clueCount: 2 } } },
        { text: "Ask whether the pattern could still be innocent", next: "archiveUnauthorized", effects: { flags: ["patternProof"], rel: { Ashley: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    sterlingQuestion: {
      title: "The Watch Has a Memory",
      text: [
        "Sterling compares the road logs with the payment dates. He finds a recurring gap at dusk, when one watch changes and another has not yet arrived. Nothing crossed the gate under the wayhouse's name, but several carts were allowed through under private escort.",
        "'The safe explanation is that the watch was lazy,' Sterling says. 'The less safe explanation is that someone knew exactly when laziness would be useful.'"
      ],
      choices: [
        { text: "Tell Sterling his caution has kept this from becoming a rumor", next: "gatherFacts", effects: { flags: ["watchProof", "sterlingInterest"], rel: { Sterling: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderFemale"] } },
        { text: "Ask Sterling to mark the gaps on a road map", next: "gatherFacts", effects: { flags: ["watchProof"], rel: { Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Insist that you can reach Ash Bridge before nightfall", next: "riverRoad", effects: { flags: ["watchProof", "rashPlan"], rel: { Sterling: -1 }, vars: { danger: 1 } } }
      ]
    },

    gatherFacts: {
      title: "The Matter Gains a Name",
      text: [
        "By late afternoon, the inquiry has acquired three names: the Ash Bridge payments, the missing road order, and Hobb's carrier mark. The names are not yet a case, but they are enough to make several people stop speaking when you enter a room.",
        "Ryan wants facts before accusations. Gabi wants the household protected from embarrassment. Sterling wants to know who can be trusted on the road. The others have begun offering help, which is flattering and potentially dangerous."
      ],
      choices: [
        { text: "Find the local person who remembers the old wayhouse", next: "localWitness", effects: { flags: ["witnessLead"] } },
        { text: "Go east while the weather still holds", next: "riverRoad", effects: { flags: ["roadMission"] } },
        { text: "Ask Cydney to identify the merchant connections first", next: "cydneyMerchant", effects: { flags: ["merchantMission"] } }
      ]
    },

    localWitness: {
      title: "The Woman Who Stayed",
      text: [
        "Gabi locates Mara Bell, the former keeper of Ash Bridge Wayhouse, living above a cooper's yard in the market town. Mara left the wayhouse when the roof was condemned, but she did not leave the road's memory behind.",
        "She will speak only if you promise not to turn her into a public accusation before she can get her grandchildren out of the eastern villages. Gabi calls this a reasonable condition. Sterling calls it a security problem. Both are correct."
      ],
      choices: [
        { text: "Promise protection and take Mara's account quietly", next: "riverRoad", effects: { flags: ["livingWitness", "witnessProtected"], rel: { Gabi: 1, Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Ask Kenly to arrange a discreet legal summons", next: "kenlyAssembly", effects: { flags: ["livingWitness", "witnessSummons"], rel: { Kenly: 1 }, vars: { clueCount: 1 } } },
        { text: "Tell Mara she must speak publicly or not at all", next: "riverRoad", effects: { flags: ["livingWitness", "witnessCornered"], rel: { Gabi: -1 }, vars: { clueCount: 1 } } }
      ]
    },

    riverRoad: {
      title: "Eastward before the Rain",
      text: [
        "The eastern road runs between hedges and wet fields before climbing toward the forested shoulder of the basin. Rain is gathering above the ridges. Greenhold's roads are not merely lines on a map; they are agreements between bridges, mills, watch posts, tenants, and the weather.",
        "You can take the official road with Sterling, cut over the quarry ridge with Cooper, or travel under merchant cover arranged by Cydney. Each route reaches Ash Bridge. They will not all reach it in the same condition."
      ],
      choices: [
        { text: "Take the official road with Sterling", next: "wayhouseApproach", effects: { flags: ["safeRoute"], rel: { Sterling: 1 }, vars: { danger: 0 } } },
        { text: "Take Cooper's difficult ridge route", next: "cooperRoute", effects: { flags: ["ridgeRoute"], rel: { Cooper: 1 }, vars: { danger: 1 } } },
        { text: "Travel with the next merchant convoy", next: "cydneyMerchant", effects: { flags: ["merchantCover"], rel: { Cydney: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    cooperRoute: {
      title: "The Route Cooper Calls Easy",
      text: [
        "Sir Cooper meets you with a horse, a rope, and the expression of a man who has been waiting for someone to appreciate a bad idea. He knows a quarry path that avoids the washed section of the eastern road and reaches the bridge from above.",
        "'It is not dangerous,' he says. Then, after considering the cliff, 'Dangerous? It is not dangerous in a memorable way.'"
      ],
      choices: [
        { text: "Let Cooper lead, keep the rope ready, and follow the marked path", next: "wayhouseApproach", effects: { flags: ["ridgeArrival", "cooperInterest"], rel: { Cooper: 2 }, vars: { clueCount: 1 } }, requires: { flags: ["genderFemale"] } },
        { text: "Let Cooper lead without questioning his judgment", next: "wayhouseApproach", effects: { flags: ["ridgeArrival"], rel: { Cooper: 1 }, vars: { clueCount: 1 } } },
        { text: "Race ahead to reach the wayhouse before the others", next: "death", effects: { flags: ["ridgeCarelessness"] } }
      ]
    },

    cydneyMerchant: {
      title: "A Convoy with Good Manners",
      text: [
        "Cydney places you beside a wool merchant and introduces you as a clerk who has become inconveniently interested in road repairs. The merchant does not ask questions. He has the expression of a man who has profited from other people's discretion.",
        "Cydney learns that two eastern caravans were told to wait at Ash Bridge for a message that never came. One caravan changed course toward a neighboring lord's lands. The other paid an unfamiliar escort to continue."
      ],
      choices: [
        { text: "Ask Cydney what kind of escort would charge for silence", next: "wayhouseApproach", effects: { flags: ["merchantLead", "cydneyInterest"], rel: { Cydney: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } },
        { text: "Record the convoy names and continue under cover", next: "wayhouseApproach", effects: { flags: ["merchantLead"], rel: { Cydney: 1 }, vars: { clueCount: 2 } } }
      ]
    },

    wayhouseApproach: {
      title: "Ash Bridge",
      text: [
        "Ash Bridge crosses a cold river beneath a steep bank. The wayhouse stands beyond it, roofless on one side and occupied on the other. Smoke rises from a repaired chimney. An abandoned place has no business making tea.",
        "You see one cart behind the building, its wheels muddy from the eastern track. There is also a fresh boot print where the road office seal has been painted over."
      ],
      choices: [
        { text: "Approach openly under Ryan's road authority", next: "wayhouseDoor", effects: { flags: ["openApproach"], rel: { Ryan: 1 } } },
        { text: "Circle behind the wayhouse and enter through the broken side", next: "wayhouseSide", effects: { flags: ["hiddenApproach"], vars: { danger: 1 } } }
      ]
    },

    wayhouseDoor: {
      title: "A Tenant Who Was Not There",
      text: [
        "A man opens the door, sees the road seal, and becomes briefly more honest than he intended. His name is Perrin. He claims to rent the building from no one, keep no records, and receive no visitors.",
        "Behind him, a table holds two cups, a fresh ledger, and a bundle of letters tied with the sort of care people use when they expect to burn something later."
      ],
      choices: [
        { text: "Ask Perrin to step aside while you inspect the table", next: "wayhouseSearch", effects: { flags: ["perrinLocated"], rel: { Sterling: 1 } } },
        { text: "Offer Perrin a chance to explain before the watch arrives", next: "wayhouseWitness", effects: { flags: ["perrinSoftened"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    wayhouseSide: {
      title: "The Quiet Entrance",
      text: [
        "The broken side opens into a store room. You find lamp oil, a Crown road marker, and a ledger hidden beneath a sack of oats. You also find a string tied across the inner passage at knee height, which is the sort of practical warning that makes you miss the person who tied it.",
        "A board creaks in the next room. Whoever is there has heard you."
      ],
      choices: [
        { text: "Step back and call for the others", next: "wayhouseSearch", effects: { flags: ["hiddenEvidence", "carefulEvidence"], rel: { Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Cross the passage before the occupant can flee", next: "wayhouseSearch", effects: { flags: ["hiddenEvidence", "pressedEntry"], vars: { clueCount: 2, danger: 1 } } }
      ]
    },

    wayhouseSearch: {
      title: "The Ledger Beneath the Oats",
      text: [
        "The hidden ledger contains names, dates, and short marks beside the initials of merchants, couriers, and hired escorts. It does not describe a grand conspiracy. It describes a service: delay this cart, warn that rider, keep this letter until a messenger arrives.",
        "One page carries the former heir's road seal. The order is real. The entries beneath it are not."
      ],
      choices: [
        { text: "Read the ledger in place and preserve every page", next: "wayhouseWitness", effects: { flags: ["hiddenLedger", "carefulEvidence"], vars: { clueCount: 2 } } },
        { text: "Open the locked chest beside the hearth", next: "witnessThreat", effects: { flags: ["hiddenLedger", "chestOpened"], vars: { clueCount: 2, danger: 1 } } },
        { text: "Take only the page bearing the heir's seal", next: "wayhouseWitness", effects: { flags: ["hiddenLedger", "partialEvidence"], vars: { clueCount: 1 } } }
      ]
    },

    wayhouseWitness: {
      title: "Mara's Missing Name",
      text: [
        "Mara Bell is not at the wayhouse, but her name appears in the margin beside the first three payments. Perrin admits she kept the place after the former heir's death, though he insists she left no instructions behind.",
        "He is lying about one thing. He knows where Mara went, and he is frightened of the person who would learn that you know."
      ],
      choices: [
        { text: "Protect Perrin long enough to learn who threatened him", next: "witnessAccount", effects: { flags: ["perrinProtected", "livingWitness"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Tell Perrin the truth will protect him better than silence", next: "witnessAccount", effects: { flags: ["perrinPressed", "livingWitness"], rel: { Gabi: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    witnessAccount: {
      title: "What the Wayhouse Was For",
      text: [
        "Mara is found in a shepherd's hut above the river, where she has been hiding from the road. Her account is plain. The former baron's son established Ash Bridge as an emergency relay during wartime, so couriers and merchants could be moved safely through a district where banditry and border pressure were common.",
        "After his death, the office should have been reviewed and closed. Instead, clerk Oren Vale copied the old order, continued the payments, and sold information about road traffic to a hostile neighboring interest. Hobb, the tollman, carried the messages."
      ],
      choices: [
        { text: "Keep Mara concealed until Ryan can secure the road", next: "witnessThreat", effects: { flags: ["witnessAccount", "witnessProtected", "formerOrder"], rel: { Mara: 1, Ryan: 1 }, vars: { clueCount: 3 } } },
        { text: "Ask Mara to name the person who first recruited Oren", next: "compromisedToll", effects: { flags: ["witnessAccount", "formerOrder", "hobbLead"], rel: { Mara: 1 }, vars: { clueCount: 3 } } },
        { text: "Promise Mara that her testimony will be public immediately", next: "witnessThreat", effects: { flags: ["witnessAccount", "witnessExposed", "formerOrder"], rel: { Ryan: 1 }, vars: { clueCount: 3, danger: 1 } } }
      ]
    },

    witnessThreat: {
      title: "The Cost of Being Seen",
      text: [
        "Before the interview is finished, a rider appears on the road below. He does not approach the hut. He looks toward it, waits for the rain to cover his turn, and rides away.",
        "Mara recognizes the horse. Someone has been watching the people who remember the wayhouse. The old arrangement is no longer merely corrupt. It is being defended."
      ],
      choices: [
        { text: "Move Mara under Sterling's protection", next: "witnessEscape", effects: { flags: ["witnessProtected"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Send a message to Kenly and secure a legal witness chain", next: "compromisedToll", effects: { flags: ["witnessProtected", "witnessSummons"], rel: { Kenly: 1 }, vars: { clueCount: 1 } } },
        { text: "Follow the rider before he reaches the bridge", next: "death", effects: { flags: ["witnessCarelessness"] } }
      ]
    },

    witnessEscape: {
      title: "A Quiet Change of Road",
      text: [
        "Sterling moves Mara by a farm lane while Gabi arranges a room in a tenant's house that has no reason to attract attention. It is not dramatic. It is simply competent, which keeps the witness alive.",
        "Mara gives you one further detail. Hobb has been paid in clipped foreign coin, but the payment itself came through a local merchant who still has access to Greenhold's toll records."
      ],
      choices: [
        { text: "Ask Sterling to watch Hobb without alarming him", next: "compromisedToll", effects: { flags: ["witnessSafe", "hobbLead"], rel: { Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Ask Gabi to compare Hobb's payments with store deliveries", next: "compromisedToll", effects: { flags: ["witnessSafe", "hobbLead"], rel: { Gabi: 1 }, vars: { clueCount: 2 } } }
      ]
    },

    compromisedToll: {
      title: "The Honest-Looking Tollman",
      text: [
        "Hobb is a widower with clean boots, a clean ledger, and the particular manner of a man who has practiced being forgettable. He has indeed passed messages east. He claims he believed the payments were authorized road business.",
        "He is not the architect. He is the compromised secondary informant, useful because he knows the rhythm of the road and frightened because he knows who has been buying it."
      ],
      choices: [
        { text: "Watch Hobb until he leads you to the merchant", next: "tollConfront", effects: { flags: ["hobbWatched"], rel: { Sterling: 1 }, vars: { clueCount: 1 } } },
        { text: "Ask Kenly to make Hobb's testimony safe to receive", next: "kenlyAssembly", effects: { flags: ["hobbWatched", "witnessChain"], rel: { Kenly: 1 }, vars: { clueCount: 1 } } },
        { text: "Accuse Hobb at the tollhouse in front of travelers", next: "tollConfront", effects: { flags: ["hobbCornered"], rel: { Sterling: -1 }, vars: { clueCount: 1, danger: 1 } } }
      ]
    },

    tollConfront: {
      title: "The Tollhouse Door",
      text: [
        "Hobb meets the merchant after sunset at the tollhouse. The merchant is named Vey, a factor for a neighboring lord whose interest in eastern traffic is commercially reasonable and politically unfriendly.",
        "Hobb sees you first. For one moment, you have the advantage of surprise and the disadvantage of being alone."
      ],
      choices: [
        { text: "Offer Hobb protection in exchange for a complete account", next: "tollConfess", effects: { flags: ["hobbConfesses", "merchantLead"], rel: { Hobb: 1 }, vars: { clueCount: 2 } } },
        { text: "Step into the light and call Sterling's name", next: "tollConfess", effects: { flags: ["hobbConfesses", "merchantLead"], rel: { Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Follow Vey alone after he leaves the tollhouse", next: "death", effects: { flags: ["tollCarelessness"] } }
      ]
    },

    tollConfess: {
      title: "The Price of Silence",
      text: [
        "Hobb confesses that Vey paid him to mark merchants, couriers, and letters traveling east. Oren Vale altered the Greenhold records so the payments looked like ordinary upkeep. The purpose was not to seize Greenhold. It was to make its road office unreliable, then profit from the uncertainty.",
        "Hobb also names a meeting place in the market town. Vey's master will expect the next report before dawn."
      ],
      choices: [
        { text: "Have Cydney identify the outside interest's leverage", next: "cydneyForeignLead", effects: { flags: ["merchantConfession"], rel: { Cydney: 1 }, vars: { clueCount: 2 } } },
        { text: "Have Kenly build a lawful witness chain before the meeting", next: "kenlyAssembly", effects: { flags: ["merchantConfession", "witnessChain"], rel: { Kenly: 1 }, vars: { clueCount: 2 } } }
      ]
    },

    cydneyForeignLead: {
      title: "The Neighbor's Interest",
      text: [
        "Cydney recognizes the clipped coin and the factor's method. Vey is not acting for Avarra. He is working for Lord Veyron of the eastern marches, whose caravans have lost money since Greenhold's road office became more orderly under Ryan.",
        "The hostile interest wants Greenhold's authority weakened enough that merchants will buy private escorts and route information. It is a practical scheme, not a war. Practical schemes are often harder to notice until they have become expensive."
      ],
      choices: [
        { text: "Ask Cydney to write the foreign connection in her own hand", next: "ashleySchedule", effects: { flags: ["outsideInterest", "cydneyEvidence"], rel: { Cydney: 2 }, vars: { clueCount: 2 } } },
        { text: "Tell Cydney you trust her reading, even though it implicates a neighboring lord", next: "ashleySchedule", effects: { flags: ["outsideInterest", "cydneyEvidence", "cydneyInterest"], rel: { Cydney: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } }
      ]
    },

    kenlyAssembly: {
      title: "A Witness Chain with Polite Teeth",
      text: [
        "Kenly gathers statements without making the gathering look like an accusation. Mara's account, Hobb's confession, the carrier marks, and the forged seal are each copied, witnessed, and placed in separate hands.",
        "'The truth should survive the death of one paper,' Kenly says. 'Preferably it should also survive the impatience of one hero.' She looks at you when she says the last part, but not unkindly."
      ],
      choices: [
        { text: "Ask Kenly to stay beside you through the final hearing", next: "ashleySchedule", effects: { flags: ["witnessChain", "kenlyInterest"], rel: { Kenly: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } },
        { text: "Ask Kenly to make the copies impossible to dismiss as gossip", next: "ashleySchedule", effects: { flags: ["witnessChain"], rel: { Kenly: 1 }, vars: { clueCount: 2 } } }
      ]
    },

    ashleySchedule: {
      title: "The Day Arranged Against Itself",
      text: [
        "Ashley turns the evidence into a sequence of movements: Vey's report before dawn, Oren's access to the archive, Hobb's toll shift, and the next merchant convoy leaving at first light. Her schedule makes the threat visible because it gives every person a place where they can be intercepted or protected.",
        "She is also the first to see the cost. If you close the eastern road without a replacement escort, honest merchants will suffer alongside the dishonest ones. A neat solution can still be a bad administration."
      ],
      choices: [
        { text: "Put Ashley in charge of the convoy timing", next: "cooperChase", effects: { flags: ["scheduleProof", "ashleyInterest"], rel: { Ashley: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } },
        { text: "Ask Ashley to revise the schedule with Gabi's household limits", next: "cooperChase", effects: { flags: ["scheduleProof"], rel: { Ashley: 1, Gabi: 1 }, vars: { clueCount: 2 } } },
        { text: "Hide the schedule from Sterling so the plan remains quick", next: "chaseDanger", effects: { flags: ["scheduleProof", "withheldPlan"], rel: { Sterling: -1 }, vars: { clueCount: 1, danger: 1 } } }
      ]
    },

    cooperChase: {
      title: "The Last Report Before Dawn",
      text: [
        "Cooper takes the eastern track with two riders while Sterling secures the bridge and Gabi keeps the convoy from being stranded. The plan is not elegant. It is merely the sort of plan that includes food, horses, and a way home.",
        "Vey's messenger breaks from the market road toward the quarry. Cooper sees him first."
      ],
      choices: [
        { text: "Let Cooper lead the pursuit while you protect the evidence", next: "chaseSafe", effects: { flags: ["messengerCaught", "completeEvidence", "cooperInterest"], rel: { Cooper: 2 }, vars: { clueCount: 2 } }, requires: { flags: ["genderFemale"] } },
        { text: "Follow Cooper's route and keep the evidence together", next: "chaseSafe", effects: { flags: ["messengerCaught", "completeEvidence"], rel: { Cooper: 1 }, vars: { clueCount: 2 } } },
        { text: "Leave the evidence with the others and chase ahead alone", next: "chaseDanger", effects: { flags: ["messengerChase", "dangerousPursuit"], vars: { danger: 2 } } }
      ]
    },

    chaseSafe: {
      title: "A Messenger, Not a Monster",
      text: [
        "The messenger is a frightened young rider, not a hardened killer. Cooper catches him at the quarry path and brings him back with a bruised shoulder and a grievance about the fairness of hills.",
        "His packet contains Vey's report and a payment note from Lord Veyron's factor. It also contains Oren's instruction to keep the old heir's road order in force. The deception is now a chain with every link visible."
      ],
      choices: [
        { text: "Return to Greenhold with the packet and the prisoner", next: "returnCouncil", effects: { flags: ["completeEvidence", "messengerHeld"], rel: { Cooper: 1, Sterling: 1 }, vars: { clueCount: 2 } } },
        { text: "Ask Cooper to bring the messenger while you secure the next convoy", next: "returnCouncil", effects: { flags: ["completeEvidence", "convoyProtected"], rel: { Ashley: 1, Gabi: 1 }, vars: { clueCount: 2 } } }
      ]
    },

    chaseDanger: {
      title: "The Quarry Path Narrows",
      text: [
        "The quarry path narrows above the river. You can see the messenger's cloak ahead, but you cannot see who waits beyond him. Your horse is tiring. Your evidence is elsewhere. The practical difference between courage and vanity has become unpleasantly measurable.",
        "A shout rises from the trees. Someone has recognized you."
      ],
      choices: [
        { text: "Turn back and preserve the witnesses already gathered", next: "returnCouncil", effects: { flags: ["partialEvidence", "lostMessenger"], rel: { Sterling: 1 }, vars: { danger: 0 } } },
        { text: "Push across the quarry before they can surround you", next: "death", effects: { flags: ["quarryCarelessness"] } }
      ]
    },

    returnCouncil: {
      title: "The Table Before the Fire",
      text: [
        "Greenhold's council room is warmer than the quarry and less forgiving. Ryan sits at the head of the table. Gabi has brought the original accounts. Sterling has brought the watch logs. Ashley has brought a schedule that makes the whole affair look like a machine assembled by tired men.",
        "Cydney, Kenly, and Cooper add the pieces that money, precedence, and movement can reveal. No one has made you a hero. They have made you responsible for saying what the evidence does and does not prove."
      ],
      choices: [
        { text: "Present the complete chain, including the old heir's order", next: "ryanVulnerability", effects: { flags: ["completeEvidence"], rel: { Ryan: 1 } } },
        { text: "Present only the forged payments and protect the older history", next: "packetLie", effects: { flags: ["withheldHistory"], rel: { Ryan: -1 }, vars: { clueCount: 1 } } },
        { text: "Ask Ryan what he fears the truth will cost Greenhold", next: "ryanVulnerability", effects: { flags: ["completeEvidence"], rel: { Ryan: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    ryanVulnerability: {
      title: "The Baron and the Dead Heir",
      text: [
        "Ryan opens the old succession chest. Inside is the former baron's witnessed road instrument, signed by his dead son before the son left for war. It created the emergency relay system and required it to be reviewed after the war ended.",
        "'He was worthy,' Ryan says. 'That is why the order mattered. He was also dead. Someone decided that a dead man's useful work could be turned into a living man's private advantage.' Ryan's hand rests on the document. For the first time, he looks less like a baron being tested and more like a steward protecting someone else's work."
      ],
      choices: [
        { text: "Tell Ryan the lawful order should be honored and properly closed", next: "missingPacket", effects: { flags: ["formerOrder", "earnedRyanTrust"], rel: { Ryan: 2 }, vars: { clueCount: 2 } } },
        { text: "Meet Ryan's eyes and say that Greenhold is his to govern now", next: "missingPacket", effects: { flags: ["formerOrder", "earnedRyanTrust", "ryanInterest"], rel: { Ryan: 3 }, vars: { clueCount: 2 } }, requires: { flags: ["genderFemale"] } },
        { text: "Ask whether he can bear being compared with the dead", next: "gabiReconcile", effects: { flags: ["formerOrder"], rel: { Ryan: 1 }, vars: { clueCount: 1 } } }
      ]
    },

    gabiReconcile: {
      title: "The Work That Remains",
      text: [
        "Gabi finds the missing correspondence in a bundle of household letters that was misfiled after the former baron's funeral. It contains the review order, the list of witnesses, and a note from the former heir asking that the wayhouse be closed only after a reliable eastern escort had been established.",
        "'People call this a secret because they did not keep it where they could find it,' Gabi says. 'That is not the same thing. It is, however, just as troublesome.'"
      ],
      choices: [
        { text: "Ask Gabi to reconcile the old order with the current accounts", next: "missingPacket", effects: { flags: ["formerOrder", "correspondenceFound"], rel: { Gabi: 2 }, vars: { clueCount: 2 } } },
        { text: "Thank Gabi for finding what everyone else overlooked", next: "missingPacket", effects: { flags: ["formerOrder", "correspondenceFound", "gabiInterest"], rel: { Gabi: 3 }, vars: { clueCount: 2 } }, requires: { flags: ["genderMale"] } }
      ]
    },

    missingPacket: {
      title: "The Last Missing Piece",
      text: [
        "The file is almost complete, but one packet is still missing: the notice that should have transferred the road office from wartime emergency to ordinary Crown review. Without it, Oren can claim he was following a standing order. With it, his deception becomes unmistakable.",
        "The packet may be in the archive, with Vey's factor, or in the hands of someone who thought preserving it was the same as preserving Greenhold."
      ],
      choices: [
        { text: "Ask Cydney to inspect the foreign copies and seals", next: "packetRead", effects: { flags: ["packetSearch"], rel: { Cydney: 1 }, vars: { clueCount: 1 } } },
        { text: "Ask Ashley to compare every date against her schedule", next: "packetRead", effects: { flags: ["packetSearch"], rel: { Ashley: 1 }, vars: { clueCount: 1 } } },
        { text: "Trust the packet will surface and move to the hearing", next: "packetLie", effects: { flags: ["packetDeferred"], vars: { clueCount: 0 } } }
      ]
    },

    packetRead: {
      title: "The Review Notice",
      text: [
        "The packet is found inside a diplomatic copy Cydney had been carrying, because an Avarran clerk had copied the road order while assessing Greenhold's reliability. The review notice is plain: the emergency relay was to end after the war, and any continuation required fresh authority.",
        "Oren Vale forged the continuation. Vey bought the information. Hobb carried it. The former heir's lawful work was not the crime. The crime was using it as a mask."
      ],
      choices: [
        { text: "Ask everyone to prepare for a public hearing at once", next: "truthAssembly", effects: { flags: ["completeEvidence", "correspondenceFound"], rel: { Cydney: 1 }, vars: { clueCount: 3 } } },
        { text: "Read the notice privately with Ryan before announcing it", next: "truthAssembly", effects: { flags: ["completeEvidence", "correspondenceFound"], rel: { Ryan: 1 }, vars: { clueCount: 3 } } }
      ]
    },

    packetLie: {
      title: "A Conveniently Incomplete Account",
      text: [
        "You can still make a case from the forged payments, Hobb's role, and Vey's interest. You cannot honestly explain why the wayhouse existed in the first place, or why the former heir's seal appears beneath the corruption.",
        "Ryan understands the omission. So do Gabi and Kenly. The hearing can punish a clerk and close a road, but it may leave the deeper confusion intact."
      ],
      choices: [
        { text: "Admit that the account is incomplete and ask for time", next: "finalJudgment", effects: { flags: ["partialEvidence"], rel: { Ryan: 1 } } },
        { text: "Insist that the missing history is irrelevant", next: "finalJudgment", effects: { flags: ["partialEvidence", "withheldHistory"], rel: { Ryan: -1, Kenly: -1 }, vars: { danger: 1 } } }
      ]
    },

    truthAssembly: {
      title: "Every Hand on the Table",
      text: [
        "The complete account now fits together. Gabi establishes the payment trail. Ashley establishes the timing. Sterling establishes the watch gaps. Cooper establishes the courier route. Cydney establishes the outside commercial interest. Kenly establishes the witness chain. Ryan establishes the lawful history of the road office.",
        "The seven of them do not agree on every method, but they agree on what must not happen: Greenhold must not answer a private deception by destroying the public service honest travelers still need."
      ],
      choices: [
        { text: "Bring the evidence before the court and the merchants", next: "publicHearing", effects: { flags: ["completeEvidence", "truthReady"], rel: { Ryan: 1, Gabi: 1, Ashley: 1 } } },
        { text: "Confront Vey before he can leave the market", next: "hostileMove", effects: { flags: ["completeEvidence", "truthReady", "rushedHearing"], rel: { Cooper: 1 }, vars: { danger: 1 } } }
      ]
    },

    publicHearing: {
      title: "The Case in Public",
      text: [
        "The hearing is held in the market hall, where merchants, tenants, watchmen, and two offended gentlemen discover that a quiet ledger can attract a larger audience than a joust. Ryan presents the old road office without pretending it was his creation. Kenly presents the witnesses without humiliating them.",
        "When Oren is brought in, he tries to claim that he preserved the former heir's policy. Ashley places the review notice beside the forged continuation. The argument ends not with a confession, but with the much less theatrical collapse of a lie."
      ],
      choices: [
        { text: "Let Cydney answer Vey's commercial objection", next: "hostileMove", effects: { flags: ["truthReady"], rel: { Cydney: 1 } } },
        { text: "Let Sterling secure the hall while Ryan closes the road office", next: "hostileMove", effects: { flags: ["truthReady"], rel: { Sterling: 1 } } },
        { text: "Let Ashley explain the timetable and the practical replacement", next: "hostileMove", effects: { flags: ["truthReady"], rel: { Ashley: 1 } } }
      ]
    },

    hostileMove: {
      title: "The Price of an Answer",
      text: [
        "Lord Veyron's factor does not draw a sword. He threatens to withdraw eastern escorts, spread word that Greenhold cannot keep a road safe, and encourage merchants to bypass Ryan's authority. It is an attack made entirely of consequences.",
        "Ryan can close the compromised wayhouse and leave the road to fail, or he can replace the stolen service with a lawful one before the next convoy departs. The second choice requires trust, horses, witnesses, and someone willing to be seen carrying the responsibility."
      ],
      choices: [
        { text: "Build a lawful escort plan with Sterling, Gabi, and Ashley", next: "defenseChoice", effects: { flags: ["replacementPlan"], rel: { Sterling: 1, Gabi: 1, Ashley: 1 }, vars: { clueCount: 1 } } },
        { text: "Send Cooper to secure the bridge while Cydney negotiates with merchants", next: "defenseChoice", effects: { flags: ["replacementPlan"], rel: { Cooper: 1, Cydney: 1 }, vars: { clueCount: 1 } } },
        { text: "Close Ash Bridge and let the merchants choose their own risk", next: "finalJudgment", effects: { flags: ["roadClosed", "partialEvidence"], rel: { Ryan: -1 }, vars: { clueCount: 0 } } }
      ]
    },

    defenseChoice: {
      title: "The Road Must Still Work",
      text: [
        "The replacement is modest: a posted watch at Ash Bridge, a licensed wayhouse keeper, copied registers held in two places, and a clear review date. It is not glorious. It is exactly the kind of arrangement that prevents a barony from becoming a story told by people who used to trust it.",
        "The hostile factor makes one final attempt to break the plan. A cart blocks the bridge while hired men scatter the first escort. Someone must hold the line while the documents and witnesses reach the market hall."
      ],
      choices: [
        { text: "Trust Sterling's disciplined defense and keep the witnesses moving", next: "sealRoad", effects: { flags: ["roadSecured", "solved"], rel: { Sterling: 2 }, vars: { clueCount: 2 } } },
        { text: "Trust Cooper to clear the bridge and follow the lawful plan", next: "sealRoad", effects: { flags: ["roadSecured", "solved"], rel: { Cooper: 2 }, vars: { clueCount: 2 } } },
        { text: "Trust Cydney's merchant agreement and keep the road open", next: "sealRoad", effects: { flags: ["roadSecured", "solved"], rel: { Cydney: 2 }, vars: { clueCount: 2 } } },
        { text: "Rush into the blocked cart before anyone can stop you", next: "death", effects: { flags: ["bridgeCarelessness"] } }
      ]
    },

    finalJudgment: {
      title: "What Can Be Recorded",
      text: [
        "The council can record a partial truth: Oren falsified payments, Hobb passed information, and Lord Veyron's factor interfered with Greenhold's road. It cannot yet record the full history of the former heir's order or guarantee that the replacement service will work.",
        "Ryan asks what you recommend. A truthful incomplete record is better than a polished false one, but it will leave the road vulnerable and the old question alive."
      ],
      choices: [
        { text: "Record the partial truth and keep investigating", next: "unresolved", effects: { flags: ["aliveUnresolved"] } },
        { text: "Close the road office and call the matter settled", next: "unresolved", effects: { flags: ["aliveUnresolved", "roadClosed"] } },
        { text: "Try to force a complete confession from Vey's factor tonight", next: "death", effects: { flags: ["hearingCarelessness"] } }
      ]
    },

    sealRoad: {
      title: "A Better Ledger",
      text: [
        "By dawn, the old wayhouse is closed under lawful authority, the road remains open under a new escort, and the records exist in duplicate. Oren will face judgment. Hobb will testify under protection. Lord Veyron's factor will discover that Greenhold's quietness was never the same thing as helplessness.",
        "Ryan signs the replacement order. Gabi signs the supply schedule. Ashley signs the timetable. Sterling signs the watch rotation. Cooper signs the bridge report with an excessive account of the quarry. Cydney adds the merchant witness. Kenly adds the legal copies. The barony has not become perfect. It has become legible again."
      ],
      choices: [
        { text: "Stay in the hall after the others leave", next: "quietAfter", effects: { flags: ["solved", "roadSecured"], vars: { clueCount: 1 } } }
      ]
    },

    quietAfter: {
      title: "The Work After the Work",
      text: [
        "The first light reaches Greenhold's roofs. The crisis is finished, but the relationships formed inside it are not. People have seen you tired, stubborn, frightened, useful, and occasionally unwise. This is a more durable kind of introduction than arriving with a polished recommendation.",
        "You have earned the right to choose what you do with the trust that remains."
      ],
      choices: [
        { text: "Ask Cydney to walk the eastern road with you when it is safe", next: "commitCydney", effects: { flags: ["romanceCommit"], rel: { Cydney: 2 } }, requires: { flags: ["solved", "cydneyInterest", "genderMale"] } },
        { text: "Ask Gabi to share the next quiet morning with you", next: "commitGabi", effects: { flags: ["romanceCommit"], rel: { Gabi: 2 } }, requires: { flags: ["solved", "gabiInterest", "genderMale"] } },
        { text: "Ask Ashley to help plan the next public tournament", next: "commitAshley", effects: { flags: ["romanceCommit"], rel: { Ashley: 2 } }, requires: { flags: ["solved", "ashleyInterest", "genderMale"] } },
        { text: "Ask Kenly whether she would stay for the next hearing", next: "commitKenly", effects: { flags: ["romanceCommit"], rel: { Kenly: 2 } }, requires: { flags: ["solved", "kenlyInterest", "genderMale"] } },
        { text: "Ask Sterling to teach you the road watch properly", next: "commitSterling", effects: { flags: ["romanceCommit"], rel: { Sterling: 2 } }, requires: { flags: ["solved", "sterlingInterest", "genderFemale"] } },
        { text: "Ask Ryan what Greenhold will need from you next", next: "commitRyan", effects: { flags: ["romanceCommit"], rel: { Ryan: 2 } }, requires: { flags: ["solved", "ryanInterest", "genderFemale"] } },
        { text: "Ask Cooper to show you the route without pretending it is easy", next: "commitCooper", effects: { flags: ["romanceCommit"], rel: { Cooper: 2 } }, requires: { flags: ["solved", "cooperInterest", "genderFemale"] } },
        { text: "Return to your room and let the day remain what it was", next: "fine", effects: { flags: ["solved"] }, requires: { flags: ["solved"], notFlags: ["romanceCommit"] } }
      ]
    },

    commitCydney: {
      title: "A Road with Two Directions",
      text: [
        "Cydney accepts the invitation after making you wait long enough to understand that she is choosing, not merely agreeing. She still has a report to write for Avarra. You still have a life in Greenhold to build. Neither of you mistakes affection for the disappearance of duty.",
        "She touches the traveler's coin at her throat and says, 'We can see whether two roads can belong to the same future.'"
      ],
      choices: [{ text: "Begin the walk together", next: "good" }]
    },

    commitGabi: {
      title: "The Person Who Stayed",
      text: [
        "Gabi looks at you for a long moment, as if checking whether this is another promise made in the warm aftermath of a crisis. When you answer the practical questions before she asks them, her guardedness eases.",
        "There will be work tomorrow. There will also be breakfast, if you are willing to arrive before the household does."
      ],
      choices: [{ text: "Stay for breakfast", next: "good" }]
    },

    commitAshley: {
      title: "A Life with Useful Things in It",
      text: [
        "Ashley laughs first, then asks whether you are inviting her to plan a tournament or asking her to remain near you. When you admit that you mean both, she stops laughing long enough to believe you.",
        "She has a dozen improvements for the next event. You suspect she has been saving them. She takes your arm before beginning the first one."
      ],
      choices: [{ text: "Let her show you the schedule", next: "good" }]
    },

    commitKenly: {
      title: "A Deliberate Staying",
      text: [
        "Kenly's smile is small at first and then much larger than her face appears prepared to contain. She asks whether you understand what it means to invite a woman of her family into an uncertain future.",
        "You answer that you understand it means you will have to be honest, patient, and occasionally outmatched in conversation. Kenly considers this an acceptable beginning."
      ],
      choices: [{ text: "Offer her your hand", next: "good" }]
    },

    commitSterling: {
      title: "The Watch Kept Together",
      text: [
        "Sterling studies you as though this is a question about exits, weather, and whether you are likely to become someone else's responsibility. When you tell him you want to learn the road properly, he believes the practical part first.",
        "The personal part takes longer. That is fitting. Sterling has never trusted anything that arrives without having been tested."
      ],
      choices: [{ text: "Walk the eastern road beside him", next: "good" }]
    },

    commitRyan: {
      title: "The Baron at Dawn",
      text: [
        "Ryan does not answer quickly. He tells you what Greenhold needs, then what he needs, and the distinction is more vulnerable than any confession. He has spent years proving that he can carry responsibility. He has not often been asked whether someone would carry a little of it with him.",
        "When he finally reaches for your hand, it is with the careful confidence of a man making a lawful decision and a personal one at the same time."
      ],
      choices: [{ text: "Stand with Ryan as the household wakes", next: "good" }]
    },

    commitCooper: {
      title: "The Difficult Route",
      text: [
        "Cooper accepts your invitation with an expression of triumph that would be unbearable if it were not immediately undercut by his concern for whether you have eaten. He claims the ridge route is the best place to begin. You remind him that he called it easy.",
        "'Easy?' he repeats, offended by the record. Then he offers you the rope before taking the lead."
      ],
      choices: [{ text: "Take the rope and follow", next: "good" }]
    },

    good: {
      terminal: "good",
      title: "Greenhold, Made Legible",
      text: [
        "The road is secured, the quiet ledger is understood, and Greenhold's institutions have been repaired without pretending they were never vulnerable. You are still an ordinary newcomer. That is precisely why your choices matter.",
        "You leave the hall beside the person you chose, with work ahead, affection honestly earned, and a place in Greenhold that no longer feels temporary."
      ]
    },

    fine: {
      terminal: "fine",
      title: "A Good Record",
      text: [
        "The road is secured and the deception is exposed. Greenhold keeps its witnesses, its merchants, and its lawful memory. You have not promised yourself to anyone, which is not a failure. Some people need time before they call a place home.",
        "Ryan offers you continued work. Gabi offers you breakfast. Sterling offers you a better map. Ashley offers you three tournament schedules. Kenly offers you a knowing smile. Cydney offers a letter when she reaches Avarra. Cooper offers to show you the difficult route, which is somehow the least reassuring invitation."
      ]
    },

    unresolved: {
      terminal: "unresolved",
      title: "The Ledger Remains Open",
      text: [
        "Greenhold records what can be proved, but the road is weakened, the old order is still contested, and the full chain of responsibility remains out of reach. Oren's guilt is real. Vey's interference is real. The institutional failure between them is not yet repaired.",
        "You survive, and the people who trusted you do not call you a traitor. That is not the same as success. The eastern road will require another season, another witness, and perhaps another chance."
      ]
    },

    death: {
      terminal: "death",
      title: "A Consequence Earned",
      text: [
        "You act without the witnesses, the exit, the escort, or the evidence that would have made the risk bearable. The people who meant to stop the inquiry do not need a grand weapon. They need only the opening your carelessness gives them.",
        "Greenhold continues without you. The ledger is altered, the road remains uncertain, and those who loved or trusted you are left to understand that courage without judgment is merely another form of danger."
      ]
    }
  }
};
