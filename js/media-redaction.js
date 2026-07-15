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
    lastFaceBoxes: [],
    videoFrameBusy: false,
    exportAbort: false
  };

  const HELP = {
    processing: ['Local media processing', 'The editor works with media bytes in this browser workspace. A successful export sends only minimal operation metadata to the usage API. The PDF and redaction Power Automate contract is not changed.'],
    effect: ['Redaction effect', 'Black permanently covers the selected pixels. Blur and pixelation transform the selected visual region. For the strongest visual removal, use Black.'],
    faces: ['Face detection assistance', 'Where the browser exposes the Face Detection API, Prudent Redact can suggest face boxes for the current image or video frame. Review every suggested region before export.'],
    regions: ['Redaction regions', 'Draw rectangles directly over sensitive content. Manual regions are reviewer-controlled. In video mode, manual regions remain fixed for the full video export.'],
    videoScope: ['Video redaction scope', 'Manual regions are applied to every exported frame. Optional face assistance samples frames during export and updates face masks when supported by the browser.'],
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
  function updateRegionUI() {
    $('regionSummary').textContent = `${state.regions.length} redaction region${state.regions.length === 1 ? '' : 's'}`;
    const assistedVideo = state.mode === 'video' && $('autoFaceVideo')?.checked && !!state.faceDetector;
    $('exportMedia').disabled = !state.sourceFile || (!state.regions.length && !assistedVideo);
    $('exportState').textContent = !state.sourceFile ? 'Select source media to begin.' : (!state.regions.length && !assistedVideo) ? 'Draw at least one region or enable supported face assistance.' : `Ready to create a new redacted ${state.mode === 'video' ? 'video' : 'image'} using ${state.regions.length} region${state.regions.length === 1 ? '' : 's'}.`;
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
  function renderImage() {
    if (!state.image) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(state.image,0,0,canvas.width,canvas.height);
    state.regions.forEach(r => drawRegionEffect(ctx, canvas, r));
    if (state.drawing) {
      ctx.save(); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(state.drawing.x,state.drawing.y,state.drawing.w,state.drawing.h); ctx.restore();
    }
  }
  function renderVideoFrame() {
    if (!state.sourceFile || state.mode !== 'video' || video.readyState < 2) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    state.regions.forEach(r => drawRegionEffect(ctx, canvas, r));
    if (state.drawing) {
      ctx.save(); ctx.strokeStyle='#3b82f6'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.strokeRect(state.drawing.x,state.drawing.y,state.drawing.w,state.drawing.h); ctx.restore();
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
        say('Image ready for redaction. Draw a region over sensitive content.');
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
    if (!('FaceDetector' in window)) {
      $('faceSupport').textContent='Automatic face assistance is not available in this browser. Manual region redaction remains available.';
      $('faceSupport').className='capability-state attention'; $('detectFaces').disabled=true; return;
    }
    try {
      state.faceDetector = new FaceDetector({ fastMode:true, maxDetectedFaces:100 });
      $('faceSupport').textContent='Face assistance is available. Review suggested regions before export.';
      $('faceSupport').className='capability-state available';
    } catch {
      $('faceSupport').textContent='Face assistance could not be initialized. Manual region redaction remains available.';
      $('faceSupport').className='capability-state attention'; $('detectFaces').disabled=true;
    }
  }
  async function detectFaces(source) {
    if (!state.faceDetector) return [];
    const faces = await state.faceDetector.detect(source);
    const sourceW = state.mode==='image' ? state.image.naturalWidth : video.videoWidth;
    const sourceH = state.mode==='image' ? state.image.naturalHeight : video.videoHeight;
    const sx=canvas.width/sourceW, sy=canvas.height/sourceH;
    return faces.map(f => ({
      x:Math.max(0,f.boundingBox.x*sx-8), y:Math.max(0,f.boundingBox.y*sy-8),
      w:Math.min(canvas.width,f.boundingBox.width*sx+16), h:Math.min(canvas.height,f.boundingBox.height*sy+16),
      kind:'face'
    }));
  }
  $('detectFaces').onclick = async () => {
    if (!state.sourceFile || !state.faceDetector) return;
    $('detectFaces').disabled=true; $('detectFaces').textContent='Detecting...';
    try {
      const source = state.mode==='image' ? state.image : video;
      const boxes=await detectFaces(source);
      if (!boxes.length) showToast('No faces were suggested in the current image or frame. Review manually.', 'info');
      else { state.regions.push(...boxes); showToast(`${boxes.length} face region${boxes.length===1?'':'s'} suggested. Review the canvas before export.`, 'success'); }
      render(); updateRegionUI();
    } catch { showToast('Face assistance could not process this frame. Add regions manually.', 'warning'); }
    finally { $('detectFaces').disabled=false; $('detectFaces').textContent='Detect faces in current frame'; }
  };

  $('undoRegion').onclick=()=>{state.regions.pop();render();updateRegionUI()};
  $('clearRegions').onclick=()=>{state.regions=[];render();updateRegionUI()};
  document.querySelectorAll('[data-effect]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-effect]').forEach(x=>x.classList.toggle('on',x===b));state.effect=b.dataset.effect;render()});
  $('imageMode').onclick=()=>setMode('image'); $('videoMode').onclick=()=>setMode('video');
  $('selectMedia').onclick=()=>{ input.value=''; input.click(); };
  input.onchange=()=>{ const file=input.files?.[0]; if(file) loadFile(file); };
  const dz=$('dropZone');
  ['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));
  ['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));
  dz.addEventListener('drop',e=>e.dataTransfer.files[0]&&loadFile(e.dataTransfer.files[0]));

  video.addEventListener('timeupdate',()=>{$('timeline').value=video.duration?Math.round(video.currentTime/video.duration*1000):0;$('timeLabel').textContent=`${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;renderVideoFrame()});
  video.addEventListener('play',()=>{ $('playPause').textContent='Pause'; const loop=()=>{if(!video.paused&&!video.ended){renderVideoFrame();requestAnimationFrame(loop)}};loop()});
  video.addEventListener('pause',()=>{$('playPause').textContent='Play';renderVideoFrame()});
  $('playPause').onclick=()=>video.paused?video.play():video.pause();
  $('timeline').oninput=()=>{if(video.duration)video.currentTime=(Number($('timeline').value)/1000)*video.duration};
  $('autoFaceVideo').onchange=updateRegionUI;

  async function trackUsage(operation, sourceName, outputName, pageCount, size) {
    const usage=await paFetch(APP_CONFIG.FLOWS.USAGE_TRACK,{operation,sourceName,outputName,pageCount,fileSizeMB:+(size/1048576).toFixed(3)},35000);
    if(usage?.creditsUsed!=null)Session.patch({creditsUsed:usage.creditsUsed,creditsLimit:usage.creditsLimit});
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
    const sx=out.width/canvas.width, sy=out.height/canvas.height;
    state.regions.forEach(r=>drawRegionEffect(oc,out,r,sx,sy));
    const mime=state.sourceFile.type==='image/png'?'image/png':'image/jpeg';
    const blob=await canvasToBlob(out,mime,mime==='image/jpeg'?0.94:undefined);
    if(!blob || !blob.size)throw new Error('Image export failed.');
    const ext=mime==='image/png'?'png':'jpg'; const outputName=`${safeName(state.sourceFile.name)}-redacted.${ext}`;
    revoke(state.outputUrl); state.outputUrl=URL.createObjectURL(blob);
    const dl=$('downloadOutput'); dl.href=state.outputUrl; dl.download=outputName; dl.hidden=false;
    await showEvidence(state.regions.some(r=>r.kind==='face')?'FACE_REDACTION':'IMAGE_REDACTION',outputName,blob,state.regions.length);
    await trackUsage(state.regions.some(r=>r.kind==='face')?'FACE_REDACTION':'IMAGE_REDACTION',state.sourceFile.name,outputName,0,blob.size);
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
        if($('autoFaceVideo').checked&&state.faceDetector&&frameNo%5===0&&!state.videoFrameBusy){
          state.videoFrameBusy=true;try{dynamicFaces=await detectFaces(video)}catch{}finally{state.videoFrameBusy=false}
        }
        const sx=exportCanvas.width/canvas.width, sy=exportCanvas.height/canvas.height;
        [...state.regions,...dynamicFaces].forEach(r=>drawRegionEffect(exportCtx,exportCanvas,r,sx,sy));
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
    await showEvidence(op,outputName,blob,state.regions.length);
    await trackUsage(op,state.sourceFile.name,outputName,0,blob.size);
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
  if(params.get('assist')==='faces') setTimeout(()=>showToast('Face assistance will be available after supported media is loaded. Review all suggested regions.', 'info'),300);
  window.addEventListener('pagehide',()=>{state.exportAbort=true;revoke(state.sourceUrl);revoke(state.outputUrl)});
})();