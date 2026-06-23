/* =========================================================================
   FluoLingo · /f1/ (LAF1201) — Unit 0 content
   Single source of truth for every activity. Shape mirrors the content
   model in docs/UNIFIED-PORTAL-ARCHITECTURE.md so it can fold into the
   unified portal later.

   Each SIO:
     code, slug, title (fr), en
     learn:   { intro, ref: [{fr, en, ipa?}] }     // ref doubles as match pairs
     pretest: [{ q, options[], answer (index), why }]
     gapfill: [{ before, after, answer, hint, accept?[] }] | null   // no word bank
   ========================================================================= */
window.SIOS = [
  {
    code: "0.1", slug: "se-presenter",
    title: "Se présenter — s'appeler", en: "Introduce yourself: give your name",
    learn: {
      intro: "« S'appeler » is a pronominal verb: the pronoun changes with the subject (je → me, tu → te). Before a vowel it elides: me + appelle → m'appelle.",
      ref: [
        { fr: "Je m'appelle…", en: "My name is…", ipa: "/ʒə ma.pɛl/" },
        { fr: "Comment tu t'appelles ?", en: "What's your name? (informal)", ipa: "/kɔ.mɑ̃ ty ta.pɛl/" },
        { fr: "Comment vous appelez-vous ?", en: "What's your name? (formal)", ipa: "/kɔ.mɑ̃ vu.za.ple.vu/" },
        { fr: "Moi, c'est Léa.", en: "I'm Léa.", ipa: "/mwa sɛ le.a/" },
        { fr: "Enchanté(e) !", en: "Nice to meet you!", ipa: "/ɑ̃.ʃɑ̃.te/" }
      ]
    },
    pretest: [
      { q: "Complète : « Je ___ Marie. »", options: ["m'appelle", "appelle", "t'appelles", "s'appelle"], answer: 0,
        why: "Avec <b>je</b>, le pronom est <i>me</i> ; devant une voyelle il s'élide → <b>m'appelle</b>." },
      { q: "« ___ tu t'appelles ? »", options: ["Comment", "Qui", "Où", "Quand"], answer: 0,
        why: "On demande le nom avec <b>comment</b> : « Comment tu t'appelles ? »" },
      { q: "Version formelle de « What's your name? »", options: ["Comment vous appelez-vous ?", "Tu t'appelles comment ?", "Comment tu t'appelles ?", "C'est qui ?"], answer: 0,
        why: "Le vouvoiement utilise <b>vous</b> : « Comment vous appelez-vous ? »" },
      { q: "Une femme répond « pleased to meet you » :", options: ["Enchantée", "Enchanté", "Merci", "Bonjour"], answer: 0,
        why: "Accord au féminin : <b>enchantée</b> (avec -e)." }
    ],
    gapfill: [
      { before: "Je ", after: " Paul.", answer: "m'appelle", hint: "s'appeler, je", accept: ["mappelle"] },
      { before: "Comment tu ", after: " ?", answer: "t'appelles", hint: "s'appeler, tu", accept: ["tappelles"] },
      { before: "— Moi, ", after: " Léa.", answer: "c'est", hint: "« I'm… »", accept: ["cest"] }
    ]
  },
  {
    code: "0.2", slug: "alphabet",
    title: "L'alphabet — épeler", en: "Spell your name using the alphabet",
    learn: {
      intro: "Letters have French names. Watch the tricky ones (G/J swap, W, Y) and the accent names you'll need to spell aloud.",
      ref: [
        { fr: "G", en: "« gé »", ipa: "/ʒe/" },
        { fr: "J", en: "« ji »", ipa: "/ʒi/" },
        { fr: "W", en: "« double vé »", ipa: "/du.blə.ve/" },
        { fr: "Y", en: "« i grec »", ipa: "/i.ɡʁɛk/" },
        { fr: "é", en: "e accent aigu", ipa: "/e/" },
        { fr: "è", en: "e accent grave", ipa: "/ɛ/" },
        { fr: "ç", en: "c cédille", ipa: "/s/" }
      ]
    },
    pretest: [
      { q: "Comment dit-on « W » en français ?", options: ["double vé", "vé", "i grec", "iks"], answer: 0,
        why: "<b>W</b> = « double vé »." },
      { q: "« é » s'appelle…", options: ["e accent aigu", "e accent grave", "e accent circonflexe", "e tréma"], answer: 0,
        why: "L'accent qui monte vers la droite est l'<b>accent aigu</b>." },
      { q: "Quelle lettre se prononce /ʒi/ ?", options: ["J", "G", "I", "Y"], answer: 0,
        why: "<b>J</b> = /ʒi/, alors que G = /ʒe/. Attention au piège !" },
      { q: "« ç » s'appelle…", options: ["c cédille", "c accent", "esse", "ka"], answer: 0,
        why: "Le petit crochet sous le c est la <b>cédille</b>." }
    ],
    gapfill: [
      { before: "é = e accent ", after: ".", answer: "aigu", hint: "↗" },
      { before: "è = e accent ", after: ".", answer: "grave", hint: "↘" },
      { before: "ç = c ", after: ".", answer: "cédille", hint: "le crochet" }
    ]
  },
  {
    code: "0.3", slug: "auto-presentation",
    title: "Une courte présentation", en: "Write a short self-introduction",
    learn: {
      intro: "Use avoir for age (j'ai 19 ans), être for identity (je suis étudiant), à + city for where you live, and agree your nationality.",
      ref: [
        { fr: "J'ai 19 ans.", en: "I'm 19.", ipa: "/ʒe diz.nœf ɑ̃/" },
        { fr: "Je suis étudiant(e).", en: "I'm a student.", ipa: "/ʒə sɥi.z‿e.ty.djɑ̃/" },
        { fr: "Je suis singapourien(ne).", en: "I'm Singaporean.", ipa: "/sɛ̃.ɡa.pu.ʁjɛ̃/" },
        { fr: "J'habite à Singapour.", en: "I live in Singapore.", ipa: "/ʒa.bit a/" },
        { fr: "J'étudie le français.", en: "I study French.", ipa: "/ʒe.ty.di lə fʁɑ̃.sɛ/" }
      ]
    },
    pretest: [
      { q: "Complète : « J'___ 19 ans. »", options: ["ai", "suis", "as", "a"], answer: 0,
        why: "L'âge se dit avec <b>avoir</b> : j'<b>ai</b> 19 ans." },
      { q: "« Je ___ étudiante. »", options: ["suis", "ai", "es", "as"], answer: 0,
        why: "L'identité se dit avec <b>être</b> : je <b>suis</b> étudiante." },
      { q: "« J'habite ___ Singapour. » (ville/pays-ville)", options: ["à", "en", "au", "dans"], answer: 0,
        why: "Devant une ville, on emploie <b>à</b> : j'habite à Singapour." },
      { q: "Une femme dit sa nationalité :", options: ["Je suis singapourienne", "Je suis singapourien", "Je suis le Singapour", "J'ai singapourien"], answer: 0,
        why: "Accord au féminin : singapourien → <b>singapourienne</b>." }
    ],
    gapfill: [
      { before: "J'", after: " 20 ans.", answer: "ai", hint: "avoir, je" },
      { before: "Je ", after: " étudiant.", answer: "suis", hint: "être, je" },
      { before: "J'habite ", after: " Paris.", answer: "à", hint: "+ ville" },
      { before: "J'", after: " le français.", answer: "étudie", hint: "étudier, je", accept: ["etudie"] }
    ]
  },
  {
    code: "0.4", slug: "saluer",
    title: "Saluer et prendre congé", en: "Greet and take leave",
    learn: {
      intro: "Match the greeting to the moment: Bonjour by day, Bonsoir in the evening, Salut informally, and the right way to leave.",
      ref: [
        { fr: "Bonjour", en: "Hello / good day", ipa: "/bɔ̃.ʒuʁ/" },
        { fr: "Bonsoir", en: "Good evening", ipa: "/bɔ̃.swaʁ/" },
        { fr: "Salut", en: "Hi / bye (informal)", ipa: "/sa.ly/" },
        { fr: "Au revoir", en: "Goodbye", ipa: "/o.ʁə.vwaʁ/" },
        { fr: "À bientôt", en: "See you soon", ipa: "/a bjɛ̃.to/" },
        { fr: "Bonne nuit", en: "Good night (before sleep)", ipa: "/bɔn nɥi/" }
      ]
    },
    pretest: [
      { q: "Le soir, on dit…", options: ["Bonsoir", "Bonjour", "Bonne nuit", "Salut"], answer: 0,
        why: "Le soir : <b>Bonsoir</b>. « Bonne nuit » se dit avant de dormir." },
      { q: "« Bonne nuit » s'emploie…", options: ["avant de dormir", "le matin", "à midi", "pour saluer un inconnu"], answer: 0,
        why: "<b>Bonne nuit</b> = juste avant d'aller dormir, pas pour saluer en arrivant." },
      { q: "Un ami arrive. Façon informelle de dire « salut » :", options: ["Salut", "Bonjour madame", "Au revoir", "Enchanté"], answer: 0,
        why: "Entre amis : <b>Salut</b> (informel)." },
      { q: "Pour partir : « See you soon »", options: ["À bientôt", "Bonjour", "De rien", "S'il vous plaît"], answer: 0,
        why: "<b>À bientôt</b> = see you soon." }
    ],
    gapfill: [
      { before: "Le matin, on dit « ", after: " ».", answer: "bonjour", hint: "hello (day)" },
      { before: "Le soir, on dit « ", after: " ».", answer: "bonsoir", hint: "evening" },
      { before: "Pour partir : « Au ", after: " ».", answer: "revoir", hint: "goodbye" }
    ]
  },
  {
    code: "0.5", slug: "tu-vous",
    title: "Tu / vous et les salutations", en: "Use tu/vous; handle greeting customs",
    learn: {
      intro: "tu = informal (friends, peers, family). vous = formal or plural. Custom: la bise (cheek kisses) between friends/family; la poignée de main (handshake) in formal settings.",
      ref: [
        { fr: "tu", en: "you (informal)", ipa: "/ty/" },
        { fr: "vous", en: "you (formal / plural)", ipa: "/vu/" },
        { fr: "la bise", en: "cheek kiss(es)", ipa: "/la biz/" },
        { fr: "une poignée de main", en: "a handshake", ipa: "/pwa.ɲe/" },
        { fr: "tutoyer / vouvoyer", en: "to use tu / to use vous", ipa: "/ty.twa.je/" }
      ]
    },
    pretest: [
      { q: "Tu parles à ton professeur. Tu utilises…", options: ["vous", "tu", "toi", "il"], answer: 0,
        why: "Marque de respect / distance → <b>vous</b>." },
      { q: "Tu parles à un camarade de ton âge :", options: ["tu", "vous", "elle", "on"], answer: 0,
        why: "Entre pairs, on se tutoie → <b>tu</b>." },
      { q: "« La bise », c'est…", options: ["des bisous sur la joue", "une poignée de main", "un signe de la main", "une révérence"], answer: 0,
        why: "<b>La bise</b> = bisous sur la joue, entre proches." },
      { q: "À un entretien d'embauche, on se salue par…", options: ["une poignée de main", "la bise", "un câlin", "rien"], answer: 0,
        why: "En contexte professionnel : <b>une poignée de main</b>." }
    ],
    gapfill: [
      { before: "(à un ami) Comment ", after: " t'appelles ?", answer: "tu", hint: "informel" },
      { before: "(à un inconnu) Comment allez-", after: " ?", answer: "vous", hint: "formel" }
    ]
  },
  {
    code: "0.6", slug: "consignes",
    title: "Les consignes de classe", en: "Understand classroom instructions",
    learn: {
      intro: "Classroom instructions come in the imperative (vous form). Recognise them fast so you can act on them.",
      ref: [
        { fr: "Écoutez", en: "Listen", ipa: "/e.ku.te/" },
        { fr: "Répétez", en: "Repeat", ipa: "/ʁe.pe.te/" },
        { fr: "Lisez", en: "Read", ipa: "/li.ze/" },
        { fr: "Écrivez", en: "Write", ipa: "/e.kʁi.ve/" },
        { fr: "Ouvrez le livre", en: "Open the book", ipa: "/u.vʁe/" },
        { fr: "Levez la main", en: "Raise your hand", ipa: "/lə.ve la mɛ̃/" }
      ]
    },
    pretest: [
      { q: "« Répétez » veut dire…", options: ["repeat", "read", "write", "listen"], answer: 0,
        why: "<b>Répétez</b> = repeat." },
      { q: "Le prof dit « Ouvrez le livre ». Tu…", options: ["ouvres le livre", "fermes le livre", "te lèves", "écris"], answer: 0,
        why: "<b>Ouvrez</b> = open → tu ouvres le livre." },
      { q: "« Listen » se dit…", options: ["Écoutez", "Lisez", "Écrivez", "Regardez"], answer: 0,
        why: "<b>Écoutez</b> = listen." },
      { q: "« Levez la main » =", options: ["raise your hand", "sit down", "work in pairs", "be quiet"], answer: 0,
        why: "<b>Levez la main</b> = raise your hand." }
    ],
    gapfill: [
      { before: "« ", after: " le livre à la page 10. »", answer: "ouvrez", hint: "open" },
      { before: "Pour parler, ", after: " la main.", answer: "levez", hint: "raise" },
      { before: "« ", after: " après moi : bonjour ! »", answer: "répétez", hint: "repeat" }
    ]
  },
  {
    code: "0.7", slug: "mots-interrogatifs",
    title: "Les mots interrogatifs", en: "Recognise question words (receptive)",
    learn: {
      intro: "Recognise what each question word is asking about — that's the receptive goal here.",
      ref: [
        { fr: "qui", en: "who", ipa: "/ki/" },
        { fr: "où", en: "where", ipa: "/u/" },
        { fr: "quand", en: "when", ipa: "/kɑ̃/" },
        { fr: "comment", en: "how", ipa: "/kɔ.mɑ̃/" },
        { fr: "pourquoi", en: "why", ipa: "/puʁ.kwa/" },
        { fr: "combien", en: "how much / many", ipa: "/kɔ̃.bjɛ̃/" }
      ]
    },
    pretest: [
      { q: "« Où habites-tu ? » demande…", options: ["le lieu", "le moment", "la raison", "la manière"], answer: 0,
        why: "<b>Où</b> interroge sur le <b>lieu</b>." },
      { q: "« Pourquoi ? » =", options: ["why", "when", "where", "who"], answer: 0,
        why: "<b>Pourquoi</b> = why (la raison)." },
      { q: "« Combien ça coûte ? » demande…", options: ["la quantité / le prix", "le moment", "la personne", "le lieu"], answer: 0,
        why: "<b>Combien</b> interroge sur la quantité ou le prix." },
      { q: "« Quand arrives-tu ? » =", options: ["when", "where", "how", "who"], answer: 0,
        why: "<b>Quand</b> = when (le moment)." }
    ],
    gapfill: [
      { before: "— ", after: " ça coûte ? — 5 euros.", answer: "combien", hint: "how much" },
      { before: "— ", after: " tu t'appelles ? — Léa.", answer: "comment", hint: "how (name)" },
      { before: "— ", after: " habites-tu ? — À Paris.", answer: "où", hint: "where", accept: ["ou"] }
    ]
  },
  {
    code: "0.8", slug: "sons",
    title: "Produire les sons du français", en: "Produce basic sounds / phonetics",
    learn: {
      intro: "Key A1 sounds: the /y/–/u/ contrast (tu vs tout), nasal vowels, é vs è, and silent final consonants.",
      ref: [
        { fr: "tu", en: "/y/ — rounded front vowel", ipa: "/ty/" },
        { fr: "tout", en: "/u/ — like English 'oo'", ipa: "/tu/" },
        { fr: "été", en: "é = /e/ (closed)", ipa: "/e.te/" },
        { fr: "mère", en: "è = /ɛ/ (open)", ipa: "/mɛʁ/" },
        { fr: "vin", en: "in = nasal /ɛ̃/", ipa: "/vɛ̃/" },
        { fr: "petit", en: "final -t is silent", ipa: "/pə.ti/" }
      ]
    },
    pretest: [
      { q: "Quel mot contient le son /y/ ?", options: ["tu", "tout", "fou", "cou"], answer: 0,
        why: "<b>tu</b> = /y/ ; tout/fou/cou = /u/." },
      { q: "« vin » contient…", options: ["une voyelle nasale", "deux voyelles", "un -n prononcé /n/", "un son /i/ clair"], answer: 0,
        why: "« in » se prononce <b>/ɛ̃/</b>, une voyelle nasale." },
      { q: "Dans « petit », le -t final est…", options: ["muet", "prononcé", "nasal", "doublé"], answer: 0,
        why: "La consonne finale est souvent <b>muette</b> : peti(t)." },
      { q: "« é » dans « été » se prononce…", options: ["/e/ fermé", "/ɛ/ ouvert", "/ə/", "/a/"], answer: 0,
        why: "<b>é</b> = /e/ fermé ; <b>è</b> = /ɛ/ ouvert." }
    ],
    gapfill: null
  },
  {
    code: "0.9", slug: "jours",
    title: "Les jours et les moments", en: "Days of the week and parts of the day",
    learn: {
      intro: "The French week starts on lundi, and days are not capitalised. Learn the parts of the day too.",
      ref: [
        { fr: "lundi, mardi, mercredi", en: "Mon, Tue, Wed", ipa: "/lœ̃.di/" },
        { fr: "jeudi, vendredi", en: "Thu, Fri", ipa: "/ʒø.di/" },
        { fr: "samedi, dimanche", en: "Sat, Sun", ipa: "/di.mɑ̃ʃ/" },
        { fr: "le matin / l'après-midi", en: "morning / afternoon", ipa: "/ma.tɛ̃/" },
        { fr: "le soir / la nuit", en: "evening / night", ipa: "/swaʁ/, /nɥi/" },
        { fr: "hier / aujourd'hui / demain", en: "yesterday / today / tomorrow", ipa: "/jɛʁ/" }
      ]
    },
    pretest: [
      { q: "Le jour après lundi, c'est…", options: ["mardi", "dimanche", "mercredi", "jeudi"], answer: 0,
        why: "Lundi → <b>mardi</b>." },
      { q: "« le soir » =", options: ["evening", "morning", "noon", "night"], answer: 0,
        why: "<b>le soir</b> = evening ; la nuit = night." },
      { q: "Les jours de la semaine s'écrivent…", options: ["sans majuscule", "toujours avec une majuscule", "en italique", "en majuscules"], answer: 0,
        why: "En français, les jours ne prennent <b>pas de majuscule</b>." },
      { q: "Le premier jour de la semaine (calendrier français) :", options: ["lundi", "dimanche", "samedi", "vendredi"], answer: 0,
        why: "La semaine commence le <b>lundi</b>." }
    ],
    gapfill: [
      { before: "Le jour après mardi, c'est ", after: ".", answer: "mercredi", hint: "Wed" },
      { before: "Je dors la ", after: ".", answer: "nuit", hint: "night" },
      { before: "Le contraire de « hier » : ", after: ".", answer: "demain", hint: "tomorrow" }
    ]
  },
  {
    code: "0.10", slug: "couleurs",
    title: "Les couleurs", en: "Name basic colours",
    learn: {
      intro: "Colours agree with the noun: vert → verte, blanc → blanche. A few are invariable: orange, marron.",
      ref: [
        { fr: "rouge", en: "red", ipa: "/ʁuʒ/" },
        { fr: "bleu(e)", en: "blue", ipa: "/blø/" },
        { fr: "vert(e)", en: "green", ipa: "/vɛʁ/" },
        { fr: "jaune", en: "yellow", ipa: "/ʒon/" },
        { fr: "noir(e) / blanc(he)", en: "black / white", ipa: "/nwaʁ/, /blɑ̃/" },
        { fr: "orange, marron", en: "orange, brown (invariable)", ipa: "/ɔ.ʁɑ̃ʒ/" }
      ]
    },
    pretest: [
      { q: "« vert » =", options: ["green", "blue", "red", "yellow"], answer: 0,
        why: "<b>vert</b> = green." },
      { q: "Le féminin de « noir » :", options: ["noire", "noir", "noires", "noirs"], answer: 0,
        why: "noir → <b>noire</b> au féminin." },
      { q: "Le féminin de « blanc » :", options: ["blanche", "blanke", "blanc", "blanches"], answer: 0,
        why: "Forme irrégulière : blanc → <b>blanche</b>." },
      { q: "La couleur du ciel (le ciel), c'est…", options: ["bleu", "vert", "rouge", "noir"], answer: 0,
        why: "Le ciel est <b>bleu</b>." }
    ],
    gapfill: [
      { before: "La banane est ", after: ".", answer: "jaune", hint: "yellow" },
      { before: "L'herbe est ", after: ".", answer: "verte", hint: "green (fém.)" },
      { before: "La neige est ", after: ".", answer: "blanche", hint: "white (fém.)" },
      { before: "Le sang est ", after: ".", answer: "rouge", hint: "red" }
    ]
  }
];
