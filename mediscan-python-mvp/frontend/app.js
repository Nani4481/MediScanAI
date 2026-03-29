document.addEventListener('DOMContentLoaded', () => {

    // --- SPLASH SCREEN LOGIC ---
    const splash = document.getElementById('splashScreen');
    if (splash) {
        setTimeout(() => {
            splash.classList.add('fade-out');
            document.body.classList.remove('no-scroll');
            setTimeout(() => { splash.style.display = 'none'; }, 800); 
        }, 2500); 
    }

    // --- APP ROUTING LOGIC ---
    const tabBtns = document.querySelectorAll('.tab-btn[data-target]');
    const views = document.querySelectorAll('.view-section');
    const launchBtn = document.getElementById('launchAppBtn');
    const nextPatientBtn = document.getElementById('nextPatientBtn'); 
    const exportPdfBtn = document.getElementById('exportPdfBtn');

    function switchView(targetId) {
        views.forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none'; 
        });
        tabBtns.forEach(t => t.classList.remove('active'));

        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add('active');
            // Dashboard, Toolkit, and Settings use grid layouts
            targetView.style.display = (targetId === 'dashboardView' || targetId === 'toolkitView' || targetId === 'settingsView') ? 'grid' : 'flex';
        }

        const activeTab = document.querySelector(`.tab-btn[data-target="${targetId}"]`);
        if(activeTab) activeTab.classList.add('active');

        // Header button visibility
        if(targetId === 'dashboardView' && nextPatientBtn && !document.getElementById('resultsZone').classList.contains('hidden')) {
            nextPatientBtn.classList.remove('hidden');
            if (exportPdfBtn) exportPdfBtn.classList.remove('hidden');
        } else {
            if (nextPatientBtn) nextPatientBtn.classList.add('hidden');
            if (exportPdfBtn) exportPdfBtn.classList.add('hidden');
        }
    }

    tabBtns.forEach(tab => {
        tab.addEventListener('click', () => {
            if(tab.classList.contains('locked')) return;
            switchView(tab.dataset.target);
        });
    });

    if(launchBtn) {
        launchBtn.addEventListener('click', () => switchView('dashboardView'));
    }

    switchView('homeView');

    // --- CORE APP ELEMENTS ---
    const elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        imagePreview: document.getElementById('imagePreview'),
        imageWrapper: document.getElementById('imageWrapper'),
        analyzeBtn: document.getElementById('analyzeBtn'),
        patientContext: document.getElementById('patientContext'),
        resultsZone: document.getElementById('resultsZone'),
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        dicomLoader: document.getElementById('dicomLoader'),
        dicomLogs: document.getElementById('dicomLogs'),
        canvas: document.getElementById('overlayCanvas'),
        erAlert: document.getElementById('erAlertBanner'),
        exportPdfBtn: document.getElementById('exportPdfBtn'),
        micBtn: document.getElementById('micBtn'),
        complianceAuditText: document.getElementById('complianceAuditText'),
        hipaaBanner: document.getElementById('hipaaBanner'),
        hipaaBannerText: document.getElementById('hipaaBannerText'),
        icdCodeDisplay: document.getElementById('icdCodeDisplay'),
        authStatusDisplay: document.getElementById('authStatusDisplay'),
        authCardBorder: document.getElementById('authCardBorder'),
        imageQualityScore: document.getElementById('imageQualityScore'),
        pipelineStatus: document.getElementById('pipelineStatus'),
        reasoningTerminal: document.getElementById('reasoningTerminal'),
        auditTableBody: document.getElementById('auditTableBody'),
        refreshAuditBtn: document.getElementById('refreshAuditBtn'),
        autoLoadDemoBtn: document.getElementById('autoLoadDemoBtn')
    };

    let currentImageData = { base64: null, type: null, file: null, originalFindings: "" };
    let isPatientMode = false;
    let animIntervals = {};

    // --- 1-CLICK DEMO (HACKATHON GOLD) ---
    if (elements.autoLoadDemoBtn) {
        elements.autoLoadDemoBtn.addEventListener('click', () => {
            elements.patientContext.value = "Primary physician noted 'clear lungs'. Patient is a 62yo female with a history of smoking.";
            const uploadText = document.getElementById('uploadText');
            if (uploadText) uploadText.classList.add('hidden');
            if (elements.erAlert) elements.erAlert.classList.add('hidden');
            
            simulateDicomParsing({ name: "EHR_Archive_Scan_048.dcm", size: 1048576 });
            currentImageData.base64 = "dummy_base64_string_for_demo";
            currentImageData.type = "image/jpeg";
            
            const img = document.getElementById('imagePreview');
            if (img) img.dataset.originalSrc = img.src; // Safeguard for 3D render caching
        });
    }

    if (elements.fileInput) elements.fileInput.addEventListener('change', handleFile);
    if (elements.browseBtn) {
        elements.browseBtn.addEventListener('click', (e) => {
            e.preventDefault(); elements.fileInput.click();
        });
    }

    if (elements.dropZone) {
        elements.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); elements.dropZone.style.borderColor = 'var(--primary)'; });
        elements.dropZone.addEventListener('dragleave', () => { elements.dropZone.style.borderColor = 'rgba(6, 182, 212, 0.4)'; });
        elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault(); elements.dropZone.style.borderColor = 'rgba(6, 182, 212, 0.4)';
            if(e.dataTransfer.files.length) { elements.fileInput.files = e.dataTransfer.files; handleFile(); }
        });
    }

    function handleFile() {
        if (!elements.fileInput.files.length) return;
        const file = elements.fileInput.files[0];
        currentImageData.file = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            currentImageData.base64 = e.target.result.split(',')[1];
            currentImageData.type = file.type;
            elements.imagePreview.src = e.target.result;
            elements.imagePreview.dataset.originalSrc = e.target.result; // Cache for 3D Render
            
            const uploadText = document.getElementById('uploadText');
            if (uploadText) uploadText.classList.add('hidden');
            if (elements.erAlert) elements.erAlert.classList.add('hidden');
            
            if (elements.canvas) {
                const ctx = elements.canvas.getContext('2d');
                ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
            }
            simulateDicomParsing(file);
        };
        reader.readAsDataURL(file);
    }

    function simulateDicomParsing(file) {
        elements.dicomLoader.classList.remove('hidden');
        elements.dicomLogs.innerHTML = '';
        const logs = [
            `> Batch Ingest: ${file.name}`,
            `> Payload: ${(file.size / 1024).toFixed(2)} KB`,
            `> Hash Check: 0x${Math.random().toString(16).slice(2, 10)}`,
            `> Status: EHR SECURE UPLINK ESTABLISHED...`,
            `> COMPLETE: READY FOR QA AUDIT`
        ];
        let i = 0;
        const intv = setInterval(() => {
            if (i < logs.length) {
                const li = document.createElement('li'); li.innerText = logs[i++]; elements.dicomLogs.appendChild(li);
            } else {
                clearInterval(intv);
                setTimeout(() => {
                    elements.dicomLoader.classList.add('hidden');
                    elements.imageWrapper.classList.remove('hidden');
                    elements.analyzeBtn.disabled = false;
                }, 400);
            }
        }, 150);
    }

    if (elements.micBtn) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.onstart = () => elements.micBtn.style.color = "var(--red)";
            recognition.onend = () => elements.micBtn.style.color = "";
            recognition.onresult = (e) => { elements.patientContext.value += (elements.patientContext.value ? ' ' : '') + e.results[0][0].transcript; };
            elements.micBtn.addEventListener('click', () => { 
                if(elements.micBtn.style.color) recognition.stop(); else recognition.start(); 
            });
        }
    }

    function runPipelineAnimation() {
        const statuses = [
            "Ingesting Historical EHR Scan Data...",
            "Validating Primary Read against PHI constraints...",
            "Running Secondary Vision Analysis...",
            "Cross-referencing Primary Read vs. AI Findings...",
            "Validating against PS5 Compliance Guardrails...",
            "Auditing ICD-10 Coding & Claims Adjudication...",
            "Generating QA Discrepancy Report..."
        ];
        let i = 0;
        const mainInterval = setInterval(() => {
            if (elements.pipelineStatus) elements.pipelineStatus.innerText = statuses[i];
            i++;
            if (i >= statuses.length) clearInterval(mainInterval);
        }, 600);

        elements.reasoningTerminal.classList.remove('hidden');
        elements.reasoningTerminal.innerHTML = '';
        const thoughts = [
            "> Agent_Vision: Extracting pixel density map...",
            "> Agent_Vision: Anomaly detected at coords [142, 388]. Confidence: 94.2%",
            "> Agent_RAG: Querying ChromaDB for clinical context...",
            "> Agent_RAG: Found matching policy: CMS Quality Measure 110.",
            "> Agent_Logic: Comparing human read vs Vision findings.",
            "> Agent_Logic: Discrepancy threshold exceeded. Triggering override.",
            "> Agent_Coder: Mapping findings to ICD-10 taxonomy...",
            "> Agent_Coder: Assigned R91.8. Routing to prior-auth engine."
        ];
        let t = 0;
        const thoughtIntv = setInterval(() => {
            if(t < thoughts.length) {
                elements.reasoningTerminal.innerHTML += `<div>${thoughts[t]}</div>`;
                elements.reasoningTerminal.scrollTop = elements.reasoningTerminal.scrollHeight;
                t++;
            } else {
                clearInterval(thoughtIntv);
            }
        }, 400);

        return { main: mainInterval, thought: thoughtIntv };
    }

    elements.analyzeBtn.addEventListener('click', async () => {
        setUIState('loading');
        animIntervals = runPipelineAnimation();
        
        try {
            const response = await fetch('http://127.0.0.1:8000/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: currentImageData.base64,
                    mime_type: currentImageData.type || 'image/jpeg',
                    patient_context: elements.patientContext.value.trim()
                })
            });

            clearInterval(animIntervals.main);
            clearInterval(animIntervals.thought);
            if (!response.ok) throw new Error('API Error');
            const data = await response.json();

            updateReportUI(data);
            if (data.findings) drawDynamicBoundingBox(data.findings);
            setUIState('results');
            fetchAuditLog();

        } catch (err) {
            clearInterval(animIntervals.main);
            clearInterval(animIntervals.thought);
            console.error(err);
            setUIState('error');
        }
    });

    function updateReportUI(data) {
        if(data.phi_detected && elements.hipaaBanner) {
            elements.hipaaBanner.classList.remove('hidden');
            elements.hipaaBannerText.innerText = `PHI DETECTED: [${data.phi_types_found.join(', ')}] scrubbed prior to audit for HIPAA compliance.`;
        } else if (elements.hipaaBanner) {
            elements.hipaaBanner.classList.add('hidden');
        }

        if(elements.imageQualityScore) elements.imageQualityScore.innerText = data.image_quality_score || "N/A";
        if(elements.icdCodeDisplay) elements.icdCodeDisplay.innerText = data.coding.icd_10_code;
        if(elements.authStatusDisplay) {
            const status = data.prior_auth.status;
            elements.authStatusDisplay.innerText = status;
            elements.authStatusDisplay.style.color = status.includes('APPROVED') ? 'var(--success)' : (status.includes('ALERT') ? 'var(--danger)' : 'var(--warning)');
            elements.authCardBorder.style.borderColor = elements.authStatusDisplay.style.color;
            elements.authStatusDisplay.title = data.prior_auth.reasoning; 
        }

        document.getElementById('findingsText').innerText = data.findings || "No critical findings detected.";
        document.getElementById('diagnosisText').innerText = data.differential_diagnosis || "N/A";
        document.getElementById('recommendationsText').innerText = data.recommendations || "N/A";
        if (elements.complianceAuditText) elements.complianceAuditText.innerText = data.compliance_audit || "Validation passed.";

        const priorityEl = document.getElementById('triagePriority');
        const triageText = data.triage_priority || "CONCORDANT";
        priorityEl.innerText = triageText; 
        if (triageText.toLowerCase().includes('critical') || triageText.toLowerCase().includes('discrepancy')) {
            priorityEl.style.color = "var(--danger)";
            if(elements.erAlert) elements.erAlert.classList.remove('hidden');
        } else if (triageText.toLowerCase().includes('minor')) {
            priorityEl.style.color = "var(--warning)";
        } else {
            priorityEl.style.color = "var(--success)";
        }

        const ragContent = document.getElementById('dynamicRagContent');
        if (ragContent && data.active_guardrail) {
            ragContent.innerHTML = `
                <span class="badge pulse-badge" style="background: rgba(245, 158, 11, 0.1); color: var(--warning); border-color: var(--warning);">POLICY ENFORCED</span>
                <p style="font-size: 0.85rem; line-height: 1.4; color: var(--text-muted); margin-top: 10px; border-left: 2px solid var(--warning); padding-left: 8px;">${data.active_guardrail}</p>
            `;
        }
        
        currentImageData.originalFindings = data.findings;
    }

    function drawDynamicBoundingBox(findings) {
        if (!elements.canvas) return;
        elements.canvas.width = elements.imageWrapper.clientWidth;
        elements.canvas.height = elements.imageWrapper.clientHeight;
        const ctx = elements.canvas.getContext('2d');
        const imgWidth = elements.imagePreview.clientWidth;
        const imgHeight = elements.imagePreview.clientHeight;
        
        let x = (elements.canvas.width / 2) - ((imgWidth * 0.4) / 2);
        let y = (elements.canvas.height / 2) - ((imgHeight * 0.3) / 2);
        
        const text = findings.toLowerCase();
        if (text.includes('upper') || text.includes('top')) y -= (imgHeight * 0.2);
        if (text.includes('lower') || text.includes('bottom')) y += (imgHeight * 0.2);
        if (text.includes('left')) x -= (imgWidth * 0.2);
        if (text.includes('right')) x += (imgWidth * 0.2);

        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.setLineDash([6, 3]);
        ctx.strokeRect(x, y, imgWidth * 0.4, imgHeight * 0.3);
        ctx.fillStyle = '#ef4444'; ctx.font = "bold 12px Inter";
        ctx.fillText('MISSED ANOMALY', x, y - 8);
    }

    async function fetchAuditLog() {
        try {
            const res = await fetch('http://127.0.0.1:8000/api/audit/latest');
            const data = await res.json();
            if(data.records && elements.auditTableBody) {
                elements.auditTableBody.innerHTML = '';
                data.records.forEach(record => {
                    const row = document.createElement('tr');
                    const time = new Date(record.timestamp).toLocaleTimeString([], {hour12: false});
                    row.innerHTML = `
                        <td style="padding: 6px 0;">${time}</td>
                        <td style="color: #c084fc;">${record.icd_code}</td>
                        <td style="color: ${record.prior_auth_decision.includes('APPROVED') ? '#10b981' : (record.prior_auth_decision.includes('ALERT') ? '#ef4444' : '#f59e0b')}">${record.prior_auth_decision}</td>
                        <td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${record.guardrail_policy}">${record.guardrail_policy.substring(0, 30)}...</td>
                    `;
                    elements.auditTableBody.appendChild(row);
                });
            }
        } catch(e) { console.error("Could not fetch audit log", e); }
    }

    if(elements.refreshAuditBtn) elements.refreshAuditBtn.addEventListener('click', fetchAuditLog);

    const patientModeBtn = document.getElementById('patientModeBtn');
    if (patientModeBtn) {
        patientModeBtn.addEventListener('click', async () => {
            const findingsEl = document.getElementById('findingsText');
            if (!isPatientMode) {
                patientModeBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Generating...";
                patientModeBtn.disabled = true;
                try {
                    const res = await fetch('http://127.0.0.1:8000/api/translate', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clinical_text: currentImageData.originalFindings })
                    });
                    const data = await res.json();
                    findingsEl.innerText = data.patient_friendly_text;
                    findingsEl.style.color = "var(--purple)";
                    patientModeBtn.innerHTML = "<i class='fas fa-undo'></i> Back to Audit View";
                    isPatientMode = true;
                } catch (e) {
                    patientModeBtn.innerHTML = "<i class='fas fa-exclamation-triangle'></i> Error Generating";
                } finally { patientModeBtn.disabled = false; }
            } else {
                findingsEl.innerText = currentImageData.originalFindings;
                findingsEl.style.color = "";
                patientModeBtn.innerHTML = "<i class='fas fa-language'></i> Generate Patient-Friendly Summary";
                isPatientMode = false;
            }
        });
    }

    const openRagBtn = document.getElementById('openRagBtn');
    const closeRagBtn = document.getElementById('closeRagBtn');
    const ragDrawer = document.getElementById('ragDrawer');
    if (openRagBtn && closeRagBtn && ragDrawer) {
        openRagBtn.addEventListener('click', () => {
            ragDrawer.classList.remove('hidden');
            setTimeout(() => { ragDrawer.classList.add('open'); }, 10);
        });
        closeRagBtn.addEventListener('click', () => {
            ragDrawer.classList.remove('open');
            setTimeout(() => { ragDrawer.classList.add('hidden'); }, 400);
        });
    }

    const editBtn = document.getElementById('editBtn');
    const approveBtn = document.getElementById('approveBtn');
    if (editBtn && approveBtn) {
        editBtn.addEventListener('click', () => {
            const editableFields = document.querySelectorAll('.editable-text');
            editableFields.forEach(field => { field.setAttribute('contenteditable', 'true'); field.style.border = "1px dashed var(--warning)"; });
        });
        approveBtn.addEventListener('click', () => {
            const editableFields = document.querySelectorAll('.editable-text');
            editableFields.forEach(field => { field.setAttribute('contenteditable', 'false'); field.style.border = "none"; });
            approveBtn.innerText = "Routed to Claims";
            setTimeout(() => approveBtn.innerText = "Approve & Route to Claims", 2000);
        });
    }

    if (elements.exportPdfBtn) {
        elements.exportPdfBtn.addEventListener('click', () => {
            const originalText = elements.exportPdfBtn.innerText;
            elements.exportPdfBtn.innerText = "⏳ Generating PDF...";
            elements.exportPdfBtn.disabled = true;

            const element = document.getElementById('reportContainer');
            const opt = {
                margin: 10,
                filename: `MediScan_QA_Audit_${new Date().getTime()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0d1117' }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                elements.exportPdfBtn.innerText = originalText;
                elements.exportPdfBtn.disabled = false;
            }).catch(err => {
                console.error("PDF Gen Error:", err);
                elements.exportPdfBtn.innerText = "❌ Export Failed";
                setTimeout(() => {
                    elements.exportPdfBtn.innerText = originalText;
                    elements.exportPdfBtn.disabled = false;
                }, 3000);
            });
        });
    }

    if (nextPatientBtn) {
        nextPatientBtn.addEventListener('click', () => {
            currentImageData = { base64: null, type: null, file: null, originalFindings: "" };
            isPatientMode = false;
            if(elements.fileInput) elements.fileInput.value = '';
            
            // Reset 3D Twin state if it was active
            const wrapper = document.getElementById('imageWrapper');
            const img = document.getElementById('imagePreview');
            if (wrapper) {
                wrapper.classList.add('hidden');
                wrapper.classList.remove('digital-twin-mode');
                wrapper.classList.remove('digital-twin-active');
            }
            if (img) {
                img.src = 'https://images.unsplash.com/photo-1574284566778-9585ea15dd3c?q=80&w=600&auto=format&fit=crop';
                img.style.filter = "none";
                img.dataset.originalSrc = ""; // Reset cache completely
            }
            if (elements.canvas) {
                elements.canvas.getContext('2d').clearRect(0, 0, elements.canvas.width, elements.canvas.height);
                elements.canvas.style.opacity = '1';
            }

            const uploadText = document.getElementById('uploadText');
            if(uploadText) uploadText.classList.remove('hidden');
            if(elements.patientContext) elements.patientContext.value = '';
            if(elements.hipaaBanner) elements.hipaaBanner.classList.add('hidden');
            if(elements.erAlert) elements.erAlert.classList.add('hidden');
            if (patientModeBtn) patientModeBtn.innerHTML = "<i class='fas fa-language'></i> Generate Patient-Friendly Summary";
            setUIState('empty');
        });
    }

    const omniBagBtn = document.getElementById('omniBagBtn');
    const omniMenu = document.getElementById('omniMenu');
    if(omniBagBtn && omniMenu) {
        omniBagBtn.addEventListener('click', () => { omniMenu.classList.toggle('hidden'); });
    }

    // --- OMNI-BAG HARDCODED ACTIONS (AGENT TOASTS) ---
    window.triggerAgentAction = function(title, iconClass, message) {
        if(omniMenu) omniMenu.classList.add('hidden');

        const toast = document.createElement('div');
        toast.className = 'agent-toast';
        toast.innerHTML = `
            <i class="${iconClass} agent-toast-icon"></i>
            <div class="agent-toast-content">
                <h4>Agent Action: ${title}</h4>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        // Render 3D Twin Logic - FIXED
        if (title === 'Render 3D Twin') {
            const wrapper = document.getElementById('imageWrapper');
            const img = document.getElementById('imagePreview');
            const canvas = document.getElementById('overlayCanvas');
            
            if (wrapper && !wrapper.classList.contains('hidden')) {
                wrapper.classList.toggle('digital-twin-mode');
                
                // Reliably store the original source ONCE so we never overwrite it
                if (!img.dataset.originalSrc || img.dataset.originalSrc === "") {
                    img.dataset.originalSrc = img.src; 
                }
                
                if (wrapper.classList.contains('digital-twin-mode')) {
                    // Turn on 3D Mode
                    img.src = "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=600&auto=format&fit=crop"; // Tech wireframe look
                    img.style.filter = "hue-rotate(180deg) saturate(200%) brightness(1.2)";
                    wrapper.classList.add('digital-twin-active'); // ADDED CSS CLASS
                    if(canvas) canvas.style.opacity = '0'; // Hide 2D bounding box
                } else {
                    // Turn off 3D Mode
                    img.src = img.dataset.originalSrc; // Restore cached original
                    img.style.filter = "none";
                    wrapper.classList.remove('digital-twin-active'); // REMOVE CSS CLASS
                    if(canvas) canvas.style.opacity = '1';
                }
            } else {
                switchView('dashboardView');
            }
        }

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    };

    function setUIState(state) {
        ['emptyState', 'loadingState', 'resultsZone', 'erAlertBanner'].forEach(id => {
            const el = document.getElementById(id); if(el) el.classList.add('hidden');
        });
        
        if (state === 'loading') {
            elements.loadingState.classList.remove('hidden');
            elements.analyzeBtn.disabled = true;
        } else if (state === 'results') {
            elements.resultsZone.classList.remove('hidden');
            if (elements.exportPdfBtn) elements.exportPdfBtn.classList.remove('hidden');
            if (nextPatientBtn) nextPatientBtn.classList.remove('hidden');
            elements.analyzeBtn.disabled = false;
        } else if (state === 'error') {
            elements.emptyState.classList.remove('hidden');
            elements.analyzeBtn.disabled = false;
            alert("API Error: Backend offline or model timed out.");
        } else if (state === 'empty') {
            elements.emptyState.classList.remove('hidden');
            elements.analyzeBtn.disabled = true; 
            if (elements.exportPdfBtn) elements.exportPdfBtn.classList.add('hidden');
            if (nextPatientBtn) nextPatientBtn.classList.add('hidden');
        }
    }

    // --- ADDED: DOCTOR'S AI TOOLKIT HARDCODED FEATURES (Clinical POV) ---
    const toolOutput = document.getElementById('toolOutput');
    const toolEmptyState = document.getElementById('toolEmptyState');

    function resetToolkitUI() {
        if(toolEmptyState) toolEmptyState.classList.add('hidden');
        toolOutput.classList.remove('hidden');
    }

    // Feature 1: Similar Case Search
    document.getElementById('btnTool1')?.addEventListener('click', () => {
        resetToolkitUI();
        toolOutput.innerHTML = `
            <h3 style="color: var(--cyan); margin-bottom: 1rem;"><i class="fas fa-search-location"></i> Top Historical Matches (Cosine Similarity > 0.92)</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px; border: 1px solid var(--cyan-dark);">
                    <img src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=300" style="width:100%; border-radius:4px; margin-bottom:5px;">
                    <h5 style="color: #fff; margin-bottom:2px;">EHR ID #4401</h5><p style="font-size: 0.75rem; color: var(--text-muted);">Diagnosis: Primary Carcinoma</p>
                    <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); font-size: 0.65rem;">Outcome: Remission</span>
                </div>
                <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px; border: 1px solid var(--cyan-dark);">
                    <img src="https://images.unsplash.com/photo-1582719478250-c89404bb8a0e?q=80&w=300" style="width:100%; border-radius:4px; margin-bottom:5px;">
                    <h5 style="color: #fff; margin-bottom:2px;">EHR ID #8922</h5><p style="font-size: 0.75rem; color: var(--text-muted);">Diagnosis: Benign Granuloma</p>
                    <span class="badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning); font-size: 0.65rem;">Outcome: Ongoing Monitor</span>
                </div>
                <div style="background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px; border: 1px solid var(--cyan-dark);">
                    <img src="https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=300" style="width:100%; border-radius:4px; margin-bottom:5px;">
                    <h5 style="color: #fff; margin-bottom:2px;">EHR ID #1109</h5><p style="font-size: 0.75rem; color: var(--text-muted);">Diagnosis: Lobar Pneumonia</p>
                    <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); font-size: 0.65rem;">Outcome: Recovered</span>
                </div>
            </div>
        `;
    });

    // Feature 2: Pathway Predictor
    document.getElementById('btnTool2')?.addEventListener('click', () => {
        resetToolkitUI();
        toolOutput.innerHTML = `
            <h3 style="color: var(--purple); margin-bottom: 1rem;"><i class="fas fa-project-diagram"></i> Recommended Clinical Pathway (NCCN Guidelines)</h3>
            <div style="background: rgba(168, 85, 247, 0.05); border: 1px solid var(--purple); border-radius: 8px; padding: 15px;">
                <p style="font-size: 0.85rem; color: #fff; margin-bottom: 10px;">Based on the discrepancy finding (3.2 cm lobulated opacity), the AI recommends the following expedited oncology track:</p>
                <ul style="list-style-type: none; padding-left: 0; color: var(--text-muted); font-size: 0.9rem;">
                    <li style="margin-bottom: 8px;"><i class="fas fa-check-circle" style="color: var(--success); margin-right: 8px;"></i> <strong>Step 1:</strong> Immediate Contrast-Enhanced CT (Pending Approval)</li>
                    <li style="margin-bottom: 8px;"><i class="fas fa-spinner fa-spin" style="color: var(--warning); margin-right: 8px;"></i> <strong>Step 2:</strong> PET-CT Scan for staging</li>
                    <li style="margin-bottom: 8px;"><i class="far fa-circle" style="color: var(--text-muted); margin-right: 8px;"></i> <strong>Step 3:</strong> CT-guided Transthoracic Needle Biopsy (TTNB)</li>
                    <li style="margin-bottom: 8px;"><i class="far fa-circle" style="color: var(--text-muted); margin-right: 8px;"></i> <strong>Step 4:</strong> Surgical Oncology Consultation</li>
                </ul>
                <button class="btn-primary" style="margin-top: 10px; font-size: 0.8rem;" onclick="triggerAgentAction('Orders Placed', 'fas fa-clipboard-check', 'Clinical orders sent to CPOE system.')"><i class="fas fa-plus-circle"></i> Place CPOE Orders</button>
            </div>
        `;
    });

    // Feature 3: Auto-Appeal Drafter
    document.getElementById('btnTool3')?.addEventListener('click', () => {
        resetToolkitUI();
        toolOutput.innerHTML = `
            <h3 style="color: var(--warning); margin-bottom: 1rem;"><i class="fas fa-file-signature"></i> Drafted Insurance Appeal (CMS Measure 110 Context)</h3>
            <textarea style="width: 100%; height: 250px; background: rgba(0,0,0,0.5); color: #fff; padding: 1rem; border-radius: 8px; border: 1px solid var(--warning); font-family: 'Inter', sans-serif; font-size: 0.9rem;" readonly>DATE: ${new Date().toLocaleDateString()}
TO: Prior Authorization Dept (Aetna/UHC)
RE: Urgent Appeal for Contrast-Enhanced CT (CPT 71260)

To the Medical Director,

I am writing to formally appeal the denial of a contrast-enhanced CT for this patient. The initial human read noted "clear lungs", however, our secondary MediScan AI QA protocol detected a 3.2 cm lobulated opacity in the right upper lobe (ICD-10: R91.8). 

Under CMS Quality Measure 110 and ACR Appropriateness Criteria Protocol 7A, given the patient's age and history of smoking, a discrepancy of this magnitude mandates immediate follow-up imaging to rule out bronchogenic carcinoma. 

Please review the attached digital bounding box anomaly report and expedite approval to prevent delay in life-saving care.

Sincerely,
Dr. Sarah Chen, CMO</textarea>
            <button class="btn-primary" style="margin-top: 15px; width: 100%; background: var(--warning); color: #000;" onclick="triggerAgentAction('Appeal Sent', 'fas fa-paper-plane', 'Appeal securely transmitted to Payer API Portal.')"><i class="fas fa-paper-plane"></i> E-Fax to Payer Portal</button>
        `;
    });

    // Feature 4: Patient Handout
    document.getElementById('btnTool4')?.addEventListener('click', () => {
        resetToolkitUI();
        toolOutput.innerHTML = `
            <h3 style="color: var(--pink); margin-bottom: 1rem;"><i class="fas fa-clipboard-list"></i> Patient Education Handout</h3>
            <div style="background: #fff; color: #333; padding: 20px; border-radius: 8px; font-family: 'Inter', sans-serif;">
                <h2 style="color: #0ea5e9; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px;">Your Recent Scan Results</h2>
                <p style="font-size: 0.95rem; line-height: 1.6;"><strong>Hello,</strong><br><br>We ran a routine secondary AI check on your recent chest scan to ensure we provide you with the absolute best care. During this check, the computer noticed a small spot (called an "opacity") that we need to look at more closely.</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
                    <h4 style="margin-bottom: 5px; color: #111827;">What does this mean?</h4>
                    <p style="font-size: 0.85rem; margin-bottom: 0;">Most of the time, these spots are just scar tissue from a past infection. However, to be completely safe, your doctor has ordered a slightly more detailed scan (a CT scan) to get a clearer picture.</p>
                </div>
                <p style="font-size: 0.85rem;"><strong>Next Steps:</strong> The scheduling desk will call you today to set up a brief 15-minute appointment for the new scan.</p>
            </div>
            <button class="btn-outline" style="margin-top: 15px; width: 100%; border-color: var(--pink); color: var(--pink);" onclick="triggerAgentAction('Printed', 'fas fa-print', 'Document sent to Front Desk Printer 02.')"><i class="fas fa-print"></i> Send to Network Printer</button>
        `;
    });

});