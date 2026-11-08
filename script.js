(() => {
  const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/Gv7hO2M8C/';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);
  const input = $('image-input');
  const dropzone = $('dropzone');
  const preview = $('image-preview');
  const removeButton = $('remove-image');
  const analyzeButton = $('analyze-button');
  const animalSelect = $('animal-select');
  const status = $('model-status');
  let model = null;
  let imageUrl = null;
  let selectedFile = null;
  let busy = false;
  let toastTimer;
  let galleryRequestId = 0;

  function setModelStatus(message, state = '') {
    status.className = `model-status ${state}`;
    $('status-text').textContent = message;
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function prettyLabel(label) {
    return String(label).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('tr-TR'));
  }

  function animalEmoji(label) {
    const text = label.toLocaleLowerCase('tr-TR');
    const animals = [
      [/penguin|penguen/, '🐧'], [/polar|kutup ayısı|ayı/, '🐻‍❄️'], [/seal|fok/, '🦭'], [/whale|balina/, '🐋'],
      [/dolphin|yunus/, '🐬'], [/fox|tilki/, '🦊'], [/wolf|kurt/, '🐺'], [/rabbit|tavşan/, '🐇'],
      [/bird|kuş/, '🐦'], [/fish|balık/, '🐟'], [/turtle|kaplumbağa/, '🐢'], [/cat|kedi/, '🐈'],
      [/dog|köpek/, '🐕'], [/bear|ayı/, '🐻'], [/deer|geyik/, '🦌'], [/elephant|fil/, '🐘'],
    ];
    return animals.find(([pattern]) => pattern.test(text))?.[1] || '🐾';
  }

  function updateAnalyzeButton() {
    analyzeButton.disabled = !model || !selectedFile || busy;
    $('button-label').textContent = busy ? 'ANALİZ EDİLİYOR…' : model ? 'FOTOĞRAFI ANALİZ ET' : 'MODELİ BAŞLAT';
  }

  function hideResults() {
    $('result-empty').hidden = false;
    $('result-content').hidden = true;
    $('guess-feedback').hidden = true;
    $('habitat-strip').hidden = true;
    $('result-empty').querySelector('strong').textContent = 'Henüz bir keşif yok';
    $('result-empty').querySelector('p').innerHTML = 'Fotoğrafını ekle, modelin<br />canlıları tanımlasın.';
    $('scan-status').className = 'scan-status';
    $('scan-status').innerHTML = '<span></span> BEKLEMEDE';
  }

  function commonsSearchTerm(label) {
    const lower = label.toLocaleLowerCase('tr-TR');
    const names = [
      [/penguin|penguen/, 'penguin'], [/polar bear|kutup ayısı/, 'polar bear'], [/seal|fok/, 'seal animal'],
      [/whale|balina/, 'whale animal'], [/dolphin|yunus/, 'dolphin animal'], [/fox|tilki/, 'fox animal'],
      [/wolf|kurt/, 'wolf animal'], [/rabbit|tavşan/, 'rabbit animal'], [/bird|kuş/, 'wild bird'],
      [/fish|balık/, 'fish animal'], [/turtle|kaplumbağa/, 'turtle animal'], [/cat|kedi/, 'cat animal'],
      [/dog|köpek/, 'dog animal'], [/bear|ayı/, 'bear animal'], [/deer|geyik/, 'deer animal'],
      [/elephant|fil/, 'elephant animal'],
    ];
    return names.find(([pattern]) => pattern.test(lower))?.[1] || `${label} animal`;
  }

  function habitatSpecies(label) {
    const text = label.toLocaleLowerCase('tr-TR');
    const antarctic = [
      { name: 'Weddell foku', emoji: '🦭', searchTerm: 'weddell seal' },
      { name: 'Leopar foku', emoji: '🦭', searchTerm: 'leopard seal' },
      { name: 'Katil balina', emoji: '🐋', searchTerm: 'orca whale' },
      { name: 'Antarktika petreli', emoji: '🐦', searchTerm: 'antarctic petrel' },
    ];
    const arctic = [
      { name: 'Kutup ayısı', emoji: '🐻‍❄️', searchTerm: 'polar bear' },
      { name: 'Mors', emoji: '🦭', searchTerm: 'walrus' },
      { name: 'Beluga', emoji: '🐋', searchTerm: 'beluga whale' },
      { name: 'Kutupsal tilki', emoji: '🦊', searchTerm: 'arctic fox' },
      { name: 'Arktik tavşanı', emoji: '🐇', searchTerm: 'arctic hare' },
      { name: 'Narval', emoji: '🐋', searchTerm: 'narwhal' },
      { name: 'Halka fok', emoji: '🦭', searchTerm: 'ringed seal' },
    ];
    const ocean = [
      { name: 'Kambur balina', emoji: '🐋', searchTerm: 'humpback whale' },
      { name: 'Katil balina', emoji: '🐋', searchTerm: 'orca whale' },
      { name: 'Yunus', emoji: '🐬', searchTerm: 'dolphin' },
      { name: 'Deniz kaplumbağası', emoji: '🐢', searchTerm: 'sea turtle' },
      { name: 'Albatros', emoji: '🐦', searchTerm: 'albatross bird' },
    ];
    let region = 'Kutup denizleri ve kıyıları';
    let species = arctic;
    if (/penguin|penguen|antarctic|antarktika/.test(text)) {
      region = 'Antarktika ve Güney Okyanusu';
      species = antarctic;
    } else if (/whale|balina|dolphin|yunus|orca|katil balina|fish|balık|turtle|kaplumbağa/.test(text)) {
      region = 'Soğuk denizler ve okyanuslar';
      species = ocean;
    }
    const sameSpecies = /penguin|penguen/.test(text) ? null
      : /polar bear|kutup ayısı/.test(text) ? 'Kutup ayısı'
      : /walrus|mors/.test(text) ? 'Mors'
      : /beluga/.test(text) ? 'Beluga'
      : /arctic fox|kutupsal tilki|fox|tilki/.test(text) ? 'Kutupsal tilki'
      : /hare|tavşan/.test(text) ? 'Arktik tavşanı'
      : /narwhal|narval/.test(text) ? 'Narval'
      : /seal|fok/.test(text) ? 'fok'
      : /orca|katil balina/.test(text) ? 'Katil balina'
      : /whale|balina/.test(text) ? 'balina'
      : /dolphin|yunus/.test(text) ? 'Yunus'
      : /turtle|kaplumbağa/.test(text) ? 'Deniz kaplumbağası'
      : null;
    const otherSpecies = sameSpecies === 'fok' ? species.filter((animal) => !/fok/i.test(animal.name))
      : sameSpecies === 'balina' ? species.filter((animal) => !/balina/i.test(animal.name))
      : sameSpecies ? species.filter((animal) => animal.name !== sameSpecies)
      : species;
    return { region, species: otherSpecies.slice(0, 4) };
  }

  function renderHabitatSpecies(label) {
    const { region, species } = habitatSpecies(label);
    $('habitat-strip').hidden = false;
    const heading = $('habitat-strip').querySelector('.habitat-title');
    heading.replaceChildren();
    const sparkle = document.createElement('span'); sparkle.textContent = '✧';
    heading.append(sparkle, document.createTextNode(' AYNI YAŞAM ALANI '));
    const regionText = document.createElement('small'); regionText.textContent = region; heading.append(regionText);
    const grid = $('habitat-tags');
    grid.replaceChildren(...species.map((animal, index) => {
      const card = document.createElement('article');
      card.className = 'habitat-animal-card';
      const image = document.createElement('img');
      image.alt = `${animal.name} örnek fotoğrafı`;
      image.loading = 'lazy';
      image.src = `https://loremflickr.com/320/200/${encodeURIComponent(animal.searchTerm)}?lock=${index + 31}`;
      const fallback = document.createElement('div');
      fallback.className = 'habitat-photo-fallback';
      fallback.textContent = animal.emoji;
      fallback.hidden = true;
      image.onerror = () => {
        card.classList.add('habitat-image-fallback');
        image.hidden = true;
        fallback.hidden = false;
      };
      const info = document.createElement('div');
      info.className = 'habitat-card-info';
      const emoji = document.createElement('span'); emoji.className = 'habitat-card-emoji'; emoji.textContent = animal.emoji;
      const name = document.createElement('strong'); name.textContent = animal.name;
      info.append(emoji, name);
      card.append(image, fallback, info);
      return card;
    }));
  }

  function renderPhotoCards(files, label, requestId) {
    if (requestId !== galleryRequestId) return;
    const grid = $('sample-photo-grid');
    grid.replaceChildren();
    const selected = files.slice(0, 3);
    $('gallery-count').textContent = `${String(selected.length).padStart(2, '0')} GÖRSEL`;
    if (!selected.length) {
      const empty = document.createElement('div');
      empty.className = 'gallery-message';
      empty.textContent = 'Bu tür için şu anda örnek fotoğraf bulunamadı.';
      grid.append(empty);
      return;
    }
    selected.forEach((file, index) => {
      const card = document.createElement('a');
      card.className = 'sample-photo';
      card.href = file.pageUrl;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = file.imageUrl;
      image.alt = `${prettyLabel(label)} örnek fotoğrafı ${index + 1}`;
      image.loading = 'lazy';
      image.onerror = () => { card.classList.add('image-unavailable'); };
      const caption = document.createElement('span');
      caption.className = 'photo-caption';
      caption.innerHTML = `<span>ÖRNEK 0${index + 1}</span><b></b>`;
      caption.querySelector('b').textContent = file.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      card.append(image, caption);
      grid.append(card);
    });
  }

  async function loadSamplePhotos(label) {
    const requestId = ++galleryRequestId;
    $('gallery-title').textContent = `${prettyLabel(label)} fotoğrafları`;
    $('gallery-count').textContent = 'YÜKLENİYOR';
    $('sample-photo-grid').innerHTML = '<div class="gallery-loading"><span></span> ÖRNEK FOTOĞRAFLAR GETİRİLİYOR…</div>';
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'search',
      gsrsearch: `filetype:bitmap ${commonsSearchTerm(label)}`,
      gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo',
      iiprop: 'url|mime', iiurlwidth: '640', origin: '*',
    });
    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!response.ok) throw new Error(`Commons returned ${response.status}`);
      const data = await response.json();
      const pages = Object.values(data.query?.pages || {});
      const files = pages.flatMap((page) => {
        const info = page.imageinfo?.[0];
        const imageUrl = info?.thumburl || info?.url;
        return imageUrl && info?.mime?.startsWith('image/')
          ? [{ title: page.title, imageUrl, pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}` }]
          : [];
      });
      renderPhotoCards(files, label, requestId);
    } catch (error) {
      console.error('Örnek fotoğraflar yüklenemedi:', error);
      if (requestId === galleryRequestId) {
        $('gallery-count').textContent = 'BAĞLANTI YOK';
        $('sample-photo-grid').innerHTML = '<div class="gallery-message">Örnek fotoğraflar yüklenemedi. İnternet bağlantını kontrol edip yeniden analiz et.</div>';
      }
    }
  }

  function clearFile() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
    selectedFile = null;
    input.value = '';
    preview.removeAttribute('src');
    preview.hidden = true;
    $('preview-shade').hidden = true;
    $('upload-content').hidden = false;
    $('file-meta').hidden = true;
    dropzone.classList.remove('has-image');
    hideResults();
    updateAnalyzeButton();
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Lütfen JPG, PNG veya WEBP türünde bir görsel seç.');
      input.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Görsel 10 MB sınırını aşıyor. Daha küçük bir dosya seç.');
      input.value = '';
      return;
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    selectedFile = file;
    imageUrl = URL.createObjectURL(file);
    preview.src = imageUrl;
    preview.hidden = false;
    $('preview-shade').hidden = false;
    $('upload-content').hidden = true;
    $('file-name').textContent = file.name;
    $('file-size').textContent = `${(file.size / (1024 * 1024)).toFixed(file.size < 1024 * 1024 ? 3 : 1)} MB · Fotoğraf hazır`;
    $('file-meta').hidden = false;
    dropzone.classList.add('has-image');
    hideResults();
    $('result-empty').querySelector('strong').textContent = 'Fotoğrafın hazır';
    $('result-empty').querySelector('p').innerHTML = 'Tahmini görmek için soldaki<br /><b>Fotoğrafı analiz et</b> düğmesine bas.';
    updateAnalyzeButton();
  }

  function populateLabels(labels) {
    animalSelect.replaceChildren(new Option('Hayvan tahminini seç…', ''));
    for (const label of labels) animalSelect.add(new Option(prettyLabel(label), label));
    animalSelect.disabled = labels.length === 0;
  }

  async function loadModel() {
    try {
      if (!window.tmImage) throw new Error('Teachable Machine kütüphanesi yüklenemedi.');
      model = await window.tmImage.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
      populateLabels(model.getClassLabels());
      setModelStatus(`${model.getClassLabels().length} hayvan sınıfı hazır. Fotoğrafını ekleyebilirsin.`, 'ready');
      updateAnalyzeButton();
    } catch (error) {
      console.error('Model yüklenemedi:', error);
      setModelStatus('Model yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.', 'error');
      $('button-label').textContent = 'MODEL YÜKLENEMEDİ';
    }
  }

  function renderPredictions(predictions) {
    const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
    const best = sorted[0];
    $('result-empty').hidden = true;
    $('result-content').hidden = false;
    $('prediction-icon').textContent = animalEmoji(best.className);
    $('top-label').textContent = prettyLabel(best.className);
    $('top-confidence').textContent = `${Math.round(best.probability * 100)}%`;
    renderHabitatSpecies(best.className);
    loadSamplePhotos(best.className);
    const guess = animalSelect.value;
    const feedback = $('guess-feedback');
    if (guess) {
      const correct = guess === best.className;
      feedback.hidden = false;
      feedback.className = `guess-feedback${correct ? '' : ' wrong'}`;
      feedback.textContent = correct
        ? `✦ Harika tahmin! Sen de ${prettyLabel(best.className)} olduğunu düşündün.`
        : `Sen ${prettyLabel(guess)} dedin; modelin en güçlü tahmini ${prettyLabel(best.className)} oldu.`;
    } else {
      feedback.hidden = true;
    }
    const scanStatus = $('scan-status');
    scanStatus.className = 'scan-status done';
    scanStatus.innerHTML = '<span></span> TAMAMLANDI';
  }

  async function analyzeImage() {
    if (!model || !selectedFile || busy) return;
    busy = true;
    updateAnalyzeButton();
    $('analyzing-overlay').hidden = false;
    $('result-empty').hidden = true;
    $('result-content').hidden = true;
    const scanStatus = $('scan-status');
    scanStatus.className = 'scan-status scanning';
    scanStatus.innerHTML = '<span></span> TARANIYOR';
    try {
      await new Promise((resolve, reject) => {
        preview.onload = resolve;
        preview.onerror = () => reject(new Error('Görsel açılamadı.'));
        if (preview.complete && preview.naturalWidth) resolve();
      });
      const predictions = await model.predict(preview, false);
      renderPredictions(predictions);
    } catch (error) {
      console.error('Görsel analiz edilemedi:', error);
      $('result-empty').hidden = false;
      scanStatus.className = 'scan-status failed';
      scanStatus.innerHTML = '<span></span> HATA';
      showToast('Görsel analiz edilemedi. Başka bir fotoğraf deneyebilirsin.');
    } finally {
      busy = false;
      $('analyzing-overlay').hidden = true;
      updateAnalyzeButton();
    }
  }

  input.addEventListener('change', (event) => loadFile(event.target.files[0]));
  removeButton.addEventListener('click', clearFile);
  analyzeButton.addEventListener('click', analyzeImage);
  animalSelect.addEventListener('change', () => {
    if (!$('result-content').hidden) {
      const bestClass = model.getClassLabels().find((label) => prettyLabel(label) === $('top-label').textContent);
      const feedback = $('guess-feedback');
      if (!animalSelect.value) feedback.hidden = true;
      else {
        const correct = animalSelect.value === bestClass;
        feedback.hidden = false;
        feedback.className = `guess-feedback${correct ? '' : ' wrong'}`;
        feedback.textContent = correct ? `✦ Harika tahmin! Sen de ${prettyLabel(bestClass)} olduğunu düşündün.` : `Sen ${prettyLabel(animalSelect.value)} dedin; modelin en güçlü tahmini ${bestLabel} oldu.`;
      }
    }
  });
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
  });
  for (const type of ['dragenter', 'dragover']) dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.add('drag-over'); });
  for (const type of ['dragleave', 'drop']) dropzone.addEventListener(type, (event) => { event.preventDefault(); dropzone.classList.remove('drag-over'); });
  dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));
  window.addEventListener('beforeunload', () => { if (imageUrl) URL.revokeObjectURL(imageUrl); });
  loadModel();
})();
