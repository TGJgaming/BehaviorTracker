(() => {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_KEYS = {
    LOGS: 'steadylog_entries_v1',
    CUSTOM_CHIPS: 'steadylog_custom_chips_v1',
    DISCREET_MODE: 'steadylog_discreet_v1'
  };

  // --- Default Clinical / ComB Preset Chips ---
  const DEFAULT_CHIPS = {
    environments: [
      'In bed',
      'At desk / workstation',
      'Bathroom / Mirror',
      'Couch / Living room',
      'Bathroom / Shower',
      'Alone',
      'Others in house / nearby',
      'In transit / Out'
    ],
    priorTasks: [
      'Scrolling phone',
      'Working / Studying',
      'Trying to fall asleep',
      'Just woke up / In bed',
      'Watching video / TV',
      'Grooming / Mirror check',
      'Idle / Waiting',
      'Reading',
      'Procrastinating a task',
      'Resting / Low energy'
    ],
    bodyLocations: [
      'Face / Chin / Cheeks',
      'Scalp / Hairline',
      'Lips',
      'Fingers / Cuticles / Nails',
      'Arms / Shoulders',
      'Chest / Upper back',
      'Legs / Feet'
    ],
    sensoryStates: [
      'Felt bump / scab / roughness',
      'Saw imperfection in mirror',
      'Skin itch / tingling',
      'Physical tension / restlessness',
      'Fatigue / Heavy MDD exhaustion',
      'Insomnia / Can\'t sleep',
      'Understimulated / Bored',
      'Physical arousal',
      'Brain fog / Numbness'
    ],
    triggers: [
      'Tactile: unconsciously touched skin',
      'Visual: mirror / close inspection',
      'Stress / Overwhelm',
      'Task avoidance / Executive dysfunction',
      'Boredom / Empty time',
      'Loneliness / Isolation',
      'Intrusive or racing thoughts',
      'Seeking dopamine / tension release',
      'Bedtime / Waking transition',
      'Habit / Muscle memory'
    ],
    emotions: [
      'Anxious / On edge',
      'Depressed / Low / Empty',
      'Stressed / Overwhelmed',
      'Bored / Understimulated',
      'Frustrated / Irritable',
      'Numb / Dissociated',
      'Restless / Agitated',
      'Tired / Drained',
      'Ashamed / Guilty',
      'Relieved (briefly)'
    ]
  };

  const INTENSITY_LABELS = {
    1: '1 — Mild',
    2: '2 — Low',
    3: '3 — Moderate',
    4: '4 — Strong',
    5: '5 — Intense'
  };

  // --- Application State ---
  let logs = [];
  let customChips = {
    environments: [],
    priorTasks: [],
    bodyLocations: [],
    sensoryStates: [],
    triggers: [],
    emotions: []
  };
  let discreetMode = false;

  // Form State
  let editingEntryId = null;
  let autoTimeSync = true;
  let selectedBehavior = 'excoriation';
  let selectedAwareness = 'Automatic (Zoned out)';
  let selectedIntensity = 3;
  let selectedDuration = '1–5 min';
  let selectedChips = {
    environments: new Set(),
    priorTasks: new Set(),
    bodyLocations: new Set(),
    sensoryStates: new Set(),
    triggers: new Set(),
    emotions: new Set()
  };

  // Filter State
  let historyFilterBehavior = 'all';
  let historyFilterDate = 'all';
  let historySearchQuery = '';

  let insightsDays = 'all';
  let insightsBehavior = 'all';

  let activeCustomChipCategory = null;
  let confirmCallback = null;

  // --- DOM Helpers ---
  const $ = (id) => document.getElementById(id);

  // --- Initialization ---
  function init() {
    loadFromStorage();
    bindNavigation();
    bindHeaderActions();
    bindExpressButtons();
    bindFormControls();
    bindHistoryFilters();
    bindInsightsFilters();
    bindExportControls();
    bindModals();

    renderAllChipGroups();
    syncDateTimeToNow();
    startLiveClock();
    applyDiscreetModeUI();
    updateAllViews();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // --- Storage ---
  function loadFromStorage() {
    try {
      const rawLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (rawLogs) {
        const parsed = JSON.parse(rawLogs);
        if (Array.isArray(parsed)) logs = parsed;
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    }

    try {
      const rawChips = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHIPS);
      if (rawChips) {
        const parsed = JSON.parse(rawChips);
        Object.keys(customChips).forEach((k) => {
          if (Array.isArray(parsed[k])) customChips[k] = parsed[k];
        });
      }
    } catch (e) {
      console.error('Failed to load custom chips:', e);
    }

    try {
      discreetMode = localStorage.getItem(STORAGE_KEYS.DISCREET_MODE) === 'true';
    } catch (e) {
      discreetMode = false;
    }
  }

  function saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (e) {
      showToast('Storage error: Could not save log.');
    }
  }

  function saveCustomChips() {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CHIPS, JSON.stringify(customChips));
    } catch (e) {
      console.error('Failed to save custom chips:', e);
    }
  }

  // --- Discreet Mode Labels ---
  function getBehaviorDisplayName(type, forReport = false) {
    if (!forReport && discreetMode) {
      if (type === 'excoriation') return 'Behavior A (Skin)';
      if (type === 'masturbation') return 'Behavior B';
      if (type === 'both') return 'Both (A & B)';
    }
    if (type === 'excoriation') return 'Excoriation';
    if (type === 'masturbation') return 'Masturbation';
    if (type === 'both') return 'Both (Excoriation & Masturbation)';
    return type;
  }

  function applyDiscreetModeUI() {
    const btn = $('discreetToggleBtn');
    const eyeOpen = $('eyeOpenIcon');
    const eyeClosed = $('eyeClosedIcon');
    const labelText = $('discreetLabelText');

    if (discreetMode) {
      btn.classList.add('active-discreet');
      eyeOpen.classList.add('hidden');
      eyeClosed.classList.remove('hidden');
      labelText.textContent = 'Discreet';
    } else {
      btn.classList.remove('active-discreet');
      eyeOpen.classList.remove('hidden');
      eyeClosed.classList.add('hidden');
      labelText.textContent = 'Standard';
    }

    document.querySelectorAll('[data-behavior-label]').forEach((el) => {
      const type = el.getAttribute('data-behavior-label');
      if (el.classList.contains('express-btn-text')) {
        el.textContent = `Stamp ${getBehaviorDisplayName(type)}`;
      } else {
        el.textContent = type === 'both' ? (discreetMode ? 'Both (A & B)' : 'Both') : getBehaviorDisplayName(type);
      }
    });

    document.querySelectorAll('[data-behavior-sub]').forEach((el) => {
      const type = el.getAttribute('data-behavior-sub');
      if (type === 'excoriation') {
        el.textContent = discreetMode ? 'BFRB / Category A' : 'Skin picking / BFRB';
      } else if (type === 'masturbation') {
        el.textContent = discreetMode ? 'Category B' : 'Self-stimulation';
      }
    });
  }

  // --- Date & Time Helpers ---
  function formatDateInput(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatTimeInput(dateObj) {
    const hh = String(dateObj.getHours()).padStart(2, '0');
    const mm = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function syncDateTimeToNow() {
    const now = new Date();
    $('entryDate').value = formatDateInput(now);
    $('entryTime').value = formatTimeInput(now);
    autoTimeSync = true;
    updateLiveClockBadge();
  }

  function updateLiveClockBadge() {
    const badge = $('liveClockIndicator');
    if (autoTimeSync && !editingEntryId) {
      badge.className = 'live-badge';
      badge.innerHTML = '<span class="pulse-dot"></span> Auto-Time (Now)';
    } else {
      badge.className = 'live-badge manual';
      badge.innerHTML = '<span class="pulse-dot"></span> Custom / Preserved Time';
    }
  }

  function startLiveClock() {
    setInterval(() => {
      if (autoTimeSync && !editingEntryId) {
        const now = new Date();
        $('entryDate').value = formatDateInput(now);
        $('entryTime').value = formatTimeInput(now);
      }
    }, 15000);
  }

  function parseDateTimeInputs(dateStr, timeStr) {
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    const [hh, mm] = (timeStr || '').split(':').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function formatReadableDateTime(isoOrMs, dateStr, timeStr) {
    const dt = dateStr && timeStr ? parseDateTimeInputs(dateStr, timeStr) : new Date(isoOrMs);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[dt.getDay()];
    const monthName = months[dt.getMonth()];
    const dayNum = dt.getDate();
    const year = dt.getFullYear();

    let hours = dt.getHours();
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;

    return {
      full: `${dayName}, ${monthName} ${dayNum}, ${year} at ${hours}:${minutes} ${ampm}`,
      datePart: `${dayName}, ${monthName} ${dayNum}, ${year}`,
      timePart: `${hours}:${minutes} ${ampm} (${String(dt.getHours()).padStart(2, '0')}:${minutes})`,
      hour24: dt.getHours(),
      timestamp: dt.getTime()
    };
  }

  function getTimeOfDayBucket(hour24) {
    if (hour24 >= 6 && hour24 < 12) return 'Morning (6 AM – 12 PM)';
    if (hour24 >= 12 && hour24 < 18) return 'Afternoon (12 PM – 6 PM)';
    if (hour24 >= 18 && hour24 < 23) return 'Evening (6 PM – 11 PM)';
    return 'Late Night / Overnight (11 PM – 6 AM)';
  }

  // --- Navigation ---
  function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-view').forEach((sec) => {
      sec.classList.toggle('active', sec.id === tabId);
    });

    if (tabId === 'historyView') renderHistoryView();
    if (tabId === 'insightsView') renderInsightsView();
    if (tabId === 'exportView') renderExportPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    $('quickExportHeaderBtn').addEventListener('click', () => {
      switchTab('exportView');
    });

    $('reviewPendingBtn').addEventListener('click', () => {
      const pending = logs.find((l) => l.isExpressPending);
      if (pending) {
        startEditingEntry(pending.id);
      } else {
        historyFilterBehavior = 'incomplete';
        syncHistoryFilterButtons();
        switchTab('historyView');
      }
    });
  }

  function bindHeaderActions() {
    $('discreetToggleBtn').addEventListener('click', () => {
      discreetMode = !discreetMode;
      localStorage.setItem(STORAGE_KEYS.DISCREET_MODE, String(discreetMode));
      applyDiscreetModeUI();
      updateAllViews();
      showToast(discreetMode ? 'Discreet screen labels enabled.' : 'Standard clinical labels enabled.');
    });
  }

  // --- 1-Tap Express Log ---
  function bindExpressButtons() {
    document.querySelectorAll('.btn-express').forEach((btn) => {
      btn.addEventListener('click', () => {
        const behaviorType = btn.getAttribute('data-express-type');
        createExpressEntry(behaviorType);
      });
    });
  }

  function createExpressEntry(behaviorType) {
    const now = new Date();
    const dateStr = formatDateInput(now);
    const timeStr = formatTimeInput(now);
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    const newEntry = {
      id,
      timestamp: now.getTime(),
      date: dateStr,
      time: timeStr,
      behavior: behaviorType,
      awareness: 'Automatic (Zoned out)',
      intensity: null,
      duration: '',
      environments: [],
      priorTasks: [],
      priorTaskNote: '',
      bodyLocations: [],
      sensoryStates: [],
      sensoryNote: '',
      triggers: [],
      triggerNote: '',
      emotions: [],
      thoughts: '',
      isExpressPending: true,
      createdAt: now.toISOString()
    };

    logs.unshift(newEntry);
    sortLogsChronologically();
    saveLogs();
    updateAllViews();

    const readable = formatReadableDateTime(now.getTime(), dateStr, timeStr);
    showToast(`⚡ Stamped ${getBehaviorDisplayName(behaviorType)} at ${readable.timePart.split(' (')[0]}`, [
      {
        label: 'Add Details Now',
        onClick: () => startEditingEntry(id)
      },
      {
        label: 'Undo',
        onClick: () => {
          logs = logs.filter((l) => l.id !== id);
          saveLogs();
          updateAllViews();
        }
      }
    ]);
  }

  // --- Form Controls & Chip Rendering ---
  function bindFormControls() {
    // Date / Time manual changes
    const onManualDateTime = () => {
      autoTimeSync = false;
      document.querySelectorAll('.chip-time').forEach((b) => b.classList.remove('active'));
      updateLiveClockBadge();
    };
    $('entryDate').addEventListener('change', onManualDateTime);
    $('entryTime').addEventListener('change', onManualDateTime);

    // Quick time offset pills
    document.querySelectorAll('.chip-time').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chip-time').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const offset = btn.getAttribute('data-offset');
        if (offset === 'now') {
          syncDateTimeToNow();
        } else {
          autoTimeSync = false;
          const mins = parseInt(offset, 10);
          const adjusted = new Date(Date.now() + mins * 60000);
          $('entryDate').value = formatDateInput(adjusted);
          $('entryTime').value = formatTimeInput(adjusted);
          updateLiveClockBadge();
        }
      });
    });

    // Behavior Selector
    document.querySelectorAll('.behavior-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        setBehaviorSelection(btn.getAttribute('data-behavior'));
      });
    });

    // Awareness Selector
    document.querySelectorAll('#awarenessGroup .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setAwarenessSelection(btn.getAttribute('data-awareness'));
      });
    });

    // Intensity Scale
    document.querySelectorAll('#intensityGroup .intensity-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setIntensitySelection(parseInt(btn.getAttribute('data-intensity'), 10));
      });
    });

    // Duration Group
    document.querySelectorAll('#durationGroup .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        setDurationSelection(btn.getAttribute('data-duration'));
      });
    });

    // Add Custom Chip Buttons
    document.querySelectorAll('.btn-add-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        openCustomChipModal(btn.getAttribute('data-category'));
      });
    });

    // Reset & Cancel Edit
    $('resetFormBtn').addEventListener('click', () => {
      resetFormToDefaults();
      showToast('Form reset.');
    });

    $('cancelEditBtn').addEventListener('click', () => {
      resetFormToDefaults();
    });

    // Submit Form
    $('logForm').addEventListener('submit', (e) => {
      e.preventDefault();
      handleFormSubmit();
    });
  }

  function setBehaviorSelection(behavior) {
    selectedBehavior = behavior;
    document.querySelectorAll('.behavior-option').forEach((btn) => {
      const isMatch = btn.getAttribute('data-behavior') === behavior;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-checked', String(isMatch));
    });

    // Show/hide or emphasize Target Body Area block
    const bodyBlock = $('bodyLocationBlock');
    if (behavior === 'masturbation') {
      bodyBlock.classList.add('hidden');
    } else {
      bodyBlock.classList.remove('hidden');
    }
  }

  function setAwarenessSelection(awareness) {
    selectedAwareness = awareness;
    document.querySelectorAll('#awarenessGroup .seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-awareness') === awareness);
    });
  }

  function setIntensitySelection(level) {
    selectedIntensity = level;
    document.querySelectorAll('#intensityGroup .intensity-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-intensity'), 10) === level);
    });
    $('intensityValueLabel').textContent = INTENSITY_LABELS[level] || `${level} / 5`;
  }

  function setDurationSelection(duration) {
    selectedDuration = duration;
    document.querySelectorAll('#durationGroup .chip').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-duration') === duration);
    });
  }

  function renderChipCategory(category, containerId) {
    const container = $(containerId);
    if (!container) return;
    container.innerHTML = '';

    const combined = [...DEFAULT_CHIPS[category], ...(customChips[category] || [])];
    const activeSet = selectedChips[category];

    combined.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (activeSet.has(label) ? ' active' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (activeSet.has(label)) {
          activeSet.delete(label);
          btn.classList.remove('active');
        } else {
          activeSet.add(label);
          btn.classList.add('active');
        }
      });
      container.appendChild(btn);
    });
  }

  function renderAllChipGroups() {
    renderChipCategory('environments', 'environmentsChips');
    renderChipCategory('priorTasks', 'priorTasksChips');
    renderChipCategory('bodyLocations', 'bodyLocationsChips');
    renderChipCategory('sensoryStates', 'sensoryStatesChips');
    renderChipCategory('triggers', 'triggersChips');
    renderChipCategory('emotions', 'emotionsChips');
  }

  function resetFormToDefaults() {
    editingEntryId = null;
    $('editModeBanner').classList.add('hidden');
    $('expressLogCard').classList.remove('hidden');
    $('saveEntryBtnText').textContent = 'Save Log Entry';

    syncDateTimeToNow();
    document.querySelectorAll('.chip-time').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-offset') === 'now');
    });

    setBehaviorSelection('excoriation');
    setAwarenessSelection('Automatic (Zoned out)');
    setIntensitySelection(3);
    setDurationSelection('1–5 min');

    Object.keys(selectedChips).forEach((k) => selectedChips[k].clear());
    renderAllChipGroups();

    $('priorTaskInput').value = '';
    $('sensoryInput').value = '';
    $('triggerInput').value = '';
    $('thoughtsInput').value = '';
  }

  function startEditingEntry(entryId) {
    const entry = logs.find((l) => l.id === entryId);
    if (!entry) return;

    editingEntryId = entry.id;
    autoTimeSync = false;

    switchTab('logView');

    const readable = formatReadableDateTime(entry.timestamp, entry.date, entry.time);
    $('editModeBanner').classList.remove('hidden');
    $('expressLogCard').classList.add('hidden');
    $('editModeTitle').textContent = entry.isExpressPending
      ? '⚡ Completing Express Log'
      : 'Editing Logged Entry';
    $('editModeSubtitle').textContent = `Stamped for ${readable.full}`;
    $('saveEntryBtnText').textContent = entry.isExpressPending
      ? 'Save Completed Details'
      : 'Update Log Entry';

    $('entryDate').value = entry.date;
    $('entryTime').value = entry.time;
    document.querySelectorAll('.chip-time').forEach((b) => b.classList.remove('active'));
    updateLiveClockBadge();

    setBehaviorSelection(entry.behavior || 'excoriation');
    setAwarenessSelection(entry.awareness || 'Automatic (Zoned out)');
    setIntensitySelection(entry.intensity || 3);
    setDurationSelection(entry.duration || '1–5 min');

    Object.keys(selectedChips).forEach((cat) => {
      selectedChips[cat] = new Set(Array.isArray(entry[cat]) ? entry[cat] : []);
      // Ensure any custom tags on this entry exist in customChips so they render
      selectedChips[cat].forEach((tag) => {
        if (!DEFAULT_CHIPS[cat].includes(tag) && !customChips[cat].includes(tag)) {
          customChips[cat].push(tag);
        }
      });
    });
    renderAllChipGroups();

    $('priorTaskInput').value = entry.priorTaskNote || '';
    $('sensoryInput').value = entry.sensoryNote || '';
    $('triggerInput').value = entry.triggerNote || '';
    $('thoughtsInput').value = entry.thoughts || '';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleFormSubmit() {
    const dateVal = $('entryDate').value;
    const timeVal = $('entryTime').value;
    const dt = parseDateTimeInputs(dateVal, timeVal);

    const entryData = {
      id: editingEntryId || ('log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      timestamp: dt.getTime(),
      date: dateVal || formatDateInput(dt),
      time: timeVal || formatTimeInput(dt),
      behavior: selectedBehavior,
      awareness: selectedAwareness,
      intensity: selectedIntensity,
      duration: selectedDuration,
      environments: Array.from(selectedChips.environments),
      priorTasks: Array.from(selectedChips.priorTasks),
      priorTaskNote: $('priorTaskInput').value.trim(),
      bodyLocations: selectedBehavior === 'masturbation' ? [] : Array.from(selectedChips.bodyLocations),
      sensoryStates: Array.from(selectedChips.sensoryStates),
      sensoryNote: $('sensoryInput').value.trim(),
      triggers: Array.from(selectedChips.triggers),
      triggerNote: $('triggerInput').value.trim(),
      emotions: Array.from(selectedChips.emotions),
      thoughts: $('thoughtsInput').value.trim(),
      isExpressPending: false,
      updatedAt: new Date().toISOString()
    };

    if (editingEntryId) {
      const idx = logs.findIndex((l) => l.id === editingEntryId);
      if (idx !== -1) {
        entryData.createdAt = logs[idx].createdAt || entryData.updatedAt;
        logs[idx] = entryData;
      } else {
        logs.unshift(entryData);
      }
      showToast('Log entry updated.');
    } else {
      entryData.createdAt = entryData.updatedAt;
      logs.unshift(entryData);
      showToast('Log entry saved.');
    }

    sortLogsChronologically();
    saveLogs();
    resetFormToDefaults();
    updateAllViews();
  }

  function sortLogsChronologically() {
    logs.sort((a, b) => {
      const ta = parseDateTimeInputs(a.date, a.time).getTime();
      const tb = parseDateTimeInputs(b.date, b.time).getTime();
      return tb - ta;
    });
  }

  // --- Update UI & Pending Express Banner ---
  function updateAllViews() {
    $('navHistoryCount').textContent = String(logs.length);

    const pendingLogs = logs.filter((l) => l.isExpressPending);
    const banner = $('pendingExpressBanner');
    if (pendingLogs.length > 0 && !editingEntryId) {
      banner.classList.remove('hidden');
      $('pendingExpressCountText').textContent =
        pendingLogs.length === 1
          ? 'You have 1 express-stamped log waiting for details.'
          : `You have ${pendingLogs.length} express-stamped logs waiting for details.`;
    } else {
      banner.classList.add('hidden');
    }

    renderHistoryView();
    renderInsightsView();
    renderExportPreview();
  }

  // --- History View ---
  function bindHistoryFilters() {
    document.querySelectorAll('#historyBehaviorFilter .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        historyFilterBehavior = btn.getAttribute('data-filter-behavior');
        syncHistoryFilterButtons();
        renderHistoryView();
      });
    });

    $('historySearchInput').addEventListener('input', (e) => {
      historySearchQuery = e.target.value.trim().toLowerCase();
      renderHistoryView();
    });

    $('historyDateFilter').addEventListener('change', (e) => {
      historyFilterDate = e.target.value;
      renderHistoryView();
    });
  }

  function syncHistoryFilterButtons() {
    document.querySelectorAll('#historyBehaviorFilter .chip').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-filter-behavior') === historyFilterBehavior);
    });
  }

  function filterLogs({ behavior = 'all', days = 'all', search = '', startDate = '', endDate = '' }) {
    const now = new Date();
    const todayStr = formatDateInput(now);

    return logs.filter((entry) => {
      // Behavior filter
      if (behavior === 'incomplete') {
        if (!entry.isExpressPending) return false;
      } else if (behavior !== 'all') {
        if (entry.behavior !== behavior && entry.behavior !== 'both') return false;
      }

      // Date filter
      const entryTimeMs = parseDateTimeInputs(entry.date, entry.time).getTime();
      if (days === 'today') {
        if (entry.date !== todayStr) return false;
      } else if (days === 'custom') {
        if (startDate && entry.date < startDate) return false;
        if (endDate && entry.date > endDate) return false;
      } else if (days !== 'all') {
        const numDays = parseInt(days, 10);
        if (!isNaN(numDays)) {
          const cutoff = Date.now() - numDays * 86400000;
          if (entryTimeMs < cutoff) return false;
        }
      }

      // Search filter
      if (search) {
        const hay = [
          entry.behavior,
          entry.awareness,
          ...(entry.environments || []),
          ...(entry.priorTasks || []),
          entry.priorTaskNote,
          ...(entry.bodyLocations || []),
          ...(entry.sensoryStates || []),
          entry.sensoryNote,
          ...(entry.triggers || []),
          entry.triggerNote,
          ...(entry.emotions || []),
          entry.thoughts,
          entry.date
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }

      return true;
    });
  }

  function combineListAndNote(arr, note) {
    const listStr = Array.isArray(arr) && arr.length ? arr.join(', ') : '';
    if (listStr && note) return `${listStr} — "${note}"`;
    if (listStr) return listStr;
    if (note) return note;
    return '';
  }

  function renderHistoryView() {
    const container = $('historyList');
    if (!container) return;

    const filtered = filterLogs({
      behavior: historyFilterBehavior,
      days: historyFilterDate,
      search: historySearchQuery
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No matching log entries</h3>
          <p>${logs.length === 0 ? 'Use the Log Episode tab or 1-Tap Express Stamp to record your first entry.' : 'Try adjusting your filters or search query above.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    filtered.forEach((entry) => {
      const card = document.createElement('article');
      card.className = `history-card ${entry.behavior}-border`;

      const readable = formatReadableDateTime(entry.timestamp, entry.date, entry.time);
      const priorTaskDisplay = combineListAndNote(entry.priorTasks, entry.priorTaskNote);
      const triggerDisplay = combineListAndNote(entry.triggers, entry.triggerNote);
      const sensoryDisplay = combineListAndNote(
        [...(entry.bodyLocations || []), ...(entry.sensoryStates || [])],
        entry.sensoryNote
      );
      const envDisplay = Array.isArray(entry.environments) && entry.environments.length ? entry.environments.join(', ') : '';
      const emotionsDisplay = Array.isArray(entry.emotions) && entry.emotions.length ? entry.emotions.join(', ') : '';

      const detailRows = [];
      if (priorTaskDisplay) {
        detailRows.push({ label: 'Prior Task Before Occurrence', value: priorTaskDisplay });
      }
      if (triggerDisplay) {
        detailRows.push({ label: 'Trigger', value: triggerDisplay });
      }
      if (emotionsDisplay || entry.thoughts) {
        const combinedEmo = [emotionsDisplay, entry.thoughts ? `"${entry.thoughts}"` : ''].filter(Boolean).join(' — ');
        detailRows.push({ label: 'Emotions & Thoughts', value: combinedEmo });
      }
      if (envDisplay || sensoryDisplay) {
        const combinedCtx = [
          envDisplay ? `Setting: ${envDisplay}` : '',
          sensoryDisplay ? `Body/Sensory: ${sensoryDisplay}` : ''
        ]
          .filter(Boolean)
          .join(' | ');
        detailRows.push({ label: 'Environment & Sensory State', value: combinedCtx });
      }

      card.innerHTML = `
        <div class="history-card-header">
          <div class="history-meta">
            <span class="badge-behavior ${escapeHtml(entry.behavior)}">${escapeHtml(getBehaviorDisplayName(entry.behavior))}</span>
            ${entry.isExpressPending ? '<span class="badge-incomplete">⚡ Needs Details</span>' : ''}
            <span class="history-timestamp">${escapeHtml(readable.full)}</span>
          </div>
        </div>

        <div class="history-submeta">
          <span class="submeta-pill">Awareness: <strong>${escapeHtml(entry.awareness || 'Unrecorded')}</strong></span>
          ${entry.intensity ? `<span class="submeta-pill">Urge Intensity: <strong>${entry.intensity}/5</strong></span>` : ''}
          ${entry.duration ? `<span class="submeta-pill">Duration: <strong>${escapeHtml(entry.duration)}</strong></span>` : ''}
        </div>

        ${
          detailRows.length > 0
            ? `<div class="history-details-grid">
                ${detailRows
                  .map(
                    (r) => `
                  <div class="detail-row">
                    <span class="detail-label">${escapeHtml(r.label)}</span>
                    <span class="detail-value">${escapeHtml(r.value)}</span>
                  </div>`
                  )
                  .join('')}
              </div>`
            : `<div class="history-details-grid">
                <div class="detail-row">
                  <span class="detail-value" style="color: var(--text-muted); font-style: italic;">
                    Quick-stamped entry — tap "${entry.isExpressPending ? 'Complete Details' : 'Edit'}" below to log triggers, prior task, and thoughts.
                  </span>
                </div>
              </div>`
        }

        <div class="history-card-actions">
          <button type="button" class="${entry.isExpressPending ? 'btn-primary-sm' : 'btn-secondary-sm'} edit-entry-btn">
            ${entry.isExpressPending ? '⚡ Complete Details' : 'Edit'}
          </button>
          <button type="button" class="btn-danger-sm delete-entry-btn">Delete</button>
        </div>
      `;

      card.querySelector('.edit-entry-btn').addEventListener('click', () => {
        startEditingEntry(entry.id);
      });

      card.querySelector('.delete-entry-btn').addEventListener('click', () => {
        openConfirmModal(
          'Delete Log Entry',
          `Delete this ${getBehaviorDisplayName(entry.behavior)} log from ${readable.full}?`,
          () => {
            logs = logs.filter((l) => l.id !== entry.id);
            saveLogs();
            updateAllViews();
            showToast('Entry deleted.');
          }
        );
      });

      container.appendChild(card);
    });
  }

  // --- Insights & Patterns View ---
  function bindInsightsFilters() {
    document.querySelectorAll('#insightsRangeGroup .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        insightsDays = btn.getAttribute('data-insights-days');
        document.querySelectorAll('#insightsRangeGroup .chip').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-insights-days') === insightsDays);
        });
        renderInsightsView();
      });
    });

    document.querySelectorAll('#insightsBehaviorGroup .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        insightsBehavior = btn.getAttribute('data-insights-behavior');
        document.querySelectorAll('#insightsBehaviorGroup .chip').forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-insights-behavior') === insightsBehavior);
        });
        renderInsightsView();
      });
    });
  }

  function computeAnalytics(entries) {
    const total = entries.length;
    let excoriationCount = 0;
    let masturbationCount = 0;
    let bothCount = 0;

    let intensitySum = 0;
    let intensityCount = 0;

    const awarenessCounts = {};
    const timeBuckets = {
      'Morning (6 AM – 12 PM)': 0,
      'Afternoon (12 PM – 6 PM)': 0,
      'Evening (6 PM – 11 PM)': 0,
      'Late Night / Overnight (11 PM – 6 AM)': 0
    };
    const durationCounts = {};
    const triggerCounts = {};
    const priorTaskCounts = {};
    const emotionCounts = {};
    const environmentCounts = {};
    const bodyLocationCounts = {};
    const sensoryCounts = {};

    const increment = (map, key) => {
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    };

    entries.forEach((e) => {
      if (e.behavior === 'excoriation') excoriationCount++;
      else if (e.behavior === 'masturbation') masturbationCount++;
      else if (e.behavior === 'both') bothCount++;

      if (e.intensity) {
        intensitySum += Number(e.intensity);
        intensityCount++;
      }

      if (e.awareness) increment(awarenessCounts, e.awareness);
      if (e.duration) increment(durationCounts, e.duration);

      const readable = formatReadableDateTime(e.timestamp, e.date, e.time);
      const bucket = getTimeOfDayBucket(readable.hour24);
      increment(timeBuckets, bucket);

      (e.triggers || []).forEach((t) => increment(triggerCounts, t));
      if (e.triggerNote && (!e.triggers || e.triggers.length === 0)) increment(triggerCounts, e.triggerNote);

      (e.priorTasks || []).forEach((t) => increment(priorTaskCounts, t));
      if (e.priorTaskNote && (!e.priorTasks || e.priorTasks.length === 0)) increment(priorTaskCounts, e.priorTaskNote);

      (e.emotions || []).forEach((em) => increment(emotionCounts, em));
      (e.environments || []).forEach((env) => increment(environmentCounts, env));
      (e.bodyLocations || []).forEach((loc) => increment(bodyLocationCounts, loc));
      (e.sensoryStates || []).forEach((s) => increment(sensoryCounts, s));
    });

    const sortMap = (map) =>
      Object.entries(map)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]);

    const autoCount = awarenessCounts['Automatic (Zoned out)'] || 0;
    const autoPct = total > 0 ? Math.round((autoCount / total) * 100) : 0;
    const avgIntensity = intensityCount > 0 ? (intensitySum / intensityCount).toFixed(1) : '—';

    const sortedTime = sortMap(timeBuckets);
    const peakTime = sortedTime.length > 0 ? sortedTime[0][0].split(' (')[0] : '—';

    return {
      total,
      excoriationCount,
      masturbationCount,
      bothCount,
      autoPct,
      avgIntensity,
      peakTime,
      timeBuckets: Object.entries(timeBuckets),
      awarenessSorted: sortMap(awarenessCounts),
      durationSorted: sortMap(durationCounts),
      triggersSorted: sortMap(triggerCounts),
      priorTasksSorted: sortMap(priorTaskCounts),
      emotionsSorted: sortMap(emotionCounts),
      environmentsSorted: sortMap(environmentCounts),
      bodyLocationsSorted: sortMap(bodyLocationCounts),
      sensorySorted: sortMap(sensoryCounts)
    };
  }

  function renderBarList(containerId, items, totalEpisodes, maxItems = 6) {
    const container = $(containerId);
    if (!container) return;

    const nonZero = items.filter(([, c]) => c > 0).slice(0, maxItems);
    if (nonZero.length === 0 || totalEpisodes === 0) {
      container.innerHTML = `<p class="label-hint">Not enough logged data yet for this period.</p>`;
      return;
    }

    container.innerHTML = nonZero
      .map(([name, count]) => {
        const pct = Math.round((count / totalEpisodes) * 100);
        return `
          <div class="bar-item">
            <div class="bar-item-top">
              <span class="bar-item-name">${escapeHtml(name)}</span>
              <span class="bar-item-count">${count} (${pct}%)</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${Math.max(pct, 6)}%"></div>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderInsightsView() {
    const filtered = filterLogs({
      behavior: insightsBehavior,
      days: insightsDays
    });
    const stats = computeAnalytics(filtered);

    const summaryEl = $('insightsSummaryCards');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="metric-card">
          <div class="metric-label">Total Logged</div>
          <div class="metric-value">${stats.total}</div>
          <div class="metric-sub">${stats.excoriationCount} ${escapeHtml(getBehaviorDisplayName('excoriation'))} · ${stats.masturbationCount} ${escapeHtml(getBehaviorDisplayName('masturbation'))}${stats.bothCount ? ` · ${stats.bothCount} Both` : ''}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Automatic Awareness</div>
          <div class="metric-value">${stats.total ? `${stats.autoPct}%` : '—'}</div>
          <div class="metric-sub">Started zoned-out / unconscious</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Urge Intensity</div>
          <div class="metric-value">${stats.avgIntensity}${stats.avgIntensity !== '—' ? ' / 5' : ''}</div>
          <div class="metric-sub">Across rated episodes</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Peak Time Window</div>
          <div class="metric-value" style="font-size: 1.15rem; margin-top: 8px;">${escapeHtml(stats.peakTime)}</div>
          <div class="metric-sub">Most active time of day</div>
        </div>
      `;
    }

    renderBarList('timeOfDayBars', stats.timeBuckets, stats.total, 4);
    renderBarList('awarenessBars', stats.awarenessSorted, stats.total, 4);
    renderBarList('topTriggersBars', stats.triggersSorted, stats.total, 6);
    renderBarList('topPriorTasksBars', stats.priorTasksSorted, stats.total, 6);
    renderBarList('topEmotionsBars', stats.emotionsSorted, stats.total, 6);

    const combinedContext = [
      ...stats.environmentsSorted.map(([k, v]) => [`Setting: ${k}`, v]),
      ...stats.bodyLocationsSorted.map(([k, v]) => [`Site: ${k}`, v]),
      ...stats.sensorySorted.map(([k, v]) => [`Sensory: ${k}`, v])
    ].sort((a, b) => b[1] - a[1]);

    renderBarList('topContextBars', combinedContext, stats.total, 7);
  }

  // --- Therapist Report (.txt) Export ---
  function bindExportControls() {
    const presetEl = $('exportDatePreset');
    const customRow = $('exportCustomDatesRow');

    const now = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    $('exportEndDate').value = formatDateInput(now);
    $('exportStartDate').value = formatDateInput(sevenDaysAgo);

    presetEl.addEventListener('change', () => {
      if (presetEl.value === 'custom') {
        customRow.classList.remove('hidden');
      } else {
        customRow.classList.add('hidden');
      }
      renderExportPreview();
    });

    $('exportBehaviorFilter').addEventListener('change', renderExportPreview);
    $('exportSortOrder').addEventListener('change', renderExportPreview);
    $('exportStartDate').addEventListener('change', renderExportPreview);
    $('exportEndDate').addEventListener('change', renderExportPreview);

    $('downloadTxtBtn').addEventListener('click', downloadTxtReport);
    $('copyTxtBtn').addEventListener('click', copyTxtReportToClipboard);

    // JSON Backup & Restore
    $('exportJsonBtn').addEventListener('click', downloadJsonBackup);
    $('importJsonInput').addEventListener('change', handleJsonRestore);
    $('clearAllDataBtn').addEventListener('click', () => {
      openConfirmModal(
        'Clear All Logged Data',
        'Are you sure you want to permanently delete all logged entries from this browser? Consider downloading a .txt or .json backup first.',
        () => {
          logs = [];
          saveLogs();
          updateAllViews();
          showToast('All logs cleared.');
        }
      );
    });
  }

  function generateTherapistTxtReport() {
    const datePreset = $('exportDatePreset').value;
    const behaviorFilter = $('exportBehaviorFilter').value;
    const sortOrder = $('exportSortOrder').value;
    const startDate = $('exportStartDate').value;
    const endDate = $('exportEndDate').value;

    const filtered = filterLogs({
      behavior: behaviorFilter,
      days: datePreset,
      startDate,
      endDate
    });

    const ordered = [...filtered].sort((a, b) => {
      const ta = parseDateTimeInputs(a.date, a.time).getTime();
      const tb = parseDateTimeInputs(b.date, b.time).getTime();
      return sortOrder === 'asc' ? ta - tb : tb - ta;
    });

    const stats = computeAnalytics(filtered);
    const nowReadable = formatReadableDateTime(Date.now());

    let periodLabel = 'All Logged Entries';
    if (datePreset === '7') periodLabel = 'Past 7 Days (Weekly Session Review)';
    else if (datePreset === '14') periodLabel = 'Past 14 Days (Biweekly Session Review)';
    else if (datePreset === '30') periodLabel = 'Past 30 Days (Monthly Review)';
    else if (datePreset === 'custom') periodLabel = `Custom Range (${startDate || 'Start'} to ${endDate || 'Present'})`;

    const formatTopItems = (arr, total, limit = 5) => {
      if (!arr || arr.length === 0 || total === 0) return '  - None recorded in this period';
      return arr
        .slice(0, limit)
        .map(([name, count]) => `  - ${name}: ${count}x (${Math.round((count / total) * 100)}%)`)
        .join('\n');
    };

    const lines = [];
    lines.push('========================================================================');
    lines.push('                 THERAPY BEHAVIORAL & CONTEXT LOG REPORT                ');
    lines.push('              (MDD, Recurrent | Excoriation & Behavioral Log)           ');
    lines.push('========================================================================');
    lines.push(`Report Generated : ${nowReadable.full}`);
    lines.push(`Reporting Period : ${periodLabel}`);
    lines.push(`Total Episodes   : ${stats.total}`);
    lines.push('------------------------------------------------------------------------');
    lines.push('');
    lines.push('PART 1: THERAPIST PATTERN SUMMARY');
    lines.push('=================================');
    lines.push('');
    lines.push('1. Episode Counts by Behavior:');
    lines.push(`  - Excoriation (Skin Picking) : ${stats.excoriationCount}`);
    lines.push(`  - Masturbation               : ${stats.masturbationCount}`);
    if (stats.bothCount > 0) {
      lines.push(`  - Both (Co-occurring)        : ${stats.bothCount}`);
    }
    lines.push('');
    lines.push('2. Awareness & Urge Intensity (ComB Profile):');
    lines.push(`  - Average Urge Intensity     : ${stats.avgIntensity}${stats.avgIntensity !== '—' ? ' / 5.0' : ''}`);
    if (stats.awarenessSorted.length > 0) {
      stats.awarenessSorted.forEach(([aw, cnt]) => {
        lines.push(`  - ${aw.padEnd(26)} : ${cnt}x (${Math.round((cnt / stats.total) * 100)}%)`);
      });
    } else {
      lines.push('  - Awareness Level            : No data');
    }
    lines.push('');
    lines.push('3. Time-of-Day Distribution:');
    stats.timeBuckets.forEach(([bucket, cnt]) => {
      if (cnt > 0 || stats.total === 0) {
        const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
        lines.push(`  - ${bucket.padEnd(38)} : ${cnt}x (${pct}%)`);
      }
    });
    lines.push('');
    lines.push('4. Most Frequent Prior Tasks (Before Occurrence):');
    lines.push(formatTopItems(stats.priorTasksSorted, stats.total, 6));
    lines.push('');
    lines.push('5. Most Frequent Triggers:');
    lines.push(formatTopItems(stats.triggersSorted, stats.total, 6));
    lines.push('');
    lines.push('6. Most Frequent Emotions & Internal States:');
    lines.push(formatTopItems(stats.emotionsSorted, stats.total, 6));
    lines.push('');
    lines.push('7. Common Environments, Target Sites & Sensory States:');
    lines.push('  [Environments]');
    lines.push(formatTopItems(stats.environmentsSorted, stats.total, 4));
    if (stats.bodyLocationsSorted.length > 0) {
      lines.push('  [Target Body Areas - Excoriation]');
      lines.push(formatTopItems(stats.bodyLocationsSorted, stats.total, 4));
    }
    if (stats.sensorySorted.length > 0) {
      lines.push('  [Sensory / Physical States]');
      lines.push(formatTopItems(stats.sensorySorted, stats.total, 4));
    }
    lines.push('');
    lines.push('========================================================================');
    lines.push(`PART 2: CHRONOLOGICAL EPISODE LOG (${ordered.length} ${ordered.length === 1 ? 'ENTRY' : 'ENTRIES'})`);
    lines.push('========================================================================');
    lines.push('');

    if (ordered.length === 0) {
      lines.push('No episodes logged for the selected filter criteria.');
    } else {
      ordered.forEach((entry, idx) => {
        const readable = formatReadableDateTime(entry.timestamp, entry.date, entry.time);
        const behaviorLabel = getBehaviorDisplayName(entry.behavior, true);
        const priorTaskStr = combineListAndNote(entry.priorTasks, entry.priorTaskNote) || 'Not specified';
        const triggerStr = combineListAndNote(entry.triggers, entry.triggerNote) || 'Not specified';
        const envStr = (entry.environments && entry.environments.length) ? entry.environments.join(', ') : 'Not specified';
        const bodyStr = (entry.bodyLocations && entry.bodyLocations.length) ? entry.bodyLocations.join(', ') : '';
        const sensoryStr = combineListAndNote(entry.sensoryStates, entry.sensoryNote) || 'Not specified';
        const emotionsStr = (entry.emotions && entry.emotions.length) ? entry.emotions.join(', ') : 'Not specified';
        const thoughtsStr = entry.thoughts || 'None noted';

        lines.push(`ENTRY #${idx + 1}${entry.isExpressPending ? ' [EXPRESS STAMP - DETAILS PENDING]' : ''}`);
        lines.push(`  Date & Time       : ${readable.datePart} | ${readable.timePart}`);
        lines.push(`  Behavior Type     : ${behaviorLabel}`);
        lines.push(`  Awareness Level   : ${entry.awareness || 'Not specified'}`);
        lines.push(`  Intensity & Dur.  : ${entry.intensity ? `${entry.intensity}/5 intensity` : 'Unrated'} | Duration: ${entry.duration || 'Not specified'}`);
        lines.push(`  Environment       : ${envStr}`);
        if (bodyStr) {
          lines.push(`  Target Body Area  : ${bodyStr}`);
        }
        lines.push(`  Sensory / Physical: ${sensoryStr}`);
        lines.push(`  Prior Task        : ${priorTaskStr}`);
        lines.push(`  Trigger(s)        : ${triggerStr}`);
        lines.push(`  Emotions          : ${emotionsStr}`);
        lines.push(`  Thoughts / Notes  : ${thoughtsStr}`);
        lines.push('------------------------------------------------------------------------');
      });
    }

    return {
      text: lines.join('\n'),
      count: ordered.length
    };
  }

  function renderExportPreview() {
    const previewEl = $('txtReportPreview');
    const countLabel = $('exportEntryCountLabel');
    if (!previewEl || !countLabel) return;

    const { text, count } = generateTherapistTxtReport();
    previewEl.value = text;
    countLabel.textContent = `${count} ${count === 1 ? 'entry' : 'entries'} included`;
  }

  function downloadTxtReport() {
    const { text } = generateTherapistTxtReport();
    const dateStamp = formatDateInput(new Date());
    const filename = `therapy-behavior-log-${dateStamp}.txt`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${filename}`);
  }

  function copyTxtReportToClipboard() {
    const { text } = generateTherapistTxtReport();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const label = $('copyTxtBtnLabel');
        label.textContent = 'Copied to Clipboard!';
        showToast('Report text copied to clipboard.');
        setTimeout(() => {
          label.textContent = 'Copy Text to Clipboard';
        }, 2200);
      });
    } else {
      const previewEl = $('txtReportPreview');
      previewEl.select();
      document.execCommand('copy');
      showToast('Report text copied to clipboard.');
    }
  }

  // --- JSON Backup & Restore ---
  function downloadJsonBackup() {
    const payload = {
      app: 'SteadyLog',
      version: 1,
      exportedAt: new Date().toISOString(),
      logs,
      customChips
    };
    const dateStamp = formatDateInput(new Date());
    const filename = `steadylog-backup-${dateStamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Backup saved as ${filename}`);
  }

  function handleJsonRestore(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target.result));
        const incomingLogs = Array.isArray(parsed) ? parsed : parsed.logs;
        if (!Array.isArray(incomingLogs)) {
          showToast('Invalid backup file format.');
          return;
        }

        const existingIds = new Set(logs.map((l) => l.id));
        let addedCount = 0;
        incomingLogs.forEach((item) => {
          if (item && item.id && !existingIds.has(item.id)) {
            logs.push(item);
            existingIds.add(item.id);
            addedCount++;
          }
        });

        if (parsed.customChips && typeof parsed.customChips === 'object') {
          Object.keys(customChips).forEach((cat) => {
            if (Array.isArray(parsed.customChips[cat])) {
              parsed.customChips[cat].forEach((tag) => {
                if (!customChips[cat].includes(tag) && !DEFAULT_CHIPS[cat].includes(tag)) {
                  customChips[cat].push(tag);
                }
              });
            }
          });
          saveCustomChips();
          renderAllChipGroups();
        }

        sortLogsChronologically();
        saveLogs();
        updateAllViews();
        showToast(`Restored ${addedCount} new log ${addedCount === 1 ? 'entry' : 'entries'}.`);
      } catch (err) {
        showToast('Could not parse JSON backup file.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // --- Modals (Custom Chip & Confirmation) ---
  function bindModals() {
    $('cancelCustomChipBtn').addEventListener('click', closeCustomChipModal);
    $('customChipModal').addEventListener('click', (e) => {
      if (e.target === $('customChipModal')) closeCustomChipModal();
    });

    $('customChipForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = $('customChipInput').value.trim();
      if (!val || !activeCustomChipCategory) return;

      const cat = activeCustomChipCategory;
      if (!DEFAULT_CHIPS[cat].includes(val) && !customChips[cat].includes(val)) {
        customChips[cat].push(val);
        saveCustomChips();
      }
      selectedChips[cat].add(val);
      renderAllChipGroups();
      closeCustomChipModal();
      showToast(`Added "${val}" tag.`);
    });

    $('confirmCancelBtn').addEventListener('click', closeConfirmModal);
    $('confirmModal').addEventListener('click', (e) => {
      if (e.target === $('confirmModal')) closeConfirmModal();
    });
    $('confirmProceedBtn').addEventListener('click', () => {
      if (typeof confirmCallback === 'function') confirmCallback();
      closeConfirmModal();
    });
  }

  function openCustomChipModal(category) {
    activeCustomChipCategory = category;
    const categoryNames = {
      environments: 'Environment / Setting',
      priorTasks: 'Prior Task',
      bodyLocations: 'Target Body Area',
      sensoryStates: 'Sensory / Physical State',
      triggers: 'Trigger',
      emotions: 'Emotion / Internal State'
    };
    $('customChipModalTitle').textContent = `Add Custom ${categoryNames[category] || 'Tag'}`;
    $('customChipInput').value = '';
    $('customChipModal').classList.remove('hidden');
    setTimeout(() => $('customChipInput').focus(), 50);
  }

  function closeCustomChipModal() {
    $('customChipModal').classList.add('hidden');
    activeCustomChipCategory = null;
  }

  function openConfirmModal(title, desc, onConfirm) {
    $('confirmModalTitle').textContent = title;
    $('confirmModalDesc').textContent = desc;
    confirmCallback = onConfirm;
    $('confirmModal').classList.remove('hidden');
  }

  function closeConfirmModal() {
    $('confirmModal').classList.add('hidden');
    confirmCallback = null;
  }

  // --- Toast Notifications ---
  function showToast(message, actions = []) {
    const container = $('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (actions.length > 0) {
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'toast-actions';
      actions.forEach((act) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-btn';
        btn.textContent = act.label;
        btn.addEventListener('click', () => {
          act.onClick();
          toast.remove();
        });
        actionsWrap.appendChild(btn);
      });
      toast.appendChild(actionsWrap);
    }

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5500);
  }

  // --- Utility ---
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
