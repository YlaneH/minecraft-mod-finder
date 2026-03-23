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
    resume: 'Tu découvres les modpacks ? Voici les bases pour bien démarrer sans te perdre.',
    contenu: `
      <h3>Par où commencer avec les modpacks ?</h3>
      <p>Un modpack, c'est une collection de mods déjà configurés et compatibles entre eux. Au lieu d'installer 50 mods à la main, tu lances un seul pack et tout est prêt.</p>
      <h4>Les étapes pour démarrer :</h4>
      <p><strong>1. Installe un launcher</strong> — <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> ou CurseForge sont les deux plus populaires. Ils gèrent tout automatiquement.</p>
      <p><strong>2. Choisis ton modpack</strong> — Utilise le quiz sur l'accueil pour trouver celui qui correspond à ton style de jeu.</p>
      <p><strong>3. Alloue assez de RAM</strong> — La plupart des modpacks ont besoin d'au moins 4 Go de RAM, certains jusqu'à 8 Go. Règle ça dans les paramètres de ton launcher.</p>
      <p><strong>4. Lance et attends</strong> — Le premier démarrage prend du temps, c'est normal. Les mods se chargent tous au lancement.</p>
      <p><strong>Conseil :</strong> commence par un modpack léger comme <em>Vault Hunters</em> ou <em>All the Mods</em> pour t'habituer avant de passer aux packs plus lourds.</p>
    `
  },
  {
    emoji: '💻',
    titre: 'Quel PC pour les modpacks ?',
    resume: 'Forge, Fabric, peu de RAM... on t\'explique ce dont tu as vraiment besoin.',
    contenu: `
      <h3>Quel PC pour les modpacks ?</h3>
      <p>Les modpacks sont beaucoup plus gourmands que le Minecraft vanilla. Voici ce qu'il te faut selon le type de pack :</p>
      <h4>Modpacks légers (Casual)</h4>
      <p>4 Go de RAM allouée, n'importe quel PC de moins de 10 ans. Exemples : <em>Better MC</em>, <em>Prominence</em>.</p>
      <h4>Modpacks moyens</h4>
      <p>6-8 Go de RAM allouée, un processeur correct (i5 ou Ryzen 5). Exemples : <em>All the Mods 9</em>, <em>Enigmatica 6</em>.</p>
      <h4>Modpacks lourds</h4>
      <p>8-12 Go de RAM allouée, bon CPU et GPU. Exemples : <em>SkyFactory 4</em>, <em>FTB Revelation</em>.</p>
      <h4>Astuces pour améliorer les performances :</h4>
      <p>Installe les mods <strong>Sodium</strong> (Fabric) ou <strong>OptiFine</strong> (Forge) si le pack le permet. Baisse la distance de rendu à 8-10 chunks.</p>
    `
  },
  {
    emoji: '⚔️',
    titre: 'Top 5 modpacks pour débuter en 2025',
    resume: 'Les meilleurs modpacks pour les nouveaux joueurs, testés et approuvés.',
    contenu: `
      <h3>Top 5 modpacks pour débuter en 2025</h3>
      <p>Tu ne sais pas quel modpack choisir ? Voici notre sélection pour les débutants :</p>
      <p><strong>1. Better MC</strong> — Ajoute plein de contenu sans changer le gameplay de base. Parfait pour une première expérience moddée.</p>
      <p><strong>2. Prominence II</strong> — Aventure et exploration, très accessible. Un des modpacks les mieux notés du moment.</p>
      <p><strong>3. All the Mods 9</strong> — La référence pour découvrir la technologie et la magie. Énorme mais bien guidé.</p>
      <p><strong>4. RLCraft</strong> — Si tu veux du challenge dès le départ. Survie hardcore, mais très populaire.</p>
      <p><strong>5. Vault Hunters</strong> — Un modpack de quêtes avec une progression claire. Idéal pour jouer en multi.</p>
      <p>Utilise notre <strong>quiz sur l'accueil</strong> pour obtenir une recommandation personnalisée !</p>
    `
  },
  {
    emoji: '🔧',
    titre: 'Forge vs Fabric vs NeoForge : quelles différences ?',
    resume: 'Tu ne sais pas quel mod loader choisir ? On t\'explique tout en 2 minutes.',
    contenu: `
      <h3>Forge vs Fabric vs NeoForge</h3>
      <p>Le mod loader, c'est le moteur qui fait tourner les mods. Chaque modpack en utilise un spécifique, tu ne peux pas les mélanger.</p>
      <h4>Forge</h4>
      <p>Le plus ancien et le plus répandu. La majorité des gros modpacks utilisent Forge. Très stable, énorme bibliothèque de mods. Inconvénient : plus lent au chargement.</p>
      <h4>Fabric</h4>
      <p>Plus léger et plus rapide que Forge. Populaire pour les mods de performance et les modpacks axés survie.</p>
      <h4>NeoForge</h4>
      <p>Un fork de Forge créé en 2023. Compatible avec beaucoup de mods Forge, et plus actif dans le développement.</p>
      <p><strong>Conseil :</strong> ne te prends pas la tête, le launcher installe automatiquement le bon mod loader pour chaque modpack.</p>
    `
  },
  {
    emoji: '🌍',
    titre: 'Jouer en multijoueur : guide complet',
    resume: 'Comment jouer avec des amis sur un modpack, gratuitement ou avec un serveur dédié.',
    contenu: `
      <h3>Jouer en multijoueur sur un modpack</h3>
      <p>Jouer à un modpack avec des amis, c'est souvent l'expérience la plus fun. Voici comment faire.</p>
      <h4>Option 1 : LAN (réseau local)</h4>
      <p>Si vous êtes sur le même réseau Wi-Fi, un joueur héberge la partie depuis le jeu. Gratuit, mais vous devez être au même endroit.</p>
      <h4>Option 2 : Aternos (gratuit)</h4>
      <p><a href="https://aternos.org" target="_blank">Aternos</a> propose des serveurs Minecraft gratuits avec support modpacks. Le serveur se met en veille quand personne ne joue.</p>
      <h4>Option 3 : Serveur payant</h4>
      <p>Pour une expérience stable, un hébergeur comme Bisect Hosting ou PebbleHost à partir de 3-5€/mois.</p>
      <p><strong>Important :</strong> tous les joueurs doivent avoir exactement la même version du modpack.</p>
    `
  },
  {
    emoji: '📦',
    titre: 'Comment installer un modpack étape par étape',
    resume: 'Guide pas à pas pour installer ton premier modpack avec Modrinth App.',
    contenu: `
      <h3>Installer un modpack étape par étape</h3>
      <p>Voici comment installer n'importe quel modpack avec <strong>Modrinth App</strong> :</p>
      <p><strong>Étape 1 :</strong> Télécharge <a href="https://modrinth.com/app" target="_blank">Modrinth App</a> sur le site officiel.</p>
      <p><strong>Étape 2 :</strong> Connecte-toi avec ton compte Microsoft.</p>
      <p><strong>Étape 3 :</strong> Dans l'onglet "Browse", cherche le modpack ou utilise notre quiz.</p>
      <p><strong>Étape 4 :</strong> Clique sur "Install". Le launcher télécharge tout automatiquement.</p>
      <p><strong>Étape 5 :</strong> Alloue au moins 4-6 Go de RAM dans les paramètres de l'instance.</p>
      <p><strong>Étape 6 :</strong> Lance le jeu, le premier démarrage peut prendre 2-5 minutes.</p>
      <p><strong>Astuce :</strong> Si ça crashe au démarrage, c'est souvent un problème de RAM.</p>
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
    <p>Minecraft Finder est un outil gratuit pour aider les joueurs à trouver le modpack ou mod Minecraft qui leur correspond.</p>
    <p>Face aux milliers de modpacks disponibles sur Modrinth, c'est pas toujours facile de choisir. Le quiz, les filtres et le top 10 sont là pour simplifier ça.</p>
    <p>Les données viennent de l'API publique de <a href="https://modrinth.com" target="_blank">Modrinth</a>.</p>
    <p>Site créé par un passionné de Minecraft, pour la communauté.</p>
    <p><strong>Contact :</strong> une question ? Retrouvez-nous sur les réseaux.</p>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function openPrivacy() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Politique de confidentialité</h3>
    <p><em>Dernière mise à jour : mars 2025</em></p>
    <p>Minecraft Finder respecte votre vie privée.</p>
    <h4>Données collectées</h4>
    <p>Ce site ne collecte aucune donnée personnelle directement. C'est un outil statique qui appelle l'API publique de Modrinth.</p>
    <h4>Cookies</h4>
    <p>Des cookies techniques peuvent être utilisés. Si des pubs sont affichées via Google AdSense, des cookies tiers peuvent être déposés par Google. Vous pouvez les gérer dans les paramètres de votre navigateur.</p>
    <h4>Google AdSense</h4>
    <p>Ce site peut afficher des publicités via Google AdSense. Pour en savoir plus : <a href="https://policies.google.com/privacy" target="_blank">politique de confidentialité de Google</a>.</p>
    <h4>Vos droits</h4>
    <p>Conformément au RGPD, vous disposez d'un droit d'accès et de suppression de vos données. Contactez-nous pour ça.</p>
  `
  document.getElementById('modal-overlay').classList.remove('hidden')
}

function openLegal() {
  document.getElementById('modal-content').innerHTML = `
    <h3>Mentions légales</h3>
    <p><em>Dernière mise à jour : mars 2025</em></p>
    <h4>Éditeur</h4>
    <p>Minecraft Finder est un site personnel non commercial.</p>
    <h4>Hébergement</h4>
    <p>Hébergé par Vercel Inc., 340 Pine Street Suite 701, San Francisco, California 94104, USA.</p>
    <h4>Propriété intellectuelle</h4>
    <p>Le contenu du site (quiz, guides) appartient à l'éditeur. Les données modpacks viennent de l'API Modrinth et appartiennent à leurs créateurs.</p>
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
      <button class="detail-back" onclick="closeDetail()">← Retour</button>
      <p class="loading">Chargement...</p>
    </div>
  `

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
      <button class="detail-back" onclick="closeDetail()">← Retour</button>
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
        <button class="detail-share" onclick="partagerModpack('${item.slug}', '${item.title.replace(/'/g, "\\'")}')">Partager</button>
      </div>
    </div>
  `
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
        ${q.options.map(opt => `<button class="option-btn" onclick="selectAnswer('${q.id}', '${opt.value}')">${opt.label}</button>`).join('')}
      </div>
      <p class="progress">${currentQuestion + 1} / ${questions.length}</p>
    </div>
  `
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
    <button class="restart-btn" onclick="restart()">Recommencer le quiz</button>
  `

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