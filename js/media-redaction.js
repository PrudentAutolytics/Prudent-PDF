/* Prudent Redact multimedia redaction workspace */
'use strict';
(function () {
  Shell.init('tools');
  const $ = id => document.getElementById(id);
  const canvas = $('mediaCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const video = $('sourceVideo');
  const input = $('mediaInput');
  const state = {
    mode: 'image',
    sourceFile: null,
    sourceUrl: null,
    image: null,
    regions: [],
    effect: 'black',
    drawing: null,
    outputUrl: null,
    faceDetector: null,
    faceDetectorKind: null,
    faceModelReady: false,
    lastFaceBoxes: [],
    videoFrameBusy: false,
    exportAbort: false,
    batch: [],
    pendingFiles: [],
    faceDetectionBusy: false
  };

  const HELP = {
    processing: ['Local media processing', 'The editor works with media bytes in this browser workspace. A successful export sends only minimal operation metadata to the usage API. The PDF and redaction Power Automate contract is not changed.'],
    effect: ['Redaction effect', 'Black permanently covers the selected pixels. Blur and pixelation transform the selected visual region. For the strongest visual removal, use Black.'],
    faces: ['Face privacy', 'Prudent Redact uses a self-hosted local face model to scan images immediately after upload when automatic face privacy is enabled. Detected face boxes are mapped from original media coordinates to the review canvas, padded for safer coverage, and masked with the selected effect. Review coverage before export.'],
    regions: ['Redaction regions', 'Draw rectangles directly over sensitive content. Manual regions are reviewer-controlled. In video mode, manual regions remain fixed for the full video export.'],
    videoScope: ['Video face tracking', 'When enabled, Prudent Redact refreshes detected face regions repeatedly during export and applies the selected Black, Blur, or Pixelate effect. The safety margin expands each detected face box. Manual boxes remain fixed for the entire clip.'],
    output: ['Controlled output', 'Export creates a new redacted file. The source remains unchanged. Successful export counts as one plan usage and sends a minimal usage event to the configured Power Automate trigger.']
  };

  function say(message) {
    $('statusLive').textContent = message;
  }
  function fmtTime(v) {
    if (!Number.isFinite(v)) return '00:00';
    const m = Math.floor(v / 60);
    const s = Math.floor(v % 60);
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function formatSize(bytes) {
    return bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(2)} MB`;
  }
  async function canvasToBlob(canvasEl, mime, quality) {
    const blob = await new Promise(resolve => {
      try { canvasEl.toBlob(resolve, mime, quality); } catch { resolve(null); }
    });
    if (blob && blob.size) return blob;
    const dataUrl = canvasEl.toDataURL(mime, quality);
    const comma = dataUrl.indexOf(',');
    if (comma < 0) throw new Error('Canvas export failed.');
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  async function sha256(blob) {
    const bytes = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2,'0')).join('');
  }
  function revoke(url) {
    if (url) URL.revokeObjectURL(url);
  }
  function safeName(name) {
    return String(name || 'media').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
  }

  function crc32(bytes) {
    let crc = 0 ^ -1;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
  }
  function u16(view, offset, value) { view.setUint16(offset, value, true); }
  function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  async function createZip(entries) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name);
      const bytes = new Uint8Array(await entry.blob.arrayBuffer());
      const crc = crc32(bytes);
      const local = new Uint8Array(30 + name.length);
      const lv = new DataView(local.buffer);
      u32(lv, 0, 0x04034b50); u16(lv, 4, 20); u16(lv, 6, 0); u16(lv, 8, 0);
      u16(lv, 10, 0); u16(lv, 12, 0); u32(lv, 14, crc); u32(lv, 18, bytes.length);
      u32(lv, 22, bytes.length); u16(lv, 26, name.length); u16(lv, 28, 0);
      local.set(name, 30);
      localParts.push(local, bytes);
      const central = new Uint8Array(46 + name.length);
      const cv = new DataView(central.buffer);
      u32(cv, 0, 0x02014b50); u16(cv, 4, 20); u16(cv, 6, 20); u16(cv, 8, 0); u16(cv, 10, 0);
      u16(cv, 12, 0); u16(cv, 14, 0); u32(cv, 16, crc); u32(cv, 20, bytes.length);
      u32(cv, 24, bytes.length); u16(cv, 28, name.length); u16(cv, 30, 0); u16(cv, 32, 0);
      u16(cv, 34, 0); u16(cv, 36, 0); u32(cv, 38, 0); u32(cv, 42, offset);
      central.set(name, 46);
      centralParts.push(central);
      offset += local.length + bytes.length;
    }
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0); u16(ev, 8, entries.length);
    u16(ev, 10, entries.length); u32(ev, 12, centralSize); u32(ev, 16, offset); u16(ev, 20, 0);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }
  function renderBatch() {
    const list = $('batchList');
    if (!state.batch.length) {
      list.innerHTML = '<div class="media-batch-empty">No exported media yet.</div>';
    } else {
      list.innerHTML = '';
      state.batch.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'media-batch-item';
        const name = document.createElement('div');
        name.className = 'media-batch-name';
        const strong = document.createElement('strong'); strong.textContent = item.name;
        const meta = document.createElement('span'); meta.textContent = `${item.operation.replaceAll('_',' ')} | ${formatSize(item.blob.size)}`;
        name.append(strong, meta);
        const link = document.createElement('a');
        link.className = 'btn btn-secondary btn-sm'; link.textContent = 'Download';
        link.href = item.url; link.download = item.name;
        const remove = document.createElement('button');
        remove.className = 'media-batch-remove'; remove.type = 'button'; remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove ${item.name} from batch`);
        remove.onclick = () => { revoke(item.url); state.batch.splice(index, 1); renderBatch(); };
        row.append(name, link, remove); list.appendChild(row);
      });
    }
    $('downloadBatch').disabled = !state.batch.length;
    $('downloadBatch').textContent = `Download batch ZIP (${state.batch.length})`;
    $('batchState').textContent = state.batch.length
      ? `${state.batch.length} controlled output${state.batch.length === 1 ? '' : 's'} ready in this browser batch.`
      : 'Exported files are added to this browser batch. Download them together as a ZIP.';
  }
  function addBatchOutput(name, blob, operation, hash) {
    const existing = state.batch.findIndex(item => item.name === name);
    if (existing >= 0) { revoke(state.batch[existing].url); state.batch.splice(existing, 1); }
    state.batch.push({ name, blob, operation, hash, createdAt: new Date().toISOString(), url: URL.createObjectURL(blob) });
    renderBatch();
  }
  function updateRegionUI() {
    $('regionSummary').textContent = `${state.regions.length} sensitive area${state.regions.length === 1 ? '' : 's'} selected`;
    $('stepDetect')?.classList.toggle('done', !!state.regions.length || (state.mode === 'video' && $('autoFaceVideo')?.checked && !!state.faceDetector));
    $('stepExport')?.classList.toggle('done', !!state.outputUrl);
    const assistedVideo = state.mode === 'video' && $('autoFaceVideo')?.checked && !!state.faceDetector;
    $('exportMedia').disabled = !state.sourceFile || (!state.regions.length && !assistedVideo);
    $('exportState').textContent = !state.sourceFile ? 'Select source media to begin.' : (!state.regions.length && !assistedVideo) ? 'Draw at least one region or enable supported face assistance.' : `Ready to create a new redacted ${state.mode === 'video' ? 'video' : 'image'} using ${state.regions.length} region${state.regions.length === 1 ? '' : 's'}.`;
    const operation = state.mode === 'video'
      ? ($('autoFaceVideo')?.checked ? 'VIDEO_FACE_REDACTION' : 'VIDEO_REDACTION')
      : (state.regions.some(r=>r.kind==='face') ? 'FACE_REDACTION' : 'IMAGE_REDACTION');
    const estimate = calcOperationCost(operation, 0, (state.sourceFile?.size || 0) / 1048576, 1);
    if ($('mediaPlatformCost')) $('mediaPlatformCost').textContent = estimate.platformFmt;
    if ($('mediaProductCost')) $('mediaProductCost').textContent = estimate.productFmt;
  }
  function setMode(mode) {
    if (state.sourceFile) resetSource();
    state.mode = mode;
    $('imageMode').classList.toggle('on', mode === 'image');
    $('videoMode').classList.toggle('on', mode === 'video');
    $('imageMode').setAttribute('aria-selected', String(mode === 'image'));
    $('videoMode').setAttribute('aria-selected', String(mode === 'video'));
    $('videoOptions').hidden = mode !== 'video';
    $('videoControls').hidden = true;
    input.accept = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v';
    $('dropTitle').textContent = mode === 'image' ? 'Select image or video' : 'Select video or image';
    $('dropHelp').textContent = mode === 'image'
      ? 'JPG, PNG, WebP, MP4, WebM, or browser-supported MOV. Media type is detected automatically.'
      : 'MP4, WebM, browser-supported MOV, JPG, PNG, or WebP. Media type is detected automatically.';
    $('selectMedia').textContent = 'Select media';
    $('exportMedia').textContent = mode === 'image' ? 'Export redacted image' : 'Export redacted video';
    updateRegionUI();
  }
  function resetSource() {
    revoke(state.sourceUrl); revoke(state.outputUrl);
    state.sourceUrl = null; state.outputUrl = null; state.sourceFile = null;
    if (state.image && typeof state.image.close === 'function') { try { state.image.close(); } catch {} }
    state.image = null;
    state.regions = []; state.lastFaceBoxes = []; state.drawing = null; state.exportAbort = true;
    video.pause(); video.removeAttribute('src'); video.load();
    ctx.clearRect(0,0,canvas.width,canvas.height);
    $('dropZone').hidden = false; $('editorWrap').hidden = true; $('downloadOutput').hidden = true; $('evidenceCard').hidden = true;
    $('sourceMeta').textContent = 'Select an image or video to begin.';
    updateRegionUI();
  }
  function fitCanvas(width, height) {
    const maxW = Math.min(1200, window.innerWidth > 700 ? window.innerWidth - 460 : window.innerWidth - 36);
    const maxH = Math.max(320, Math.min(720, window.innerHeight - 250));
    const scale = Math.min(1, maxW / width, maxH / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
  }
  function drawRegionEffect(targetCtx, source, r, sx=1, sy=1) {
    const x = Math.round(r.x * sx), y = Math.round(r.y * sy), w = Math.round(r.w * sx), h = Math.round(r.h * sy);
    if (w < 1 || h < 1) return;
    if (state.effect === 'black') {
      targetCtx.save(); targetCtx.fillStyle = '#000'; targetCtx.fillRect(x,y,w,h); targetCtx.restore();
    } else if (state.effect === 'blur') {
      targetCtx.save(); targetCtx.filter = `blur(${Math.max(8, Math.round(Math.min(w,h)/8))}px)`;
      targetCtx.drawImage(source, x, y, w, h, x, y, w, h); targetCtx.restore();
    } else {
      const tw = Math.max(2, Math.round(w/12)), th = Math.max(2, Math.round(h/12));
      const t = document.createElement('canvas'); t.width = tw; t.height = th;
      const tc = t.getContext('2d'); tc.imageSmoothingEnabled = false; tc.drawImage(source, x,y,w,h,0,0,tw,th);
      targetCtx.save(); targetCtx.imageSmoothingEnabled = false; targetCtx.drawImage(t,0,0,tw,th,x,y,w,h); targetCtx.restore();
    }
  }
  function sourceFrame(source, width, height) {
    const frame = document.createElement('canvas');
    frame.width = width; frame.height = height;
    const frameCtx = frame.getContext('2d');
    frameCtx.drawImage(source, 0, 0, width, height);
    return frame;
  }
  function renderImage() {
    if (!state.image) return;
    const frame = sourceFrame(state.image, canvas.width, canvas.height);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(frame,0,0);
    state.regions.forEach(r => drawRegionEffect(ctx, frame, r));
    if (state.drawing) {
      ctx.save(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(state.drawing.x,state.drawing.y,state.drawing.w,state.drawing.h); ctx.restore();
    }
  }
  function renderVideoFrame() {
    if (!state.sourceFile || state.mode !== 'video' || video.readyState < 2) return;
    const frame = sourceFrame(video, canvas.width, canvas.height);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(frame,0,0);
    state.regions.forEach(r => drawRegionEffect(ctx, frame, r));
    if (state.drawing) {
      ctx.save(); ctx.strokeStyle='#2563eb'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(state.drawing.x,state.drawing.y,state.drawing.w,state.drawing.h); ctx.restore();
    }
  }
  function render() {
    state.mode === 'image' ? renderImage() : renderVideoFrame();
  }
  function classifyFile(file) {
    const type = String(file?.type || '').toLowerCase();
    const name = String(file?.name || '').toLowerCase();
    if (type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(name)) return 'image';
    if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(name)) return 'video';
    return null;
  }
  async function decodeImage(file, objectUrl) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      img.src = objectUrl;
    });
  }
  async function loadFile(file) {
    const detectedMode = classifyFile(file);
    if (!detectedMode) {
      showToast('Select a supported JPG, PNG, WebP, MP4, WebM, MOV, or M4V file.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      showToast('Media files are limited to 500 MB in this browser workspace.', 'error');
      input.value = '';
      return;
    }
    resetSource();
    state.mode = detectedMode;
    state.sourceFile = file;
    state.sourceUrl = URL.createObjectURL(file);
    $('dropZone').hidden = true;
    $('editorWrap').hidden = false;
    setModeVisualOnly();

    if (state.mode === 'image') {
      try {
        const img = await decodeImage(file, state.sourceUrl);
        state.image = img;
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) throw new Error('IMAGE_DIMENSIONS_INVALID');
        fitCanvas(width, height);
        render();
        $('sourceMeta').textContent = `${file.name} | ${width} x ${height} | ${formatSize(file.size)}`;
        say('Image ready. Face privacy detection is running when supported.');
        if ($('autoFaceImage')?.checked) {
          if (!state.faceModelReady) {
            $('faceSupport').textContent='Image ready. Waiting for the local face privacy model...';
            for (let wait=0; wait<40 && !state.faceModelReady; wait++) await new Promise(resolve=>setTimeout(resolve,100));
          }
          if (state.faceModelReady) {
            const count = await runFaceDetection({ automatic: true });
            showToast(count ? `${count} face${count===1?'':'s'} automatically masked with ${state.effect}. Review and export.` : 'Automatic face scan completed. Review the image and draw boxes over any remaining sensitive areas.', count ? 'success' : 'info');
          } else {
            showToast('The automatic face model is unavailable. Draw boxes over sensitive areas before export.', 'warning');
          }
        } else {
          showToast('Image ready. Automatic face privacy is off. Draw boxes over sensitive areas before export.', 'info');
        }
        $('nextQueued').hidden = !state.pendingFiles.length;
      } catch (err) {
        console.warn('Image decode failed:', file.type || 'unknown-type', file.name, err?.message || err);
        showToast('This image could not be decoded by the browser. Use JPG, PNG, or WebP and verify the file is not renamed from another format.', 'error');
        resetSource();
      } finally {
        input.value = '';
      }
      return;
    }

    let settled = false;
    const failVideo = (message) => {
      if (settled) return;
      settled = true;
      const mediaError = video.error;
      console.warn('Video decode failed:', file.type || 'unknown-type', file.name, mediaError?.code || '', mediaError?.message || '');
      showToast(message, 'error');
      resetSource();
      input.value = '';
    };
    const readyVideo = () => {
      if (settled) return;
      if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
        failVideo('The selected video does not contain a readable video track.');
        return;
      }
      settled = true;
      fitCanvas(video.videoWidth, video.videoHeight);
      renderVideoFrame();
      $('videoControls').hidden = false;
      $('sourceMeta').textContent = `${file.name} | ${video.videoWidth} x ${video.videoHeight} | ${fmtTime(video.duration)} | ${formatSize(file.size)}`;
      $('timeLabel').textContent = `00:00 / ${fmtTime(video.duration)}`;
      say('Video ready. Draw a static region or detect faces in the current frame.');
      input.value = '';
    };
    video.onloadedmetadata = readyVideo;
    video.oncanplay = readyVideo;
    video.onerror = () => failVideo('This video codec is not supported by the current browser. WebM is the most compatible export and input format for this browser workspace.');
    video.src = state.sourceUrl;
    try { video.load(); } catch {}
    setTimeout(() => {
      if (!settled && video.readyState < 1) failVideo('The browser could not read this video. Try WebM or an H.264 MP4 supported by your browser.');
    }, 12000);
  }

  function setModeVisualOnly() {
    const mode=state.mode;
    $('imageMode').classList.toggle('on', mode === 'image'); $('videoMode').classList.toggle('on', mode === 'video');
    $('imageMode').setAttribute('aria-selected', String(mode === 'image')); $('videoMode').setAttribute('aria-selected', String(mode === 'video'));
    $('videoOptions').hidden = mode !== 'video';
    $('exportMedia').textContent = mode === 'image' ? 'Export redacted image' : 'Export redacted video';
    updateRegionUI();
  }

  function pointFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!state.sourceFile) return;
    canvas.setPointerCapture(e.pointerId); const p=pointFromEvent(e);
    state.drawing={x:p.x,y:p.y,w:0,h:0,kind:'manual'}; render();
  });
  canvas.addEventListener('pointermove', e => {
    if (!state.drawing) return; const p=pointFromEvent(e);
    state.drawing.w=p.x-state.drawing.x; state.drawing.h=p.y-state.drawing.y; render();
  });
  canvas.addEventListener('pointerup', e => {
    if (!state.drawing) return;
    let r=state.drawing; state.drawing=null;
    if (r.w<0){r.x+=r.w;r.w=Math.abs(r.w)} if(r.h<0){r.y+=r.h;r.h=Math.abs(r.h)}
    if(r.w>=8&&r.h>=8) state.regions.push(r);
    render(); updateRegionUI();
  });

  async function setupFaceDetector() {
    $('detectFaces').disabled = true;
    $('faceSupport').textContent='Loading local face privacy model...';
    $('faceSupport').className='capability-state';
    try {
      if (window.faceapi?.nets?.tinyFaceDetector) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models/face');
        state.faceDetector = window.faceapi;
        state.faceDetectorKind = 'local-model';
        state.faceModelReady = true;
        $('faceSupport').textContent='Local automatic face privacy is ready. Images are scanned with full-frame and overlapping edge coverage passes before detected faces are masked.';
        $('faceSupport').className='capability-state available';
        $('detectFaces').disabled=false;
      } else if ('FaceDetector' in window) {
        state.faceDetector = new FaceDetector({ fastMode:false, maxDetectedFaces:100 });
        state.faceDetectorKind = 'native';
        state.faceModelReady = true;
        $('faceSupport').textContent='Automatic face privacy is ready. Images are scanned immediately after upload.';
        $('faceSupport').className='capability-state available';
        $('detectFaces').disabled=false;
      } else {
        throw new Error('NO_FACE_DETECTOR');
      }
      if (state.mode === 'image' && state.sourceFile && state.image && $('autoFaceImage')?.checked) {
        await runFaceDetection({ automatic: true });
      }
    } catch (err) {
      console.warn('Face model initialization failed:', err?.message || err);
      state.faceDetector=null; state.faceDetectorKind=null; state.faceModelReady=false;
      $('faceSupport').textContent='Automatic face privacy could not be initialized. Manual region redaction remains available.';
      $('faceSupport').className='capability-state attention'; $('detectFaces').disabled=true;
    }
  }
  function detectionSource() {
    if (state.mode === 'image') {
      const width = state.image.naturalWidth || state.image.width;
      const height = state.image.naturalHeight || state.image.height;
      return sourceFrame(state.image, width, height);
    }
    return sourceFrame(video, video.videoWidth, video.videoHeight);
  }
  function boxIoU(a,b){
    const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),x2=Math.min(a.x+a.width,b.x+b.width),y2=Math.min(a.y+a.height,b.y+b.height);
    const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);
    const union=a.width*a.height+b.width*b.height-inter;
    return union>0?inter/union:0;
  }
  function dedupeFaceBoxes(boxes){
    const ordered=[...boxes].filter(b=>b&&b.width>4&&b.height>4).sort((a,b)=>(b.score||0)-(a.score||0)||b.width*b.height-a.width*a.height);
    const kept=[];
    for(const box of ordered){
      if(!kept.some(existing=>boxIoU(box,existing)>0.45))kept.push(box);
    }
    return kept;
  }
  async function localDetectOnCanvas(source, offsetX=0, offsetY=0, inputSize=416, threshold=0.28){
    const options=new window.faceapi.TinyFaceDetectorOptions({inputSize,scoreThreshold:threshold});
    const detections=await window.faceapi.detectAllFaces(source,options);
    return detections.map(item=>{
      const box=item.box||item.detection?.box;
      return box?{x:box.x+offsetX,y:box.y+offsetY,width:box.width,height:box.height,score:item.score||item.detection?.score||0}:null;
    }).filter(Boolean);
  }
  async function aggressiveLocalFaceScan(source){
    const sourceW=source.width,sourceH=source.height;
    const boxes=[];
    // Pass 1+2: whole-frame at two input sizes and low thresholds so small
    // and low-contrast faces are still caught.
    boxes.push(...await localDetectOnCanvas(source,0,0,416,0.20));
    boxes.push(...await localDetectOnCanvas(source,0,0,512,0.22));
    if(Math.max(sourceW,sourceH)>=800)boxes.push(...await localDetectOnCanvas(source,0,0,608,0.24));
    // Pass 3: dense overlapping tile grid. More columns/rows and larger
    // overlap than before so a face that straddles a tile seam is seen whole
    // in at least one tile. This is the "every nook and corner" coverage.
    const large=Math.max(sourceW,sourceH)>=760;
    if(large){
      const cols=sourceW>=1500?4:sourceW>=1000?3:2;
      const rows=sourceH>=1500?4:sourceH>=1000?3:2;
      const overlap=0.34;
      const tileW=Math.ceil(sourceW/(cols-(cols-1)*overlap));
      const tileH=Math.ceil(sourceH/(rows-(rows-1)*overlap));
      const stepX=Math.max(1,Math.floor(tileW*(1-overlap))),stepY=Math.max(1,Math.floor(tileH*(1-overlap)));
      for(let y=0;y<sourceH;y+=stepY){
        for(let x=0;x<sourceW;x+=stepX){
          const w=Math.min(tileW,sourceW-x),h=Math.min(tileH,sourceH-y);
          if(w<140||h<140)continue;
          const tile=document.createElement('canvas');tile.width=w;tile.height=h;
          tile.getContext('2d').drawImage(source,x,y,w,h,0,0,w,h);
          boxes.push(...await localDetectOnCanvas(tile,x,y,416,0.20));
          if(x+w>=sourceW)break;
        }
        if(y+tileH>=sourceH)break;
      }
      // Pass 4: dedicated edge and corner bands. Faces at the extreme edges
      // of a frame are the most commonly missed, so each side and each corner
      // gets its own high-resolution scan.
      const bandT=Math.round(Math.min(sourceH,Math.max(220,sourceH*0.28)));
      const bandS=Math.round(Math.min(sourceW,Math.max(220,sourceW*0.28)));
      const bands=[
        {x:0,y:0,w:sourceW,h:bandT},                         // top
        {x:0,y:sourceH-bandT,w:sourceW,h:bandT},             // bottom
        {x:0,y:0,w:bandS,h:sourceH},                         // left
        {x:sourceW-bandS,y:0,w:bandS,h:sourceH},             // right
      ];
      for(const b of bands){
        if(b.w<140||b.h<140)continue;
        const tile=document.createElement('canvas');tile.width=b.w;tile.height=b.h;
        tile.getContext('2d').drawImage(source,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
        boxes.push(...await localDetectOnCanvas(tile,b.x,b.y,416,0.19));
      }
    }
    return dedupeFaceBoxes(boxes);
  }
  async function detectFaces() {
    if (!state.faceDetector || !state.faceModelReady) return [];
    const source = detectionSource();
    const sourceW = source.width, sourceH = source.height;
    let rawBoxes = [];
    if (state.faceDetectorKind === 'local-model') {
      rawBoxes = await aggressiveLocalFaceScan(source);
    } else {
      const faces = await state.faceDetector.detect(source);
      rawBoxes = faces.map(item => ({...item.boundingBox,score:1})).filter(Boolean);
    }
    const sx=canvas.width/sourceW, sy=canvas.height/sourceH;
    const padding = Math.max(0.12, Math.min(0.6, Number($('facePadding')?.value || 28) / 100));
    return rawBoxes.map(box => {
      const baseX=box.x*sx, baseY=box.y*sy, baseW=box.width*sx, baseH=box.height*sy;
      const px=baseW*padding, py=baseH*padding;
      const x=Math.max(0,baseX-px), y=Math.max(0,baseY-py);
      return { x, y, w:Math.min(canvas.width-x,baseW+px*2), h:Math.min(canvas.height-y,baseH+py*2), kind:'face', confidence:box.score||null };
    });
  }
  async function runFaceDetection({ automatic = false } = {}) {
    if (!state.sourceFile || !state.faceDetector || !state.faceModelReady || state.faceDetectionBusy) return 0;
    state.faceDetectionBusy = true;
    $('detectFaces').disabled = true;
    $('detectFaces').textContent = automatic ? 'Scanning faces automatically...' : 'Scanning faces...';
    if (automatic) $('faceSupport').textContent = 'Scanning full image and edge regions locally for faces...';
    try {
      const boxes = await detectFaces();
      state.regions = state.regions.filter(region => region.kind !== 'face');
      if (boxes.length) state.regions.push(...boxes);
      state.lastFaceBoxes = boxes.map(box => ({...box}));
      render(); updateRegionUI();
      $('faceSupport').textContent = boxes.length
        ? `${boxes.length} face${boxes.length===1?'':'s'} detected and masked automatically. Review the coverage before export.`
        : 'Automatic scan completed. No faces were detected. Draw a manual region over anything that still needs masking.';
      $('faceSupport').className = boxes.length ? 'capability-state available' : 'capability-state attention';
      if (!automatic) {
        showToast(boxes.length ? `${boxes.length} face${boxes.length === 1 ? '' : 's'} found and masked. Review before export.` : 'No faces were found. Draw a box over anything else that is sensitive.', boxes.length ? 'success' : 'info');
      }
      return boxes.length;
    } catch (err) {
      console.warn('Face detection failed:', err?.message || err);
      $('faceSupport').textContent='Automatic scan could not process this media. Manual region redaction remains available.';
      $('faceSupport').className='capability-state attention';
      if (!automatic) showToast('Face detection could not process this media. Draw sensitive areas manually.', 'warning');
      return 0;
    } finally {
      state.faceDetectionBusy = false;
      $('detectFaces').disabled = !state.faceDetector || !state.faceModelReady;
      $('detectFaces').textContent = 'Scan faces again';
    }
  }

  $('detectFaces').onclick = () => runFaceDetection({ automatic: false });

  $('undoRegion').onclick=()=>{state.regions.pop();render();updateRegionUI()};
  $('clearRegions').onclick=()=>{state.regions=[];render();updateRegionUI()};
  document.querySelectorAll('[data-effect]').forEach(b=>b.onclick=async()=>{document.querySelectorAll('[data-effect]').forEach(x=>x.classList.toggle('on',x===b));state.effect=b.dataset.effect;render();if(state.mode==='image'&&state.sourceFile&&$('autoFaceImage')?.checked&&state.faceDetector)await runFaceDetection({automatic:true})});
  $('imageMode').onclick=()=>setMode('image'); $('videoMode').onclick=()=>setMode('video');
  $('selectMedia').onclick=()=>{ input.value=''; input.click(); };
  input.onchange=()=>{ const files=Array.from(input.files||[]); if(!files.length)return; state.pendingFiles=files.slice(1); loadFile(files[0]); };
  const dz=$('dropZone');
  ['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));
  ['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));
  dz.addEventListener('drop',e=>{const files=Array.from(e.dataTransfer.files||[]);if(!files.length)return;state.pendingFiles=files.slice(1);loadFile(files[0])});

  video.addEventListener('timeupdate',()=>{$('timeline').value=video.duration?Math.round(video.currentTime/video.duration*1000):0;$('timeLabel').textContent=`${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;renderVideoFrame()});
  video.addEventListener('play',()=>{ $('playPause').textContent='Pause'; const loop=()=>{if(!video.paused&&!video.ended){renderVideoFrame();requestAnimationFrame(loop)}};loop()});
  video.addEventListener('pause',()=>{$('playPause').textContent='Play';renderVideoFrame()});
  $('playPause').onclick=()=>video.paused?video.play():video.pause();
  $('timeline').oninput=()=>{if(video.duration)video.currentTime=(Number($('timeline').value)/1000)*video.duration};
  $('autoFaceVideo').onchange=updateRegionUI;

  async function trackUsage(operation, sourceName, outputName, pageCount, size) {
    const usage=await paFetch(APP_CONFIG.FLOWS.USAGE_TRACK,{operation,sourceName,outputName,pageCount,fileSizeMB:+(size/1048576).toFixed(3),sourceCount:1},35000);
    if(usage?.creditsUsed!=null)Session.patch({creditsUsed:usage.creditsUsed,creditsLimit:usage.creditsLimit});
    if(usage?.costAnalysis){
      if($('mediaPlatformCost'))$('mediaPlatformCost').textContent='$'+Number(usage.costAnalysis.platformCost||0).toFixed(4);
      if($('mediaProductCost'))$('mediaProductCost').textContent='$'+Number(usage.costAnalysis.productPrice||0).toFixed(4);
    }
    return usage;
  }
  async function showEvidence(operation, outputName, blob, regionCount) {
    const hash=await sha256(blob);
    $('evOperation').textContent=operation.replaceAll('_',' ');
    $('evSource').textContent=state.sourceFile.name;
    $('evOutput').textContent=outputName;
    $('evRegions').textContent=String(regionCount);
    $('evSize').textContent=formatSize(blob.size);
    $('evHash').textContent=`${hash.slice(0,16)}...${hash.slice(-16)}`;
    $('evidenceCard').hidden=false;
    return hash;
  }
  async function exportImage() {
    const out=document.createElement('canvas');
    out.width=state.image.naturalWidth || state.image.width;
    out.height=state.image.naturalHeight || state.image.height;
    const oc=out.getContext('2d',{willReadFrequently:true}); oc.drawImage(state.image,0,0);
    const originalFrame=sourceFrame(state.image,out.width,out.height);
    const sx=out.width/canvas.width, sy=out.height/canvas.height;
    state.regions.forEach(r=>drawRegionEffect(oc,originalFrame,r,sx,sy));
    const mime=state.sourceFile.type==='image/png'?'image/png':'image/jpeg';
    const blob=await canvasToBlob(out,mime,mime==='image/jpeg'?0.94:undefined);
    if(!blob || !blob.size)throw new Error('Image export failed.');
    const ext=mime==='image/png'?'png':'jpg'; const outputName=`${safeName(state.sourceFile.name)}-redacted.${ext}`;
    revoke(state.outputUrl); state.outputUrl=URL.createObjectURL(blob);
    const dl=$('downloadOutput'); dl.href=state.outputUrl; dl.download=outputName; dl.hidden=false;
    const operation=state.regions.some(r=>r.kind==='face')?'FACE_REDACTION':'IMAGE_REDACTION';
    const hash=await showEvidence(operation,outputName,blob,state.regions.length);
    await trackUsage(operation,state.sourceFile.name,outputName,0,blob.size);
    addBatchOutput(outputName,blob,operation,hash);
    return outputName;
  }
  async function exportVideo() {
    if (!window.MediaRecorder || !canvas.captureStream) throw new Error('Video export is not supported by this browser.');
    state.exportAbort=false; video.pause(); video.currentTime=0;
    await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
    const exportCanvas=document.createElement('canvas');
    exportCanvas.width=video.videoWidth; exportCanvas.height=video.videoHeight;
    const exportCtx=exportCanvas.getContext('2d',{willReadFrequently:true});
    const outputStream=exportCanvas.captureStream(30);
    let sourceStream=null;
    if(typeof video.captureStream==='function'){
      try{sourceStream=video.captureStream(); sourceStream.getAudioTracks().forEach(t=>outputStream.addTrack(t));}catch{}
    }
    const preferred=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mime=preferred.find(x=>MediaRecorder.isTypeSupported(x))||'';
    const rec=new MediaRecorder(outputStream,mime?{mimeType:mime}:{});
    const chunks=[]; rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const done=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=()=>reject(new Error('Video encoder failed.'))});
    let frameNo=0; let dynamicFaces=[]; let renderActive=true;
    const renderFrame=async()=>{
      if(!renderActive || state.exportAbort || video.ended)return;
      if(video.readyState>=2){
        exportCtx.clearRect(0,0,exportCanvas.width,exportCanvas.height);
        exportCtx.drawImage(video,0,0,exportCanvas.width,exportCanvas.height);
        const originalFrame=sourceFrame(video,exportCanvas.width,exportCanvas.height);
        if($('autoFaceVideo').checked&&state.faceDetector&&frameNo%3===0&&!state.videoFrameBusy){
          state.videoFrameBusy=true;try{dynamicFaces=await detectFaces(video)}catch{}finally{state.videoFrameBusy=false}
        }
        const sx=exportCanvas.width/canvas.width, sy=exportCanvas.height/canvas.height;
        [...state.regions,...dynamicFaces].forEach(r=>drawRegionEffect(exportCtx,originalFrame,r,sx,sy));
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(exportCanvas,0,0,canvas.width,canvas.height);
        frameNo++;
        $('exportState').textContent=`Exporting video at ${fmtTime(video.currentTime)} of ${fmtTime(video.duration)}. Keep this tab open.`;
      }
      if(renderActive&&!video.ended&&!state.exportAbort)requestAnimationFrame(()=>renderFrame().catch(()=>{}));
    };
    const playbackDone=new Promise((resolve,reject)=>{
      const maxWait=Math.max(30000,Math.ceil((video.duration||0)*1000)+30000);
      const timer=setTimeout(()=>{cleanup();reject(new Error('Video export timed out. Try a shorter WebM or MP4 file.'));},maxWait);
      const onEnded=()=>{cleanup();resolve();};
      const onError=()=>{cleanup();reject(new Error('Video playback failed during export.'));};
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener('ended',onEnded);video.removeEventListener('error',onError);};
      video.addEventListener('ended',onEnded,{once:true});
      video.addEventListener('error',onError,{once:true});
    });
    rec.start(1000);
    $('exportState').textContent='Exporting redacted video. Keep this tab open until processing completes.';
    renderFrame().catch(()=>{});
    await video.play();
    await playbackDone;
    renderActive=false;
    video.pause();
    if(rec.state!=='inactive')rec.stop();
    await done;
    const blob=new Blob(chunks,{type:rec.mimeType||'video/webm'}); if(!blob.size)throw new Error('Video export produced no output.');
    const outputName=`${safeName(state.sourceFile.name)}-redacted.webm`;
    revoke(state.outputUrl); state.outputUrl=URL.createObjectURL(blob);
    const dl=$('downloadOutput'); dl.href=state.outputUrl;dl.download=outputName;dl.hidden=false;
    const op=$('autoFaceVideo').checked?'VIDEO_FACE_REDACTION':'VIDEO_REDACTION';
    const hash=await showEvidence(op,outputName,blob,state.regions.length);
    await trackUsage(op,state.sourceFile.name,outputName,0,blob.size);
    addBatchOutput(outputName,blob,op,hash);
    return outputName;
  }
  $('exportMedia').onclick=async()=>{
    if(!state.sourceFile || (!state.regions.length && !(state.mode==='video' && $('autoFaceVideo').checked && state.faceDetector)))return;
    const b=$('exportMedia'); b.disabled=true; b.textContent='Processing...'; $('downloadOutput').hidden=true;
    try{
      const name=state.mode==='image'?await exportImage():await exportVideo();
      showToast(`${name} created. Source media remains unchanged.`, 'success'); say('Redacted output created and usage recorded.');
      $('exportState').textContent='Redacted output created. Review operation evidence and download the controlled output.';
    }catch(err){showToast(err.message||'Media redaction failed.','error');$('exportState').textContent=err.message||'Media redaction failed.'}
    finally{b.disabled=false;b.textContent=state.mode==='image'?'Export redacted image':'Export redacted video'}
  };


  $('facePadding').oninput=()=>{$('facePaddingValue').textContent=`${$('facePadding').value}%`};
  $('autoFaceImage').onchange=()=>{if($('autoFaceImage').checked&&state.mode==='image'&&state.sourceFile&&state.faceDetector)runFaceDetection({automatic:true})};
  $('nextQueued').onclick=()=>{const next=state.pendingFiles.shift();if(next)loadFile(next);$('nextQueued').hidden=!state.pendingFiles.length};
  $('downloadBatch').onclick=async()=>{
    if(!state.batch.length)return;
    const b=$('downloadBatch');b.disabled=true;b.textContent='Building secure ZIP...';
    try{
      const manifest={
        product:'Prudent Redact',
        packageType:'CONTROLLED_MEDIA_OUTPUT_BATCH',
        createdAt:new Date().toISOString(),
        outputCount:state.batch.length,
        outputs:state.batch.map(item=>({name:item.name,operation:item.operation,sizeBytes:item.blob.size,sha256:item.hash,createdAt:item.createdAt}))
      };
      const manifestBlob=new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'});
      const zip=await createZip([...state.batch,{name:'prudent-redact-evidence-manifest.json',blob:manifestBlob}]);
      const url=URL.createObjectURL(zip);
      const a=document.createElement('a');a.href=url;a.download=`prudent-redact-media-batch-${new Date().toISOString().slice(0,10)}.zip`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      showToast(`${state.batch.length} output${state.batch.length===1?'':'s'} packaged into a ZIP.`, 'success');
    }catch(err){showToast(err.message||'Batch ZIP could not be created.','error')}
    finally{b.disabled=false;renderBatch()}
  };
  $('clearBatch').onclick=()=>{state.batch.forEach(item=>revoke(item.url));state.batch=[];renderBatch();showToast('Browser output batch cleared.','info')};

  const help=$('mediaHelp');
  function openHelp(key){
    const h=HELP[key];if(!h)return;$('mediaHelpTitle').textContent=h[0];$('mediaHelpBody').textContent=h[1];help.showModal();
  }
  $('processingInfo').onclick=()=>openHelp('processing');
  document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>openHelp(b.dataset.help));
  $('mediaHelpClose').onclick=()=>help.close(); help.addEventListener('click',e=>{if(e.target===help)help.close()});

  const params=new URLSearchParams(location.search);
  setMode(params.get('mode')==='video'?'video':'image');
  setupFaceDetector();
  renderBatch();
  if(params.get('assist')==='faces') setTimeout(()=>showToast('Face assistance will be available after supported media is loaded. Review all suggested regions.', 'info'),300);
  window.addEventListener('pagehide',()=>{state.exportAbort=true;revoke(state.sourceUrl);revoke(state.outputUrl);state.batch.forEach(item=>revoke(item.url))});
})();