/* =========================================================
   Meckman Resume Builder
   - Gate (privacy/AI accept)
   - localStorage state, autosave (debounced)
   - 6 sections: contact/objective, education, work, activities, skills, awards
   - AI polish via /api/polish
   - JSON export/import
   - Print → PDF (CSS handles layout)
========================================================= */

const STORAGE_KEY = "mrb.v1.resume";
const ACCEPT_KEY = "mrb.v1.accepted";
const ACCEPT_VERSION = "2026-05-23"; // bump to re-show gate after policy changes
const DECLINE_URL = "https://meckman.org";

// ----- default state -----
const blankResume = () => ({
    contact: { name: "", email: "", phone: "", location: "" },
    objective: "",
    education: [],
    work: [],
    activities: [],
    skills: [],
    awards: [],
});

const blankItem = {
    education: () => ({ id: uid(), school: "", credential: "", location: "", start: "", end: "", details: "" }),
    work: () => ({ id: uid(), title: "", employer: "", location: "", start: "", end: "", bullets: [""] }),
    activities: () => ({ id: uid(), name: "", role: "", start: "", end: "", bullets: [""] }),
    skills: () => ({ id: uid(), name: "" }),
    awards: () => ({ id: uid(), name: "", issuer: "", date: "" }),
};

let state = blankResume();

// ----- helpers -----
function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return blankResume();
        const parsed = JSON.parse(raw);
        return { ...blankResume(), ...parsed };
    } catch {
        return blankResume();
    }
}

let saveTimer;
function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            flashSaved();
        } catch (err) {
            toast("Could not save to your browser. Storage may be full.", true);
        }
    }, 250);
}

function flashSaved() {
    const el = document.getElementById("save-indicator");
    if (!el) return;
    el.textContent = "Saved in this browser";
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 600);
}

function setByPath(obj, path, value) {
    const keys = path.split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null) cur[keys[i]] = {};
        cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
}
function getByPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// =========================================================
// GATE
// =========================================================
function initGate() {
    const accepted = localStorage.getItem(ACCEPT_KEY);
    const gate = document.getElementById("gate");
    const app = document.getElementById("app");

    if (accepted === ACCEPT_VERSION) {
        gate.hidden = true;
        app.hidden = false;
        return true;
    }

    gate.hidden = false;
    app.hidden = true;

    document.getElementById("gate-accept").addEventListener("click", () => {
        localStorage.setItem(ACCEPT_KEY, ACCEPT_VERSION);
        gate.hidden = true;
        app.hidden = false;
        initApp();
    });
    document.getElementById("gate-decline").addEventListener("click", () => {
        window.location.replace(DECLINE_URL);
    });
    return false;
}

// =========================================================
// EDITOR — rendering & binding
// =========================================================
function bindSimpleInputs() {
    document.querySelectorAll("[data-bind]").forEach((el) => {
        const path = el.dataset.bind;
        el.value = getByPath(state, path) || "";
        el.addEventListener("input", () => {
            setByPath(state, path, el.value);
            save();
            renderPreview();
        });
    });
}

function renderLists() {
    renderEducation();
    renderWork();
    renderActivities();
    renderSkills();
    renderAwards();
}

function renderEducation() {
    const root = document.getElementById("list-education");
    root.innerHTML = "";
    state.education.forEach((item, idx) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = `
            <div class="item-header">
                <button class="btn-remove" data-remove="education" data-idx="${idx}">Remove</button>
            </div>
            <div class="field-grid">
                <label class="field"><span>School</span>
                    <input type="text" data-item="education.${idx}.school" placeholder="Lincoln High School">
                </label>
                <label class="field"><span>Credential / Grade</span>
                    <input type="text" data-item="education.${idx}.credential" placeholder="High School Diploma, expected 2027">
                </label>
                <label class="field"><span>City, State</span>
                    <input type="text" data-item="education.${idx}.location" placeholder="Cleveland, OH">
                </label>
                <label class="field"><span>Start</span>
                    <input type="text" data-item="education.${idx}.start" placeholder="Aug 2023">
                </label>
                <label class="field"><span>End</span>
                    <input type="text" data-item="education.${idx}.end" placeholder="Present / May 2027">
                </label>
            </div>
            <label class="field field-block"><span>Details <em>(GPA, honors, relevant classes — optional)</em></span>
                <textarea data-item="education.${idx}.details" rows="2" placeholder="GPA 3.7 / Honor Roll / Relevant classes: Computer Science, Business"></textarea>
            </label>
        `;
        root.appendChild(el);
    });
    wireItemInputs();
}

function renderWork() {
    const root = document.getElementById("list-work");
    root.innerHTML = "";
    state.work.forEach((item, idx) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = `
            <div class="item-header">
                <button class="btn-remove" data-remove="work" data-idx="${idx}">Remove</button>
            </div>
            <div class="field-grid">
                <label class="field"><span>Job title</span>
                    <input type="text" data-item="work.${idx}.title" placeholder="Cashier">
                </label>
                <label class="field"><span>Employer</span>
                    <input type="text" data-item="work.${idx}.employer" placeholder="Sunrise Bagel Co.">
                </label>
                <label class="field"><span>City, State</span>
                    <input type="text" data-item="work.${idx}.location" placeholder="Cleveland, OH">
                </label>
                <label class="field"><span>Start</span>
                    <input type="text" data-item="work.${idx}.start" placeholder="Jun 2024">
                </label>
                <label class="field"><span>End</span>
                    <input type="text" data-item="work.${idx}.end" placeholder="Present / Aug 2024">
                </label>
            </div>
            ${bulletsHtml("work", idx, item.bullets)}
        `;
        root.appendChild(el);
    });
    wireItemInputs();
}

function renderActivities() {
    const root = document.getElementById("list-activities");
    root.innerHTML = "";
    state.activities.forEach((item, idx) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = `
            <div class="item-header">
                <button class="btn-remove" data-remove="activities" data-idx="${idx}">Remove</button>
            </div>
            <div class="field-grid">
                <label class="field"><span>Activity / project / organization</span>
                    <input type="text" data-item="activities.${idx}.name" placeholder="Robotics Club / Dog walking for neighbors / Habitat for Humanity">
                </label>
                <label class="field"><span>Your role <em>(optional)</em></span>
                    <input type="text" data-item="activities.${idx}.role" placeholder="Team Captain / Volunteer">
                </label>
                <label class="field"><span>Start</span>
                    <input type="text" data-item="activities.${idx}.start" placeholder="Sep 2023">
                </label>
                <label class="field"><span>End</span>
                    <input type="text" data-item="activities.${idx}.end" placeholder="Present">
                </label>
            </div>
            ${bulletsHtml("activities", idx, item.bullets)}
        `;
        root.appendChild(el);
    });
    wireItemInputs();
}

function renderSkills() {
    const root = document.getElementById("list-skills");
    root.innerHTML = "";
    state.skills.forEach((item, idx) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = `
            <div class="item-header">
                <button class="btn-remove" data-remove="skills" data-idx="${idx}">Remove</button>
            </div>
            <label class="field"><span>Skill</span>
                <input type="text" data-item="skills.${idx}.name" placeholder="Google Docs / Spanish — conversational / Customer service">
            </label>
        `;
        root.appendChild(el);
    });
    wireItemInputs();
}

function renderAwards() {
    const root = document.getElementById("list-awards");
    root.innerHTML = "";
    state.awards.forEach((item, idx) => {
        const el = document.createElement("div");
        el.className = "item";
        el.innerHTML = `
            <div class="item-header">
                <button class="btn-remove" data-remove="awards" data-idx="${idx}">Remove</button>
            </div>
            <div class="field-grid">
                <label class="field"><span>Award / honor</span>
                    <input type="text" data-item="awards.${idx}.name" placeholder="Principal's List">
                </label>
                <label class="field"><span>Issuer <em>(optional)</em></span>
                    <input type="text" data-item="awards.${idx}.issuer" placeholder="Lincoln High School">
                </label>
                <label class="field"><span>Date <em>(optional)</em></span>
                    <input type="text" data-item="awards.${idx}.date" placeholder="May 2025">
                </label>
            </div>
        `;
        root.appendChild(el);
    });
    wireItemInputs();
}

function bulletsHtml(section, idx, bullets) {
    const rows = (bullets || []).map((text, bi) => `
        <div class="bullet-row" data-bullet-row data-section="${section}" data-idx="${idx}" data-bi="${bi}">
            <textarea data-bullet="${section}.${idx}.${bi}" rows="2" placeholder="What you did — e.g. Greeted customers and rang up about 50 orders during each shift.">${escapeHtml(text)}</textarea>
            <div class="bullet-actions">
                <button class="btn btn-ghost btn-ai" type="button" data-polish-bullet="${section}.${idx}.${bi}">Help me word this</button>
                <button class="btn-remove" type="button" data-remove-bullet="${section}.${idx}.${bi}">×</button>
            </div>
        </div>
    `).join("");
    return `
        <div class="bullets">
            ${rows}
            <button class="btn btn-add" type="button" data-add-bullet="${section}.${idx}">+ Add bullet</button>
        </div>
    `;
}

function wireItemInputs() {
    document.querySelectorAll("[data-item]").forEach((el) => {
        if (el.dataset.wired) return;
        el.dataset.wired = "1";
        el.addEventListener("input", () => {
            const [section, idx, field] = el.dataset.item.split(".");
            state[section][+idx][field] = el.value;
            save();
            renderPreview();
        });
    });
    document.querySelectorAll("[data-bullet]").forEach((el) => {
        if (el.dataset.wired) return;
        el.dataset.wired = "1";
        el.addEventListener("input", () => {
            const [section, idx, bi] = el.dataset.bullet.split(".");
            state[section][+idx].bullets[+bi] = el.value;
            save();
            renderPreview();
        });
    });
}

// =========================================================
// Add / remove handlers (delegated)
// =========================================================
function initListActions() {
    document.addEventListener("click", (e) => {
        const t = e.target;

        // Add new item to a section
        if (t.matches("[data-add]")) {
            const section = t.dataset.add;
            state[section].push(blankItem[section]());
            save();
            rerender();
            return;
        }

        // Remove an item
        if (t.matches("[data-remove]")) {
            const section = t.dataset.remove;
            const idx = +t.dataset.idx;
            if (!confirm("Remove this entry?")) return;
            state[section].splice(idx, 1);
            save();
            rerender();
            return;
        }

        // Add a bullet to an entry
        if (t.matches("[data-add-bullet]")) {
            const [section, idx] = t.dataset.addBullet.split(".");
            state[section][+idx].bullets.push("");
            save();
            rerender();
            return;
        }

        // Remove a bullet
        if (t.matches("[data-remove-bullet]")) {
            const [section, idx, bi] = t.dataset.removeBullet.split(".");
            state[section][+idx].bullets.splice(+bi, 1);
            if (state[section][+idx].bullets.length === 0) {
                state[section][+idx].bullets.push("");
            }
            save();
            rerender();
            return;
        }

        // AI polish (objective)
        if (t.matches("[data-polish]")) {
            const path = t.dataset.polish;
            polishField(t, path);
            return;
        }

        // AI polish (bullet)
        if (t.matches("[data-polish-bullet]")) {
            polishBullet(t, t.dataset.polishBullet);
            return;
        }
    });
}

function rerender() {
    renderLists();
    renderPreview();
}

// =========================================================
// AI polish
// =========================================================
async function polishText(text) {
    const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Something went wrong. Try again.");
    return data.polished;
}

async function polishField(btn, path) {
    const ta = document.querySelector(`[data-bind="${path}"]`);
    const text = (ta?.value || "").trim();
    if (!text) { toast("Write something first, then click Help me word this.", true); return; }
    btn.disabled = true; btn.textContent = "Thinking…";
    try {
        const polished = await polishText(text);
        ta.value = polished;
        setByPath(state, path, polished);
        save();
        renderPreview();
        toast("Polished. Read it carefully before keeping it.");
    } catch (err) {
        toast(err.message, true);
    } finally {
        btn.disabled = false; btn.textContent = "Help me word this";
    }
}

async function polishBullet(btn, bulletPath) {
    const [section, idx, bi] = bulletPath.split(".");
    const ta = document.querySelector(`[data-bullet="${bulletPath}"]`);
    const text = (ta?.value || "").trim();
    if (!text) { toast("Write a draft of the bullet first.", true); return; }
    btn.disabled = true; btn.textContent = "Thinking…";
    try {
        const polished = await polishText(text);
        ta.value = polished;
        state[section][+idx].bullets[+bi] = polished;
        save();
        renderPreview();
        toast("Polished. Read it carefully before keeping it.");
    } catch (err) {
        toast(err.message, true);
    } finally {
        btn.disabled = false; btn.textContent = "Help me word this";
    }
}

// =========================================================
// PREVIEW (also what gets printed)
// =========================================================
function renderPreview() {
    const root = document.getElementById("resume-preview");
    const c = state.contact || {};
    const name = (c.name || "").trim();
    const contactParts = [c.email, c.phone, c.location].map((s) => (s || "").trim()).filter(Boolean);

    const hasAnything =
        name ||
        contactParts.length ||
        state.objective?.trim() ||
        state.education.length ||
        state.work.length ||
        state.activities.length ||
        state.skills.length ||
        state.awards.length;

    if (!hasAnything) {
        root.innerHTML = `<div class="r-empty">Your resume will appear here as you fill out the form.</div>`;
        return;
    }

    let html = "";
    html += `<div class="r-name">${escapeHtml(name) || "Your Name"}</div>`;
    if (contactParts.length) {
        html += `<div class="r-contact">${contactParts.map((p) => `<span>${escapeHtml(p)}</span>`).join("")}</div>`;
    }
    if (state.objective?.trim()) {
        html += `<div class="r-objective">${escapeHtml(state.objective.trim())}</div>`;
    }

    if (state.education.length) {
        html += `<div class="r-section"><div class="r-section-title">Education</div>`;
        state.education.forEach((e) => {
            const dates = [e.start, e.end].filter(Boolean).join(" – ");
            html += `<div class="r-entry">
                <div class="r-entry-head">
                    <div class="r-entry-title">${escapeHtml(e.school || "School")}${e.location ? `, ${escapeHtml(e.location)}` : ""}</div>
                    ${dates ? `<div class="r-entry-meta">${escapeHtml(dates)}</div>` : ""}
                </div>
                ${e.credential ? `<div class="r-entry-sub">${escapeHtml(e.credential)}</div>` : ""}
                ${e.details ? `<div class="r-entry-sub">${escapeHtml(e.details)}</div>` : ""}
            </div>`;
        });
        html += `</div>`;
    }

    if (state.work.length) {
        html += `<div class="r-section"><div class="r-section-title">Experience</div>`;
        state.work.forEach((w) => {
            const dates = [w.start, w.end].filter(Boolean).join(" – ");
            const left = [w.title, w.employer].filter(Boolean).join(" — ") || "Position";
            html += `<div class="r-entry">
                <div class="r-entry-head">
                    <div class="r-entry-title">${escapeHtml(left)}</div>
                    ${dates ? `<div class="r-entry-meta">${escapeHtml(dates)}</div>` : ""}
                </div>
                ${w.location ? `<div class="r-entry-sub">${escapeHtml(w.location)}</div>` : ""}
                ${bulletListHtml(w.bullets)}
            </div>`;
        });
        html += `</div>`;
    }

    if (state.activities.length) {
        html += `<div class="r-section"><div class="r-section-title">Activities &amp; Volunteering</div>`;
        state.activities.forEach((a) => {
            const dates = [a.start, a.end].filter(Boolean).join(" – ");
            const left = [a.name, a.role].filter(Boolean).join(" — ") || "Activity";
            html += `<div class="r-entry">
                <div class="r-entry-head">
                    <div class="r-entry-title">${escapeHtml(left)}</div>
                    ${dates ? `<div class="r-entry-meta">${escapeHtml(dates)}</div>` : ""}
                </div>
                ${bulletListHtml(a.bullets)}
            </div>`;
        });
        html += `</div>`;
    }

    if (state.skills.length) {
        const list = state.skills.map((s) => (s.name || "").trim()).filter(Boolean);
        if (list.length) {
            html += `<div class="r-section"><div class="r-section-title">Skills</div>
                <div class="r-skills-list">${list.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</div>
            </div>`;
        }
    }

    if (state.awards.length) {
        html += `<div class="r-section"><div class="r-section-title">Awards &amp; Honors</div>`;
        state.awards.forEach((a) => {
            const meta = [a.issuer, a.date].filter(Boolean).join(" • ");
            html += `<div class="r-entry">
                <div class="r-entry-head">
                    <div class="r-entry-title">${escapeHtml(a.name || "Award")}</div>
                    ${meta ? `<div class="r-entry-meta">${escapeHtml(meta)}</div>` : ""}
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    root.innerHTML = html;
}

function bulletListHtml(bullets) {
    const items = (bullets || []).map((b) => (b || "").trim()).filter(Boolean);
    if (!items.length) return "";
    return `<ul class="r-bullets">${items.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
}

// =========================================================
// Toolbar: export, import, reset, print, privacy
// =========================================================
function initToolbar() {
    document.getElementById("btn-export").addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeName = (state.contact?.name || "resume").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        a.href = url;
        a.download = `${safeName}-resume.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    const fileInput = document.getElementById("import-file");
    document.getElementById("btn-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (typeof parsed !== "object" || parsed === null) throw new Error("Bad file");
            if (!confirm("Replace your current resume with the imported one?")) return;
            state = { ...blankResume(), ...parsed };
            save();
            bindSimpleInputs();
            rerender();
            toast("Imported.");
        } catch {
            toast("That doesn't look like a Meckman Resume Builder backup file.", true);
        } finally {
            fileInput.value = "";
        }
    });

    document.getElementById("btn-reset").addEventListener("click", () => {
        if (!confirm("Erase everything and start over? This can't be undone.")) return;
        state = blankResume();
        localStorage.removeItem(STORAGE_KEY);
        bindSimpleInputs();
        rerender();
        toast("Started over.");
    });

    document.getElementById("btn-print").addEventListener("click", () => {
        window.print();
    });

    document.getElementById("btn-pdf").addEventListener("click", (e) => {
        downloadPdf(e.currentTarget);
    });

    document.getElementById("show-privacy").addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem(ACCEPT_KEY);
        location.reload();
    });
}

// =========================================================
// PDF download — declarative jsPDF (vector text, ATS-friendly)
// =========================================================
let _jsPdfPromise;
function loadJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (_jsPdfPromise) return _jsPdfPromise;
    _jsPdfPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "/vendor/jspdf.umd.min.js";
        s.onload = () => resolve(window.jspdf?.jsPDF);
        s.onerror = () => reject(new Error("Could not load the PDF tool. Check your connection and try again."));
        document.head.appendChild(s);
    });
    return _jsPdfPromise;
}

async function downloadPdf(btn) {
    if (!hasResumeContent(state)) {
        toast("Fill in your resume first.", true);
        return;
    }

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparing PDF…";
    try {
        const jsPDF = await loadJsPdf();
        const doc = renderResumePdf(jsPDF, state);
        const safeName = (state.contact?.name || "resume")
            .replace(/[^a-z0-9]+/gi, "-")
            .toLowerCase()
            .replace(/^-+|-+$/g, "") || "resume";
        doc.save(`${safeName}-resume.pdf`);
        toast("PDF saved.");
    } catch (err) {
        toast(err.message || "Could not generate PDF. Try the Print button instead.", true);
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
}

function hasResumeContent(s) {
    return Boolean(
        (s.contact?.name || "").trim() ||
        (s.contact?.email || "").trim() ||
        (s.contact?.phone || "").trim() ||
        (s.contact?.location || "").trim() ||
        (s.objective || "").trim() ||
        s.education.length ||
        s.work.length ||
        s.activities.length ||
        s.skills.length ||
        s.awards.length,
    );
}

// ---- PDF layout primitives ----
function lh(ptSize, factor = 1.2) {
    return (ptSize * factor) / 72; // points → inches
}

class PdfBuilder {
    constructor(jsPDF) {
        this.doc = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
        this.m = { top: 0.6, right: 0.75, bottom: 0.6, left: 0.75 };
        this.pageW = this.doc.internal.pageSize.getWidth();
        this.pageH = this.doc.internal.pageSize.getHeight();
        this.contentW = this.pageW - this.m.left - this.m.right;
        this.y = this.m.top;
    }

    newPage() {
        this.doc.addPage();
        this.y = this.m.top;
    }
    need(h) {
        if (this.y + h > this.pageH - this.m.bottom) this.newPage();
    }
    space(h) { this.y += h; }

    setStyle(family, style, size, color = [0, 0, 0]) {
        this.doc.setFont(family, style);
        this.doc.setFontSize(size);
        this.doc.setTextColor(color[0], color[1], color[2]);
    }

    // Draw wrapped text. Advances y. Honors page breaks.
    write(str, opts = {}) {
        const {
            family = "times", style = "normal", size = 11,
            color = [0, 0, 0], align = "left",
            x = this.m.left, maxWidth = this.contentW, indent = 0,
            charSpace = 0, factor = 1.25,
        } = opts;
        this.setStyle(family, style, size, color);
        const w = maxWidth - indent;
        const lines = this.doc.splitTextToSize(String(str ?? ""), w);
        const rowH = lh(size, factor);
        for (const line of lines) {
            this.need(rowH);
            let drawX = x + indent;
            if (align === "right") {
                drawX = x + maxWidth - this.doc.getTextWidth(line);
            } else if (align === "center") {
                drawX = x + (maxWidth - this.doc.getTextWidth(line)) / 2;
            }
            this.doc.text(line, drawX, this.y, { baseline: "top", charSpace });
            this.y += rowH;
        }
    }

    // Bold title left, italic gray meta right, on a single baseline.
    twoCol(left, right, opts = {}) {
        const size = opts.size ?? 11;
        const rowH = lh(size, 1.25);
        this.need(rowH);

        let rightW = 0;
        if (right) {
            this.setStyle("times", "italic", size - 1, [70, 70, 70]);
            rightW = this.doc.getTextWidth(right);
        }
        const maxLeft = this.contentW - rightW - (right ? 0.1 : 0);

        this.setStyle("times", "bold", size, [0, 0, 0]);
        const leftLines = this.doc.splitTextToSize(left || "", maxLeft);

        this.doc.text(leftLines[0] || "", this.m.left, this.y, { baseline: "top" });
        if (right) {
            this.setStyle("times", "italic", size - 1, [70, 70, 70]);
            this.doc.text(right, this.m.left + this.contentW - rightW, this.y, { baseline: "top" });
        }
        this.y += rowH;

        if (leftLines.length > 1) {
            this.setStyle("times", "bold", size, [0, 0, 0]);
            for (let i = 1; i < leftLines.length; i++) {
                this.need(rowH);
                this.doc.text(leftLines[i], this.m.left, this.y, { baseline: "top" });
                this.y += rowH;
            }
        }
    }

    section(title) {
        const headerH = lh(11, 1.4);
        // Make sure we don't strand a header at the bottom of a page.
        this.need(headerH + 0.25);
        this.space(0.05);
        this.setStyle("times", "bold", 11, [0, 0, 0]);
        this.doc.text(title.toUpperCase(), this.m.left, this.y, {
            baseline: "top",
            charSpace: 0.015,
        });
        this.y += headerH * 0.9;
        this.doc.setDrawColor(0);
        this.doc.setLineWidth(0.012);
        this.doc.line(this.m.left, this.y, this.m.left + this.contentW, this.y);
        this.space(0.08);
    }

    rule(opts = {}) {
        const { color = [120, 120, 120], thickness = 0.005 } = opts;
        this.doc.setDrawColor(color[0], color[1], color[2]);
        this.doc.setLineWidth(thickness);
        this.doc.line(this.m.left, this.y, this.m.left + this.contentW, this.y);
    }

    bullets(items) {
        const size = 10.5;
        const rowH = lh(size, 1.3);
        const indent = 0.2;
        const cleaned = (items || []).map((b) => (b || "").trim()).filter(Boolean);
        for (const item of cleaned) {
            this.setStyle("times", "normal", size, [20, 20, 20]);
            const lines = this.doc.splitTextToSize(item, this.contentW - indent);
            // Keep bullet glyph on same line as first text line, even across pages.
            this.need(rowH);
            this.doc.text("•", this.m.left + 0.04, this.y, { baseline: "top" });
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) this.need(rowH);
                this.doc.text(lines[i], this.m.left + indent, this.y, { baseline: "top" });
                this.y += rowH;
            }
        }
    }
}

function renderResumePdf(jsPDF, state) {
    const b = new PdfBuilder(jsPDF);
    const c = state.contact || {};
    const name = (c.name || "").trim() || "Your Name";

    // NAME
    b.write(name, { family: "times", style: "bold", size: 22, factor: 1.1 });
    b.space(0.02);

    // CONTACT LINE
    const contactParts = [c.email, c.phone, c.location]
        .map((s) => (s || "").trim())
        .filter(Boolean);
    if (contactParts.length) {
        b.write(contactParts.join("  •  "), {
            family: "times", style: "normal", size: 10, color: [60, 60, 60],
            factor: 1.2,
        });
    }
    b.space(0.08);

    // OBJECTIVE
    const objective = (state.objective || "").trim();
    if (objective) {
        b.rule();
        b.space(0.1);
        b.write(objective, {
            family: "times", style: "italic", size: 10.5, color: [30, 30, 30],
            factor: 1.3,
        });
        b.space(0.06);
        b.rule();
        b.space(0.16);
    } else {
        b.space(0.08);
    }

    // EDUCATION
    if (state.education.length) {
        b.section("Education");
        for (const e of state.education) {
            const dates = [e.start, e.end].filter(Boolean).join(" – ");
            const head = (e.school || "School") + (e.location ? `, ${e.location}` : "");
            b.twoCol(head, dates);
            if (e.credential) b.write(e.credential, { size: 10, color: [50, 50, 50], factor: 1.25 });
            if (e.details) b.write(e.details, { size: 10, color: [50, 50, 50], factor: 1.25 });
            b.space(0.1);
        }
    }

    // WORK
    if (state.work.length) {
        b.section("Experience");
        for (const w of state.work) {
            const dates = [w.start, w.end].filter(Boolean).join(" – ");
            const head = [w.title, w.employer].filter(Boolean).join(" — ") || "Position";
            b.twoCol(head, dates);
            if (w.location) b.write(w.location, { size: 10, color: [50, 50, 50], factor: 1.2 });
            b.bullets(w.bullets);
            b.space(0.1);
        }
    }

    // ACTIVITIES
    if (state.activities.length) {
        b.section("Activities & Volunteering");
        for (const a of state.activities) {
            const dates = [a.start, a.end].filter(Boolean).join(" – ");
            const head = [a.name, a.role].filter(Boolean).join(" — ") || "Activity";
            b.twoCol(head, dates);
            b.bullets(a.bullets);
            b.space(0.1);
        }
    }

    // SKILLS
    if (state.skills.length) {
        const list = state.skills.map((s) => (s.name || "").trim()).filter(Boolean);
        if (list.length) {
            b.section("Skills");
            b.write(list.join("  •  "), {
                family: "times", style: "normal", size: 10.5, color: [20, 20, 20],
                factor: 1.3,
            });
            b.space(0.08);
        }
    }

    // AWARDS
    if (state.awards.length) {
        b.section("Awards & Honors");
        for (const a of state.awards) {
            const meta = [a.issuer, a.date].filter(Boolean).join(" • ");
            b.twoCol(a.name || "Award", meta);
            b.space(0.04);
        }
    }

    return b.doc;
}

// =========================================================
// Toast
// =========================================================
let toastTimer;
function toast(msg, isError = false) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// =========================================================
// Init
// =========================================================
function initApp() {
    state = load();
    bindSimpleInputs();
    initListActions();
    initToolbar();
    rerender();
}

document.addEventListener("DOMContentLoaded", () => {
    const accepted = initGate();
    if (accepted) initApp();
});
