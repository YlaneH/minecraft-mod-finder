// état des filtres
let state = {
  modpack: { category: '', version: '', sort: 'relevance', players: '', difficulty: '', loader: '', modIn: '', offset: 0, query: '' },
  mod: { category: '', version: '', sort: 'relevance', loader: '', offset: 0, query: '' }
}

let searchTimers = { modpack: null, mod: null }
let modInTimer = null

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick') === `switchTab('${tab}')`)
  })
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  document.getElementById('tab-' + tab).classList.add('active')
  if (tab === 'modpacks') fetchResults('modpack')
  if (tab === 'mods') fetchResults('mod')
  if (tab === 'top10') loadTop10()
  if (tab === 'guides') renderGuides()
}

function toggleFilter(id) {
  const el = document.getElementById(id)
  el.classList.toggle('hidden')
  const chevron = el.previousElementSibling.querySelector('.chevron')
  chevron.textContent = el.classList.contains('hidden') ? '▼' : '▲'
}

function setFilter(type, key, val, btn) {
  state[type][key] = val
  state[type].offset = 0
  if (btn) {
    btn.closest('.filter-options').querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  }
  fetchResults(type)
}

function debounceSearch(type) {
  clearTimeout(searchTimers[type])
  searchTimers[type] = setTimeout(() => {
    state[type].query = document.getElementById('search-' + type).value
    state[type].offset = 0
    fetchResults(type)
  }, 400)
}

function debounceModInSearch() {
  clearTimeout(modInTimer)
  modInTimer = setTimeout(() => {
    state.modpack.modIn = document.getElementById('search-mod-in-modpack').value
    state.modpack.offset = 0
    fetchResults('modpack')
  }, 400)
}

function buildUrl(type, overrides = {}) {
  const s = { ...state[type], ...overrides }
  const ptype = type === 'modpack' ? 'modpack' : 'mod'
  const facets = [['project_type:' + ptype]]

  if (s.category) facets.push(['categories:' + s.category])
  if (s.version) facets.push(['versions:' + s.version])
  if (s.loader) facets.push(['categories:' + s.loader])
  if (s.difficulty) facets.push(['categories:' + s.difficulty])
  if (s.players) facets.push(['categories:' + s.players])

  const q = s.modIn || s.query || ''
  const params = new URLSearchParams({
    query: q,
    facets: JSON.stringify(facets),
    index: s.sort || 'relevance',
    limit: 20,
    offset: s.offset || 0
  })
  return `https://api.modrinth.com/v2/search?${params}`
}

const fallbackOrder = ['difficulty', 'players', 'loader', 'category', 'version']

async function fetchResults(type, append = false) {
  const container = document.getElementById('results-' + type)
  if (!append) container.innerHTML = '<p class="loading">Chargement...</p>'

  try {
    const res = await fetch(buildUrl(type))
    const data = await res.json()

    if (data.hits && data.hits.length > 0) {
      renderCards(type, data.hits, append)
      return
    }
    await fetchFallback(type, { ...state[type] }, fallbackOrder.slice(), container)
  } catch(e) {
    container.innerHTML = '<p class="loading">Erreur de connexion.</p>'
  }
}

async function fetchFallback(type, filters, remaining, container) {
  if (remaining.length === 0) {
    container.innerHTML = '<p class="loading">Aucun résultat trouvé.</p>'
    return
  }

  const removed = remaining.shift()
  const newFilters = { ...filters, [removed]: '' }

  try {
    const res = await fetch(buildUrl(type, newFilters))
    const data = await res.json()

    if (data.hits && data.hits.length > 0) {
      const noms = { difficulty: 'la difficulté', players: 'le mode de jeu', loader: 'le mod loader', category: 'la catégorie', version: 'la version' }
      container.innerHTML = `<div class="fallback-notice">Pas de résultat exact, on a ignoré <strong>${noms[removed] || removed}</strong></div>`
      renderCards(type, data.hits, true)
    } else {
      await fetchFallback(type, newFilters, remaining, container)
    }
  } catch(e) {
    container.innerHTML = '<p class="loading">Erreur de connexion.</p>'
  }
}

async function loadTop10() {
  const grid = document.getElementById('top10-grid')
  grid.innerHTML = '<p class="loading">Chargement...</p>'

  try {
    const params = new URLSearchParams({
      facets: JSON.stringify([['project_type:modpack']]),
      index: 'downloads',
      limit: 10,
      offset: 0
    })
    const res = await fetch(`https://api.modrinth.com/v2/search?${params}`)
    const data = await res.json()

    grid.innerHTML = ''
    data.hits.forEach((item, i) => {
      const card = document.createElement('div')
      card.className = 'top10-card'
      card.style.animationDelay = (i * 0.06) + 's'
      card.onclick = () => openDetail(item, 'modpack')
      card.innerHTML = `
        <div class="top10-rank">${i + 1}</div>
        <img src="${item.icon_url || 'https://via.placeholder.com/48?text=MC'}" alt="${item.title}">
        <div class="top10-info">
          <h3>${item.title}</h3>
          <p>${item.description}</p>
          <div class="mod-meta">
            <span>⬇ ${formatNumber(item.downloads)}</span>
            <span>♥ ${formatNumber(item.follows)}</span>
          </div>
        </div>
      `
      grid.appendChild(card)
    })
  } catch(e) {
    grid.innerHTML = '<p class="loading">Erreur de chargement.</p>'
  }
}

const guidesData = [
  {
    emoji: '🚀',
    titre: 'Par où commencer avec les modpacks ?',
    resume: 'Moi je galérais à choisir. Voilà une mini méthode simple pour démarrer vite (et éviter de te perdre).',
    contenu: `
      <h3>Par où commencer avec les modpacks ?</h3>
      <p>Un modpack, c'est une collection de mods déjà configurés et compatibles entre eux. Plutôt que d'installer 50 trucs à la main, tu lances un seul pack et ça roule.</p>
      <p><strong>Le plus important :</strong> au lieu de passer des heures à scroller, je te conseille de suivre ce mini-ordre (simple, mais efficace).</p>
      <h4>Les étapes pour démarrer :</h4>
      <p><strong>1. Installe un launcher</strong> — <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> ou CurseForge. Ils font le boulot automatiquement.</p>
      <p><strong>2. Choisis ton modpack</strong> — Utilise le quiz sur l'accueil : en 2 minutes tu te retrouves avec des recommandations qui collent vraiment à ton style.</p>
      <p><strong>3. Alloue assez de RAM</strong> — Vise au moins 4 Go (souvent plus selon le pack). Si ça rame au premier chargement, c'est souvent de la RAM.</p>
      <p><strong>4. Lance et attends</strong> — Première fois = normal que ça prenne un peu. Après, c'est plus fluide.</p>
      <p><strong>Conseil perso :</strong> commence léger (ex : <em>Vault Hunters</em> ou <em>All the Mods</em>), puis tu montes en difficulté quand tu es à l'aise.</p>
    `
  },
  {
    emoji: '💻',
    titre: 'Quel PC pour les modpacks ?',
    resume: 'Si ton jeu rame, c’est souvent pas “ton talent”, c’est juste la config. Voilà quoi regarder.',
    contenu: `
      <h3>Quel PC pour les modpacks ?</h3>
      <p>Les modpacks coûtent beaucoup plus cher que le vanilla. La bonne nouvelle, c’est que ça se règle assez facilement.</p>
      <h4>Le repère le plus simple : la RAM</h4>
      <p><strong>• Casual (léger)</strong> : commence vers <strong>4 Go</strong>. Si ton PC date un peu, ça passe souvent quand même.</p>
      <p><strong>• Moyen</strong> : vise <strong>6-8 Go</strong> et un CPU correct (un i5/Ryzen 5 ça aide bien).</p>
      <p><strong>• Lourd</strong> : <strong>8-12 Go</strong> et un bon processeur. Souvent, c’est là que le “je rame” apparaît.</p>
      <h4>Si ça rame : 3 trucs rapides</h4>
      <p><strong>1)</strong> baisse un peu la distance de rendu (par exemple <strong>8-10 chunks</strong>).</p>
      <p><strong>2)</strong> active des optimisations si le pack les accepte (genre <strong>Sodium</strong> si c’est Fabric, ou des options type <strong>OptiFine</strong> côté Forge selon les packs).</p>
      <p><strong>3)</strong> surveille ton utilisation RAM : si ça sature, ça peut planter.</p>
    `
  },
  {
    emoji: '⚔️',
    titre: 'Top 5 modpacks pour débuter en 2025',
    resume: 'Si je devais en recommander 5 à quelqu\'un qui veut juste démarrer sans se prendre la tête.',
    contenu: `
      <h3>Top 5 modpacks pour débuter en 2025</h3>
      <p>Tu bloques parce que tu sais pas quoi prendre ? Voilà une sélection pensée pour démarrer proprement :</p>
      <p><strong>1. Better MC</strong> — Ajoute plein de contenu sans changer le gameplay de base. Parfait pour une première expérience moddée.</p>
      <p><strong>2. Prominence II</strong> — Aventure et exploration, très accessible. Un des modpacks les mieux notés du moment.</p>
      <p><strong>3. All the Mods 9</strong> — La référence pour découvrir la technologie et la magie. Énorme mais bien guidé.</p>
      <p><strong>4. RLCraft</strong> — Si tu veux du challenge dès le départ. Survie hardcore, mais très populaire.</p>
      <p><strong>5. Vault Hunters</strong> — Un modpack de quêtes avec une progression claire. Idéal pour jouer en multi.</p>
      <p>Et si tu veux aller plus vite que “au hasard” : utilise le <strong>quiz sur l'accueil</strong> pour avoir une recommandation qui te ressemble.</p>
    `
  },
  {
    emoji: '🔧',
    titre: 'Forge vs Fabric vs NeoForge : quelles différences ?',
    resume: 'Le vrai choix, c’est pas “toi vs le loader”. C’est surtout compatibilité avec le modpack.',
    contenu: `
      <h3>Forge vs Fabric vs NeoForge</h3>
      <p>Le mod loader, c’est le “moteur” qui fait tourner les mods. Et surtout : <strong>chaque modpack est prévu pour un loader</strong>. Donc tu ne mélanges pas au hasard.</p>
      <h4>Forge</h4>
      <p>Très répandu, et souvent utilisé sur les gros packs. C’est généralement solide, mais ça peut être un peu plus lourd au chargement.</p>
      <h4>Fabric</h4>
      <p>Souvent plus léger et plus “rapide”. Tu le vois beaucoup sur des packs orientés perf/survie, et sur plein d’optimisations.</p>
      <h4>NeoForge</h4>
      <p>Un cousin de Forge, plus moderne. En pratique : si le modpack le demande, tu utilises NeoForge et c’est réglé.</p>
      <p><strong>Conseil :</strong> le plus simple, c’est de choisir le modpack. Ensuite, ton launcher installe le bon loader automatiquement.</p>
    `
  },
  {
    emoji: '🌍',
    titre: 'Jouer en multijoueur : guide complet',
    resume: 'Le multijoueur c’est fun, mais faut juste éviter les “problèmes de version”. Voilà comment.',
    contenu: `
      <h3>Jouer en multijoueur sur un modpack</h3>
      <p>Honnêtement, c’est souvent là que tu t’amuses le plus. Le seul piège : ne pas avoir la même version (sinon ça bug).</p>
      <h4>Option 1 : LAN (réseau local)</h4>
      <p>Si tu es sur le même Wi‑Fi qu’un pote, le plus simple c’est que quelqu’un héberge depuis le jeu. C’est gratuit, mais il faut être “au même endroit”.</p>
      <h4>Option 2 : Aternos (gratuit)</h4>
      <p><a href="https://aternos.org" target="_blank">Aternos</a> peut te dépanner si tu veux un serveur gratuit avec des modpacks. Par contre, le serveur peut se mettre en veille.</p>
      <h4>Option 3 : Serveur payant</h4>
      <p>Si tu veux quelque chose de stable 24/7, un hébergeur payant (type Bisect Hosting ou PebbleHost) peut être le plus confortable.</p>
      <p><strong>Important :</strong> tout le monde doit lancer <strong>le même modpack</strong> et idéalement la même version. Sinon, tu vas perdre du temps.</p>
    `
  },
  {
    emoji: '📦',
    titre: 'Comment installer un modpack étape par étape',
    resume: 'Si c’est ton premier modpack : suis ça, et tu devrais y arriver sans galérer.',
    contenu: `
      <h3>Installer un modpack étape par étape</h3>
      <p>Je te montre le chemin le plus simple avec <strong>Modrinth App</strong> :</p>
      <p><strong>Étape 1 :</strong> télécharge <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> (site officiel).</p>
      <p><strong>Étape 2 :</strong> connecte-toi avec ton compte Microsoft.</p>
      <p><strong>Étape 3 :</strong> ouvre <strong>Browse</strong>, cherche ton modpack (ou utilise le quiz ici sur la page d’accueil).</p>
      <p><strong>Étape 4 :</strong> clique sur <strong>Install</strong> : le launcher récupère tout automatiquement.</p>
      <p><strong>Étape 5 :</strong> dans les paramètres de l’instance, mets au moins <strong>4-6 Go</strong> de RAM (ajuste si besoin).</p>
      <p><strong>Étape 6 :</strong> lance le jeu. La première fois, ça peut prendre quelques minutes.</p>
      <p><strong>Astuce :</strong> si ça crash, la cause la plus fréquente c’est la RAM (ou un problème de compatibilité du pack).</p>
    `
  }
]

let guideRendered = false

function renderGuides() {
  if (guideRendered) return
  guideRendered = true

  const grid = document.getElementById('guides-grid')
  grid.innerHTML = ''

  guidesData.forEach((guide, i) => {
    const card = document.createElement('div')
    card.className = 'guide-card'
    card.style.animationDelay = (i * 0.07) + 's'
    card.onclick = () => openGuide(i)
    card.innerHTML = `
      <div class="guide-emoji">${guide.emoji}</div>
      <h3>${guide.titre}</h3>
      <p>${guide.resume}</p>
      <span class="guide-lire">Lire →</span>
    `
    grid.appendChild(card)
  })
}

function openGuide(i) {
  document.getElementById('modal-content').innerHTML = guidesData[i].contenu
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function openAbout() {
  document.getElementById('modal-content').innerHTML = `
    <h3>À propos de Minecraft Finder</h3>
    <p>Je m'appelle <strong>Gurin</strong>. Comme beaucoup de joueurs, je passe facilement plus de temps à chercher “LE” modpack qu'à réellement jouer.</p>
    <p>Du coup j'ai créé <strong>Minecraft Finder</strong> : un petit outil qui te fait gagner du temps. Tu réponds à quelques questions, et je te pousse vers des modpacks (ou mods) qui correspondent à ton style.</p>
    <p>Le site utilise un quiz, des filtres, et un <strong>Top 10</strong> pour que tu puisses découvrir rapidement. Pas de blabla : juste l'idée de base, trouver vite et tester.</p>
    <p>Les données viennent de l'API publique de <a href="https://modrinth.com" target="_blank">Modrinth</a>.</p>
    <p><strong>Si tu veux</strong> : dis-moi en commentaire ce que tu voudrais améliorer (plus de filtres, meilleurs guides, une nouvelle section, etc.).</p>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function openPrivacy() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Politique de confidentialité</h3>
    <p><em>Dernière mise à jour : mars 2026</em></p>
    <p>Je fais au plus simple : ce site ne te demande pas de compte et je ne récupère pas d'infos personnelles “en mode formulaire”.</p>
    <h4>Données utilisées pour faire tourner le site</h4>
    <p>Le site affiche les modpacks/mods via l'API publique de <a href="https://modrinth.com" target="_blank">Modrinth</a>.</p>
    <h4>Statistiques de visites (Google Analytics)</h4>
    <p>Le site utilise Google Analytics (via le script présent dans la page) pour comprendre comment les gens utilisent l'outil et améliorer l'expérience. Les données sont traitées par Google.</p>
    <h4>Cookies et publicités</h4>
    <p>Des cookies techniques peuvent être utilisés. Quand tu verras des publicités, elles peuvent être diffusées via <strong>Google AdSense</strong> (et donc via des partenaires publicitaires de Google).</p>
    <p>Dans ce cas, Google peut utiliser des cookies pour afficher des annonces et mesurer leurs performances. Tu peux gérer ça via les paramètres de ton navigateur et aussi via les <a href="https://support.google.com/ads/answer/7395996" target="_blank" rel="noopener noreferrer">paramètres des annonces Google</a>.</p>
    <h4>Vos droits</h4>
    <p>Conformément au RGPD, tu peux demander l'accès ou la suppression des données te concernant quand elles existent. Si tu as une question, écris-moi.</p>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function openLegal() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Mentions légales</h3>
    <p><em>Dernière mise à jour : mars 2026</em></p>
    <h4>Éditeur</h4>
    <p>Minecraft Finder est un site personnel tenu par <strong>Gurin</strong>.</p>
    <h4>Hébergement</h4>
    <p>Hébergé par Vercel Inc., 340 Pine Street Suite 701, San Francisco, California 94104, USA.</p>
    <h4>Propriété intellectuelle</h4>
    <p>Le contenu du site (quiz, guides) appartient à Gurin. Les données modpacks/mods viennent de l'API Modrinth et appartiennent à leurs créateurs.</p>
    <h4>Non-affiliation</h4>
    <p>Ce site n'est pas affilié à Mojang Studios, Microsoft, Modrinth ou CurseForge. "Minecraft" est une marque déposée de Mojang.</p>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
}

function renderCards(type, items, append) {
  const container = document.getElementById('results-' + type)
  if (!append) container.innerHTML = ''

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="loading">Aucun résultat.</p>'
    return
  }

  items.forEach((item, i) => {
    const card = document.createElement('div')
    card.className = 'mod-card'
    card.style.animationDelay = (i * 0.04) + 's'
    card.style.cursor = 'pointer'
    card.onclick = () => openDetail(item, type)
    card.innerHTML = `
      <img src="${item.icon_url || 'https://via.placeholder.com/56?text=MC'}" alt="${item.title}">
      <div class="mod-info">
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        <div class="mod-meta">
          <span>⬇ ${formatNumber(item.downloads)}</span>
          <span>♥ ${formatNumber(item.follows)}</span>
          ${item.versions?.length ? `<span>${item.versions[item.versions.length - 1]}</span>` : ''}
        </div>
        <span class="mod-info-link">Voir le détail →</span>
      </div>
    `
    container.appendChild(card)
  })
}

function formatNumber(n) {
  if (!n) return '0'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n
}

function formatDescription(text) {
  if (!text) return 'Aucune description disponible.'

  const badLinks = [
    'adfoc.us', 'adfly', 'bit.ly', 'tinyurl', 'paypal', 'patreon',
    'ko-fi', 'buymeacoffee', 'img.shields.io', 'badge', 'sponsor', 'donate',
    'apexhost', 'apexminecraft', 'nitrado', 'bisecthosting',
    'shockbyte', 'mcprohosting', 'serverminer', 'nodecraft',
    'pebblehost', 'melonhosting', 'aternos', 'falixnodes',
    'exaroton', 'crafted.host', 'sparked.host', 'bloom.host', 'curseforge.com',
    'twitter.com', 'x.com', 'youtube.com', 'twitch.tv', 'discord.gg', 'discord.com/invite'
  ]

  text = text.replace(/!\[.*?\]\(.*?\)/g, '')
  text = text.split('\n').filter(line => {
    const l = line.toLowerCase()
    return !badLinks.some(d => l.includes(d))
  }).join('\n')

  text = text.replace(/\[(.+?)\]\((.*?)\)/g, (match, txt, url) => {
    if (badLinks.some(d => url.toLowerCase().includes(d))) return ''
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`
  })

  text = text
    .replace(/<script.*?>.*?<\/script>/gi, '')
    .replace(/<iframe.*?>.*?<\/iframe>/gi, '')
    .replace(/#{1,6}\s(.+)/g, '<strong>$1</strong><br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/(<br>){3,}/g, '<br><br>')

  return text
}

function estimerJouabilite(cats, downloads, follows) {
  const isMulti = cats.includes('multiplayer')
  const isSolo = cats.includes('singleplayer')
  const ratio = follows > 0 ? downloads / follows : 0

  if (isMulti && isSolo) return { label: 'Solo & Multi', confirmed: true }
  if (isMulti) return { label: 'Multijoueur', confirmed: true }
  if (isSolo) return { label: 'Solo', confirmed: true }
  if (ratio > 5000) return { label: 'Probablement Multi', confirmed: false }
  if (ratio > 2000) return { label: 'Solo & Multi estimé', confirmed: false }
  return { label: 'Solo estimé', confirmed: false }
}

async function traduireTexte(text) {
  if (!text || text.length < 10) return text
  const motsFr = ['le','la','les','de','du','des','un','une','et','est','avec','pour','sur','dans']
  const mots = text.toLowerCase().split(/\s+/).slice(0, 30)
  if (mots.filter(m => motsFr.includes(m)).length >= 3) return text

  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|fr`)
    const data = await res.json()
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText
    }
  } catch(e) {}
  return text
}

function partagerModpack(slug, title) {
  const url = `${window.location.origin}${window.location.pathname}?modpack=${slug}`
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast(`Lien copié pour "${title}"`))
  } else {
    prompt('Copie ce lien :', url)
  }
}

function showToast(msg) {
  const existing = document.getElementById('toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'toast'
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)

  setTimeout(() => toast.classList.add('toast-visible'), 10)
  setTimeout(() => {
    toast.classList.remove('toast-visible')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

function loadMore(type) {
  state[type].offset += 20
  fetchResults(type, true)
}

async function openDetail(item, type) {
  const page = document.getElementById('detail-page')
  const content = document.getElementById('detail-content')

  page.classList.remove('detail-hidden')
  page.scrollTo(0, 0)

  content.innerHTML = `
    <div class="detail-inner">
      <button type="button" class="detail-back">← Retour</button>
      <p class="loading">Chargement...</p>
    </div>
  `
  content.querySelector('.detail-back').addEventListener('click', closeDetail)

  let fullDesc = item.description
  try {
    const res = await fetch(`https://api.modrinth.com/v2/project/${item.slug}`)
    const data = await res.json()
    fullDesc = data.body || item.description
  } catch(e) {}

  const descTraduite = await traduireTexte(item.description)
  const ptype = type === 'modpack' ? 'modpack' : 'mod'
  const modrinthUrl = `https://modrinth.com/${ptype}/${item.slug}`
  const cats = item.categories || []
  const jouabilite = estimerJouabilite(cats, item.downloads, item.follows)
  const confiance = jouabilite.confirmed ? '✓ Confirmé' : '~ Estimé'

  const diff = cats.includes('hardcore') ? 'Hardcore' : cats.includes('challenging') ? 'Difficile' : cats.includes('lightweight') ? 'Casual' : 'Modérée'
  const loader = ['forge','fabric','quilt','neoforge'].find(l => cats.includes(l))
  const versions = item.versions ? item.versions.slice(-3).reverse().join(', ') : 'N/A'

  history.pushState({}, '', `?modpack=${item.slug}`)

  content.innerHTML = `
    <div class="detail-inner">
      <button type="button" class="detail-back">← Retour</button>
      <div class="detail-hero">
        <img src="${item.icon_url || 'https://via.placeholder.com/96?text=MC'}" alt="${item.title}">
        <div class="detail-hero-info">
          <h2>${item.title}</h2>
          <p>${descTraduite}</p>
        </div>
      </div>
      <div class="detail-divider"></div>
      <div class="detail-grid">
        <div class="detail-stat">
          <div class="detail-stat-label">Téléchargements</div>
          <div class="detail-stat-value">${formatNumber(item.downloads)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Favoris</div>
          <div class="detail-stat-value">${formatNumber(item.follows)}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Jouabilité <span class="stat-badge">${confiance}</span></div>
          <div class="detail-stat-value">${jouabilite.label}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Difficulté</div>
          <div class="detail-stat-value">${diff}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Mod loader</div>
          <div class="detail-stat-value">${loader ? loader.charAt(0).toUpperCase() + loader.slice(1) : 'Universel'}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Versions MC</div>
          <div class="detail-stat-value">${versions}</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-label">Type</div>
          <div class="detail-stat-value">${ptype === 'modpack' ? 'Modpack' : 'Mod'}</div>
        </div>
      </div>
      ${cats.length > 0 ? `
        <div class="detail-section-title">Catégories</div>
        <div class="detail-tags">${cats.map(c => `<span class="detail-tag">${c}</span>`).join('')}</div>
      ` : ''}
      <div class="detail-divider"></div>
      <div class="detail-section-title">Description complète</div>
      <div class="detail-description">${formatDescription(fullDesc)}</div>
      <div class="detail-actions">
        <a href="${modrinthUrl}" target="_blank" class="detail-cta">Voir sur Modrinth →</a>
        <button type="button" class="detail-share">Partager</button>
      </div>
    </div>
  `
  content.querySelector('.detail-back').addEventListener('click', closeDetail)
  const shareBtn = content.querySelector('.detail-share')
  shareBtn.addEventListener('click', () => partagerModpack(item.slug, item.title))
}

function closeDetail() {
  document.getElementById('detail-page').classList.add('detail-hidden')
  history.pushState({}, '', window.location.pathname)
}

async function checkUrlPartage() {
  const params = new URLSearchParams(window.location.search)
  const slug = params.get('modpack')
  if (!slug) return

  try {
    const res = await fetch(`https://api.modrinth.com/v2/project/${slug}`)
    const data = await res.json()
    if (data && data.slug) {
      const item = {
        slug: data.slug,
        title: data.title,
        description: data.description,
        icon_url: data.icon_url,
        downloads: data.downloads,
        follows: data.followers,
        categories: data.categories,
        versions: data.game_versions
      }
      openDetail(item, data.project_type || 'modpack')
    }
  } catch(e) {}
}

const questions = [
  {
    id: 'players',
    question: 'Tu joues comment ?',
    options: [
      { label: 'Solo', value: '' },
      { label: 'Multijoueur', value: 'multiplayer' }
    ]
  },
  {
    id: 'type',
    question: 'Quel type de jeu ?',
    options: [
      { label: 'Aventure', value: 'adventure' },
      { label: 'Combat', value: 'combat' },
      { label: 'Magie', value: 'magic' },
      { label: 'Technologie', value: 'technology' },
      { label: 'Quêtes', value: 'quests' },
      { label: 'Peu importe', value: '' }
    ]
  },
  {
    id: 'difficulty',
    question: 'Niveau de challenge ?',
    options: [
      { label: 'Chill / Casual', value: 'lightweight' },
      { label: 'Normal', value: '' },
      { label: 'Difficile', value: 'challenging' },
      { label: 'Hardcore', value: 'hardcore' }
    ]
  },
  {
    id: 'perf',
    question: 'Ton PC il tient la route ?',
    options: [
      { label: 'PC gamer', value: 'high' },
      { label: 'PC moyen', value: 'medium' },
      { label: 'Vieux PC', value: 'low' }
    ]
  }
]

let answers = {}
let currentQuestion = 0

function renderQuestion() {
  const quiz = document.getElementById('quiz')
  const q = questions[currentQuestion]
  quiz.innerHTML = `
    <div class="question">
      <p class="question-text">${q.question}</p>
      <div class="options">
        ${q.options.map(opt => `<button type="button" class="option-btn" data-qid="${q.id}" data-val="${opt.value}">${opt.label}</button>`).join('')}
      </div>
      <p class="progress">${currentQuestion + 1} / ${questions.length}</p>
    </div>
  `
  quiz.onclick = (e) => {
    const btn = e.target.closest('.option-btn')
    if (!btn) return
    selectAnswer(btn.dataset.qid, btn.dataset.val)
  }
}

function selectAnswer(id, val) {
  answers[id] = val
  currentQuestion++
  if (currentQuestion < questions.length) {
    renderQuestion()
  } else {
    searchModpacks()
  }
}

async function searchModpacks() {
  document.getElementById('quiz').innerHTML = ''
  document.getElementById('results').innerHTML = '<p class="loading">Recherche en cours...</p>'

  const facets = [['project_type:modpack']]
  if (answers.players) facets.push(['categories:' + answers.players])
  if (answers.type) facets.push(['categories:' + answers.type])
  if (answers.difficulty) facets.push(['categories:' + answers.difficulty])
  if (answers.perf === 'low') facets.push(['categories:lightweight'])

  const params = new URLSearchParams({ facets: JSON.stringify(facets), index: 'downloads', limit: 10 })

  try {
    const res = await fetch(`https://api.modrinth.com/v2/search?${params}`)
    const data = await res.json()

    if (data.hits && data.hits.length > 0) {
      renderQuizResults(data.hits)
    } else {
      // fallback sans difficulté
      const f2 = [['project_type:modpack']]
      if (answers.players) f2.push(['categories:' + answers.players])
      if (answers.type) f2.push(['categories:' + answers.type])
      const p2 = new URLSearchParams({ facets: JSON.stringify(f2), index: 'downloads', limit: 10 })
      const res2 = await fetch(`https://api.modrinth.com/v2/search?${p2}`)
      const data2 = await res2.json()
      renderQuizResults(data2.hits)
    }
  } catch(e) {
    document.getElementById('results').innerHTML = '<p class="loading">Erreur lors de la recherche.</p>'
  }
}

function renderQuizResults(mods) {
  const results = document.getElementById('results')

  if (!mods || mods.length === 0) {
    results.innerHTML = '<p class="loading">Aucun modpack trouvé. Réessaie.</p>'
    return
  }

  results.innerHTML = `
    <h2 class="section-title" style="margin-top:40px">Modpacks recommandés pour toi</h2>
    <div class="mods-grid"></div>
    <button type="button" class="restart-btn">Recommencer le quiz</button>
  `
  results.querySelector('.restart-btn').addEventListener('click', restart)

  const grid = results.querySelector('.mods-grid')
  mods.forEach((mod, i) => {
    const card = document.createElement('div')
    card.className = 'mod-card'
    card.style.animationDelay = (i * 0.05) + 's'
    card.style.cursor = 'pointer'
    card.onclick = () => openDetail(mod, 'modpack')
    card.innerHTML = `
      <img src="${mod.icon_url || 'https://via.placeholder.com/56?text=MC'}" alt="${mod.title}">
      <div class="mod-info">
        <h3>${mod.title}</h3>
        <p>${mod.description}</p>
        <div class="mod-meta">
          <span>⬇ ${formatNumber(mod.downloads)}</span>
          <span>♥ ${formatNumber(mod.follows)}</span>
        </div>
        <span class="mod-info-link">Voir le détail →</span>
      </div>
    `
    grid.appendChild(card)
  })
}

function restart() {
  answers = {}
  currentQuestion = 0
  document.getElementById('results').innerHTML = ''
  renderQuestion()
}

renderQuestion()
checkUrlPartage()