/* LexEdu — Legal Education Bot Frontend */
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  audience: 'student',
  activeTab: 'analysis',
  activePlatform: 'linkedin',
  analysisText: '',
  carouselData: { linkedin: null, instagram: null },
  isAnalyzing: false,
  isGenerating: false,
};

// ── Slide type metadata ────────────────────────────────────────────────────
const SLIDE_GRADIENTS = {
  hook:         'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  context:      'linear-gradient(135deg, #0f3460 0%, #16213e 100%)',
  definition:   'linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)',
  case_example: 'linear-gradient(135deg, #7B2D00 0%, #B5451B 100%)',
  jurisprudence:'linear-gradient(135deg, #4A0E8F 0%, #7B2FBE 100%)',
  impact:       'linear-gradient(135deg, #1a3a5c 0%, #2E6DA4 100%)',
  summary:      'linear-gradient(135deg, #003049 0%, #023E7D 100%)',
  cta:          'linear-gradient(135deg, #B5179E 0%, #7209B7 100%)',
  default:      'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
};
const SLIDE_ICONS = {
  hook:'⚖️', context:'📖', definition:'📝', case_example:'🏛️',
  jurisprudence:'🔍', impact:'🌍', summary:'💡', cta:'📌', default:'⚖️',
};

// ── DOM helpers ────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'info') {
  const container = $('#toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setStatus(msg, state = 'idle') {
  const bar = $('#status-bar');
  const dot = $('#status-dot');
  const txt = $('#status-text');
  if (!bar) return;
  txt.textContent = msg;
  dot.className = 'status-dot';
  if (state === 'loading') dot.classList.add('loading');
  else if (state === 'active') dot.classList.add('active');
  else if (state === 'error') dot.classList.add('error');
}

function setButtonLoading(btnId, loading, label = '') {
  const btn = $(`#${btnId}`);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<div class="spinner"></div> ${label}`;
  } else {
    btn.innerHTML = btn.dataset.originalText || label;
  }
}

// ── Audience selection ─────────────────────────────────────────────────────
function selectAudience(audience) {
  state.audience = audience;
  $$('.audience-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.audience === audience);
  });
}

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
}

function switchPlatform(platform) {
  state.activePlatform = platform;
  $$('.platform-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.platform === platform)
  );
  renderCarouselDisplay();
}

// ── Analysis streaming ─────────────────────────────────────────────────────
async function runAnalysis() {
  const topic = $('#topic-input').value.trim();
  const url = $('#url-input').value.trim();
  const rawText = $('#raw-text').value.trim();

  if (!topic) { showToast('Please enter a legal topic.', 'error'); return; }
  if (!url && !rawText) {
    showToast('Provide a URL or paste some text content.', 'error'); return;
  }

  state.isAnalyzing = true;
  state.analysisText = '';
  setButtonLoading('analyze-btn', true, 'Analyzing...');
  setStatus('Fetching and analyzing legal content...', 'loading');
  switchTab('analysis');

  const contentEl = $('#analysis-content');
  contentEl.innerHTML = '<span class="analysis-cursor"></span>';

  const formData = new FormData();
  formData.append('topic', topic);
  formData.append('audience', state.audience);
  if (url) formData.append('url', url);
  if (rawText) formData.append('raw_text', rawText);

  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Analysis failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) {
            fullText += data.chunk;
            state.analysisText = fullText;
            contentEl.innerHTML = renderMarkdown(fullText) + '<span class="analysis-cursor"></span>';
            contentEl.scrollTop = contentEl.scrollHeight;
          }
          if (data.done) {
            contentEl.innerHTML = renderMarkdown(fullText);
            setStatus('Analysis complete', 'active');
          }
          if (data.error) throw new Error(data.error);
        } catch (e) { /* skip malformed chunks */ }
      }
    }
  } catch (err) {
    contentEl.innerHTML = `<div style="color:#E63946;padding:20px;">Error: ${err.message}</div>`;
    setStatus('Error during analysis', 'error');
    showToast(err.message, 'error');
  } finally {
    state.isAnalyzing = false;
    setButtonLoading('analyze-btn', false);
  }
}

// ── Simple markdown renderer ───────────────────────────────────────────────
function renderMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hbulpcodt])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '');
}

// ── Carousel generation ────────────────────────────────────────────────────
async function generateCarousels() {
  const topic = $('#topic-input').value.trim();
  const url = $('#url-input').value.trim();
  const rawText = $('#raw-text').value.trim();

  if (!topic) { showToast('Please enter a legal topic.', 'error'); return; }

  state.isGenerating = true;
  setButtonLoading('carousel-btn', true, 'Generating carousels...');
  setStatus('Generating LinkedIn + Instagram carousels...', 'loading');
  switchTab('carousel');

  const formData = new FormData();
  formData.append('topic', topic);
  formData.append('audience', state.audience);
  formData.append('analysis_text', state.analysisText);
  if (url) formData.append('url', url);
  if (rawText) formData.append('raw_text', rawText);

  try {
    const response = await fetch('/api/carousel/generate', { method: 'POST', body: formData });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Carousel generation failed');
    }
    const data = await response.json();
    state.carouselData.linkedin = data.linkedin;
    state.carouselData.instagram = data.instagram;

    renderCarouselDisplay();
    renderSummaryBadge(data.summary);
    setStatus('Carousels ready — scroll to preview all slides', 'active');
    showToast('Carousels generated for LinkedIn + Instagram!', 'success');
  } catch (err) {
    setStatus('Error generating carousels', 'error');
    showToast(err.message, 'error');
    console.error(err);
  } finally {
    state.isGenerating = false;
    setButtonLoading('carousel-btn', false);
    $('#export-btn').disabled = false;
  }
}

// ── Render carousel slides ─────────────────────────────────────────────────
function renderCarouselDisplay() {
  const data = state.carouselData[state.activePlatform];
  const container = $('#carousel-slides');
  const placeholder = $('#carousel-placeholder');

  if (!data || !data.slides) {
    if (placeholder) placeholder.style.display = 'block';
    if (container) container.innerHTML = '';
    return;
  }
  if (placeholder) placeholder.style.display = 'none';

  container.innerHTML = data.slides.map(slide => renderSlideCard(slide, data.slides.length)).join('');
}

function renderSlideCard(slide, total) {
  const slideType = slide.type || 'default';
  const gradient = SLIDE_GRADIENTS[slideType] || SLIDE_GRADIENTS.default;
  const icon = SLIDE_ICONS[slideType] || SLIDE_ICONS.default;
  const emoji = slide.emoji || '';

  let bodyContent = '';
  if (slide.subtext) {
    bodyContent += `<div class="slide-subtext-sm">${esc(slide.subtext)}</div>`;
  }
  if (Array.isArray(slide.points) && slide.points.length) {
    bodyContent += `<div class="slide-points-list">` +
      slide.points.map(p =>
        `<div class="slide-point"><span class="slide-dot"></span>${esc(p)}</div>`
      ).join('') +
      `</div>`;
  }
  if (slide.key_takeaway) {
    bodyContent += `<div style="background:rgba(255,255,255,0.1);border-radius:6px;padding:6px 10px;font-size:0.66rem;color:rgba(255,255,255,0.85);font-style:italic;margin-top:4px;">${esc(slide.key_takeaway)}</div>`;
  }

  return `
    <div class="slide-card" style="background:${gradient};" title="Slide ${slide.slide_number}: ${esc(slide.headline)}">
      <div class="slide-card-header">
        <span class="slide-num-badge">${slide.slide_number}/${total}</span>
        <span class="slide-brand">⚖ LexEdu</span>
        <span class="slide-type-emoji">${icon}</span>
      </div>
      <div class="slide-card-body">
        ${emoji ? `<div class="slide-emoji-lg">${emoji}</div>` : ''}
        <div class="slide-headline-text">${esc(slide.headline)}</div>
        ${bodyContent}
      </div>
      <div class="slide-visual-hint">Visual: ${esc(slide.visual_suggestion || '')}</div>
    </div>`;
}

function renderSummaryBadge(summary) {
  const el = $('#summary-badge');
  if (!el || !summary) return;
  el.innerHTML = `
    <span style="background:rgba(123,47,190,0.2);border:1px solid rgba(123,47,190,0.4);border-radius:6px;padding:4px 10px;font-size:0.7rem;color:#9b87f5;font-weight:600;">${esc(summary.legal_domain || '')}</span>
    <span style="background:rgba(244,162,97,0.15);border:1px solid rgba(244,162,97,0.3);border-radius:6px;padding:4px 10px;font-size:0.7rem;color:#F4A261;font-weight:600;">${esc(summary.jurisdiction || '')}</span>
    <span style="font-size:0.8rem;color:#8888aa;flex:1;">${esc(summary.summary || '')}</span>`;
  el.style.display = 'flex';
}

// ── Export text ────────────────────────────────────────────────────────────
async function exportText() {
  const data = state.carouselData[state.activePlatform];
  if (!data) { showToast('Generate carousels first.', 'error'); return; }

  try {
    const response = await fetch('/api/carousel/export-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carousel_data: data }),
    });
    const result = await response.json();
    const exportBox = $('#export-text-box');
    if (exportBox) {
      exportBox.textContent = result.text;
      exportBox.style.display = 'block';
    }
    showToast('Text export ready below the carousels.', 'success');
  } catch (err) {
    showToast('Export failed: ' + err.message, 'error');
  }
}

async function copyAnalysis() {
  if (!state.analysisText) return;
  await navigator.clipboard.writeText(state.analysisText);
  showToast('Analysis copied to clipboard!', 'success');
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  selectAudience('student');
  setStatus('Ready — enter a topic to begin', 'idle');
});
