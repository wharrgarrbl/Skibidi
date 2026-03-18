const API_URL = "https://script.google.com/macros/s/AKfycbyVzQBC-kaWrZh_4HVm6wqX9J7zmuVMACS3ScPQm95T9bUngzigqPXigwfzdd2bpd7QEw/exec"

// ===== TOAST =====
function showToast(message, duration = 2500) {
    const toast = document.getElementById("toast")
    toast.textContent = message
    toast.classList.add("show")
    clearTimeout(toast._hideTimeout)
    toast._hideTimeout = setTimeout(() => toast.classList.remove("show"), duration)
}

// ===== NAVIGATION =====
const NAV_MAP = {
    log: "navLog",
    trips: "navTrips",
    tripDetail: "navTrips",
    invoices: "navInvoices",
    notes: "navNotes",
    noteDetail: "navNotes",
    warnings: "navWarnings"
}

function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"))
    document.getElementById(id).classList.add("active")
    document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"))
    const navId = NAV_MAP[id]
    if (navId) document.getElementById(navId)?.classList.add("active")
}

// ===== THEME =====
const toggle = document.getElementById("themeToggle")
const savedTheme = localStorage.getItem("theme")
if (savedTheme) document.documentElement.dataset.theme = savedTheme

toggle.onclick = () => {
    const isDark = document.documentElement.dataset.theme === "dark"
    const next = isDark ? "light" : "dark"
    document.documentElement.dataset.theme = next
    localStorage.setItem("theme", next)
}

// ===== IMAGE UTILS =====
function compressImage(file, maxWidth = 1200, quality = 0.75) {
    return new Promise(resolve => {
        const img = new Image()
        const reader = new FileReader()
        reader.onload = e => img.src = e.target.result
        img.onload = () => {
            const canvas = document.createElement("canvas")
            const scale = Math.min(1, maxWidth / img.width)
            canvas.width = img.width * scale
            canvas.height = img.height * scale
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1])
        }
        reader.readAsDataURL(file)
    })
}

function generateFilename(prefix) {
    const now = new Date()
    const d = now.toISOString().split("T")[0]
    const t = `${now.getHours()}-${now.getMinutes()}`
    return `${d}_${prefix}_${t}.jpg`
}

function today() {
    return new Date().toISOString().split("T")[0]
}

// ===== GPS =====
let currentLocation = null

function getLocation() {
    if (!navigator.geolocation) { showToast("GPS not supported"); return }
    showToast("Getting location…")
    navigator.geolocation.getCurrentPosition(pos => {
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        document.getElementById("locationDisplay").innerHTML =
            `📍 ${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
        showToast("Location attached")
    }, () => showToast("Could not get location"))
}

// ===== POST HELPER =====
async function postData(params) {
    const formData = new FormData()
    Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined) formData.append(k, v) })
    return fetch(API_URL, { method: "POST", body: formData })
}


// ========================================
// ===== TRIPS =====
// ========================================
let editingTripId = null

function setDefaultLogValues() {
    const now = new Date()
    const dateEl = document.getElementById("date")
    const depEl = document.getElementById("departure")
    const engStartEl = document.getElementById("engineStart")
    if (dateEl && !dateEl.value) dateEl.value = today()
    if (depEl && !depEl.value) depEl.value = now.toTimeString().slice(0, 5)
    try {
        const trips = JSON.parse(localStorage.getItem("trips") || "[]")
        if (trips.length > 0 && engStartEl && trips[0].engineEnd && !engStartEl.value) {
            engStartEl.value = trips[0].engineEnd
        }
    } catch (e) {}
}

async function loadTripsFromServer() {
    try {
        const res = await fetch(API_URL)
        const data = await res.json()
        const trips = Array.isArray(data) ? data : []
        localStorage.setItem("trips", JSON.stringify(trips))
        renderTrips()
    } catch (err) {
        console.error("Failed to load trips", err)
        renderTrips()
    }
}

function renderTrips() {
    const list = document.getElementById("tripList")
    if (!list) return
    const filter = document.getElementById("tripFilterDate")?.value
    const trips = JSON.parse(localStorage.getItem("trips") || "[]")
    list.innerHTML = ""

    const filtered = trips.filter(t => !filter || t.date === filter)

    if (!filtered.length) {
        list.innerHTML = `<p class="empty">${filter ? "No outings on this date" : "No outings logged yet"}</p>`
        return
    }

    filtered.forEach(t => {
        const div = document.createElement("div")
        div.className = "trip"
        div.innerHTML = `
            <p class="trip-title">${t.route || "—"}</p>
            <p class="trip-meta">${t.date} &nbsp;·&nbsp; ${t.captain}${t.departure ? " &nbsp;·&nbsp; " + t.departure : ""}${t.arrival ? " – " + t.arrival : ""}</p>
            <span class="tag">${t.miles || 0} mi</span>
            <span class="tag">${t.fuel || 0} L</span>
            ${t.photo ? '<span class="tag">📷</span>' : ""}
            <div class="trip-actions">
                <button onclick="viewTrip('${t.id}')">View</button>
                <button class="btn-secondary" onclick="editTrip('${t.id}')">Edit</button>
                <button class="btn-secondary" onclick="deleteTrip('${t.id}')">Delete</button>
            </div>
        `
        list.appendChild(div)
    })
}

function viewTrip(id) {
    const trips = JSON.parse(localStorage.getItem("trips") || "[]")
    const t = trips.find(x => String(x.id) === String(id))
    if (!t) return
    const c = document.getElementById("tripDetailContent")
    if (!c) return
    c.innerHTML = `
        <div class="detail-row"><span class="detail-key">Date</span><span class="detail-val">${t.date}</span></div>
        <div class="detail-row"><span class="detail-key">Departure</span><span class="detail-val">${t.departure}</span></div>
        <div class="detail-row"><span class="detail-key">Arrival</span><span class="detail-val">${t.arrival}</span></div>
        <div class="detail-row"><span class="detail-key">Captain</span><span class="detail-val">${t.captain}</span></div>
        <div class="detail-row"><span class="detail-key">Participants</span><span class="detail-val">${t.participants || "—"}</span></div>
        <div class="detail-row"><span class="detail-key">Route</span><span class="detail-val">${t.route || "—"}</span></div>
        <div class="detail-row"><span class="detail-key">Miles</span><span class="detail-val">${t.miles}</span></div>
        <div class="detail-row"><span class="detail-key">Fuel</span><span class="detail-val">${t.fuel} L</span></div>
        <div class="detail-row"><span class="detail-key">Engine hours</span><span class="detail-val">${t.engineStart} → ${t.engineEnd}</span></div>
        ${t.photo ? `<img src="${t.photo}" alt="Trip photo">` : ""}
    `
    showPage("tripDetail")
}

function editTrip(id) {
    const trips = JSON.parse(localStorage.getItem("trips") || "[]")
    const t = trips.find(x => String(x.id) === String(id))
    if (!t) return
    editingTripId = id
    document.getElementById("date").value = t.date || ""
    document.getElementById("departure").value = t.departure || ""
    document.getElementById("arrival").value = t.arrival || ""
    document.getElementById("captain").value = t.captain || ""
    document.getElementById("participants").value = t.participants || ""
    document.getElementById("route").value = t.route || ""
    document.getElementById("miles").value = t.miles || ""
    document.getElementById("fuel").value = t.fuel || ""
    document.getElementById("engineStart").value = t.engineStart || ""
    document.getElementById("engineEnd").value = t.engineEnd || ""
    document.getElementById("logTitle").textContent = "Edit outing"
    document.getElementById("saveTripBtn").textContent = "Update outing"
    document.getElementById("cancelEditBtn").style.display = "inline-flex"
    showPage("log")
}

function cancelTripEdit() {
    editingTripId = null
    document.getElementById("logTitle").textContent = "Log outing"
    document.getElementById("saveTripBtn").textContent = "Save outing"
    document.getElementById("cancelEditBtn").style.display = "none"
    clearTripForm()
    setDefaultLogValues()
}

function clearTripForm() {
    ;["route", "participants", "miles", "fuel", "arrival", "engineEnd", "photo"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = "" })
}

async function deleteTrip(id) {
    if (!confirm("Delete this outing?")) return
    showToast("Deleting…")
    try {
        await postData({ action: "deleteTrip", id })
        await loadTripsFromServer()
        showToast("Outing deleted")
    } catch (err) {
        showToast("Error deleting outing")
    }
}

async function saveTrip() {
    showToast("Saving…")
    let base64Photo = "", filename = ""
    const file = document.getElementById("photo")?.files[0]
    if (file) {
        base64Photo = await compressImage(file)
        filename = generateFilename("trip")
    }
    const params = {
        action: "trip",
        date: document.getElementById("date").value,
        departure: document.getElementById("departure").value,
        arrival: document.getElementById("arrival").value,
        captain: document.getElementById("captain").value,
        participants: document.getElementById("participants").value,
        route: document.getElementById("route").value,
        miles: document.getElementById("miles").value,
        fuel: document.getElementById("fuel").value,
        engineStart: document.getElementById("engineStart").value,
        engineEnd: document.getElementById("engineEnd").value,
        photo: base64Photo,
        filename: filename
    }
    if (editingTripId) params.id = editingTripId
    try {
        await postData(params)
        await loadTripsFromServer()
        showToast(editingTripId ? "✓ Outing updated" : "✓ Outing saved")
        editingTripId = null
        document.getElementById("logTitle").textContent = "Log outing"
        document.getElementById("saveTripBtn").textContent = "Save outing"
        document.getElementById("cancelEditBtn").style.display = "none"
        clearTripForm()
        setDefaultLogValues()
        showPage("trips")
    } catch (err) {
        console.error(err)
        showToast("Error saving outing")
    }
}


// ========================================
// ===== NOTES =====
// ========================================
let editingNoteId = null
let noteFormVisible = false

function toggleNoteForm() {
    if (editingNoteId) { cancelNoteEdit(); return }
    noteFormVisible = !noteFormVisible
    document.getElementById("noteForm").style.display = noteFormVisible ? "block" : "none"
}

function cancelNoteEdit() {
    editingNoteId = null
    noteFormVisible = false
    document.getElementById("noteForm").style.display = "none"
    document.getElementById("noteText").value = ""
    document.getElementById("notePhoto").value = ""
    document.getElementById("locationDisplay").innerHTML = ""
    document.getElementById("saveNoteBtn").textContent = "Save note"
    currentLocation = null
}

async function loadNotesFromServer() {
    try {
        const res = await postData({ action: "getNotes" })
        const data = await res.json()
        const notes = Array.isArray(data) ? data : []
        // Guard: reject trip data accidentally returned (trips have 'departure', notes have 'text')
        if (notes.length === 0 || notes[0].text !== undefined) {
            localStorage.setItem("notes", JSON.stringify(notes))
        }
        renderNotes()
    } catch (err) {
        console.error("Failed to load notes", err)
        renderNotes()
    }
}

async function saveNote() {
    const text = document.getElementById("noteText").value.trim()
    if (!text) { showToast("Note text is empty"); return }
    showToast("Saving note…")
    let photo = "", filename = ""
    const file = document.getElementById("notePhoto").files[0]
    if (file) {
        photo = await compressImage(file)
        filename = generateFilename("note")
    }
    const params = {
        action: editingNoteId ? "updateNote" : "note",
        date: today(),
        text,
        photo,
        filename,
        lat: currentLocation?.lat ?? "",
        lng: currentLocation?.lng ?? ""
    }
    if (editingNoteId) params.id = editingNoteId
    try {
        await postData(params)
        showToast(editingNoteId ? "✓ Note updated" : "✓ Note saved")
        cancelNoteEdit()
        await loadNotesFromServer()
    } catch (err) {
        console.error(err)
        showToast("Error saving note")
    }
}

function renderNotes() {
    const notes = JSON.parse(localStorage.getItem("notes") || "[]")
    const list = document.getElementById("notesList")
    if (!list) return
    list.innerHTML = ""
    if (!notes.length) {
        list.innerHTML = `<p class="empty">No notes yet</p>`
        return
    }
    notes.forEach(n => {
        const text = n.text || ""
        const short = text.length > 80 ? text.substring(0, 80) + "…" : text
        const div = document.createElement("div")
        div.className = "trip"
        div.innerHTML = `
            <p class="trip-title" style="font-size:15px">${short}</p>
            <p class="trip-meta">${n.date}</p>
            ${n.photo ? '<span class="tag">📷</span>' : ""}
            ${(n.lat && n.lng) ? '<span class="tag">📍</span>' : ""}
            <div class="trip-actions">
                <button onclick="viewNote('${n.id}')">View</button>
                <button class="btn-secondary" onclick="editNote('${n.id}')">Edit</button>
                <button class="btn-secondary" onclick="deleteNote('${n.id}')">Delete</button>
            </div>
        `
        list.appendChild(div)
    })
}

function viewNote(id) {
    const notes = JSON.parse(localStorage.getItem("notes") || "[]")
    const n = notes.find(x => String(x.id) === String(id))
    if (!n) return
    let locationHtml = ""
    if (n.lat && n.lng) {
        const mapLink = `https://www.google.com/maps?q=${n.lat},${n.lng}`
        locationHtml = `<p><strong>Location:</strong> <a href="${mapLink}" target="_blank">
            ${parseFloat(n.lat).toFixed(5)}, ${parseFloat(n.lng).toFixed(5)}</a></p>`
    }
    document.getElementById("noteDetailContent").innerHTML = `
        <p><strong>Date:</strong> ${n.date}</p>
        <p style="white-space:pre-wrap">${n.text}</p>
        ${locationHtml}
        ${n.photo ? `<img src="${n.photo}" alt="Note photo">` : ""}
    `
    showPage("noteDetail")
}

function editNote(id) {
    const notes = JSON.parse(localStorage.getItem("notes") || "[]")
    const n = notes.find(x => String(x.id) === String(id))
    if (!n) return
    editingNoteId = id
    document.getElementById("noteText").value = n.text || ""
    if (n.lat && n.lng) {
        currentLocation = { lat: parseFloat(n.lat), lng: parseFloat(n.lng) }
        document.getElementById("locationDisplay").innerHTML =
            `📍 ${parseFloat(n.lat).toFixed(5)}, ${parseFloat(n.lng).toFixed(5)}`
    }
    document.getElementById("saveNoteBtn").textContent = "Update note"
    document.getElementById("noteForm").style.display = "block"
    noteFormVisible = true
    showPage("notes")
}

async function deleteNote(id) {
    if (!confirm("Delete this note?")) return
    const notes = JSON.parse(localStorage.getItem("notes") || "[]")
    localStorage.setItem("notes", JSON.stringify(notes.filter(n => String(n.id) !== String(id))))
    renderNotes()
    showToast("Note deleted")
    try {
        await postData({ action: "deleteNote", id })
    } catch (err) {
        console.warn("Server delete failed", err)
    }
}


// ========================================
// ===== INVOICES / EXPENSES =====
// ========================================
let editingInvoiceId = null

async function loadInvoicesFromServer() {
    try {
        const res = await postData({ action: "getInvoices" })
        const data = await res.json()
        const invoices = Array.isArray(data) ? data : []
        // Guard: reject trip data accidentally returned (trips have 'departure', invoices have 'desc')
        if (invoices.length === 0 || invoices[0].desc !== undefined) {
            localStorage.setItem("invoices", JSON.stringify(invoices))
        }
        renderInvoices()
    } catch (err) {
        console.error("Failed to load invoices", err)
        renderInvoices()
    }
}

async function saveInvoice() {
    const desc = document.getElementById("invoiceDesc").value.trim()
    const amount = document.getElementById("invoiceAmount").value
    if (!desc || !amount) { showToast("Please fill in description and amount"); return }
    showToast("Saving…")
    let photo = "", filename = ""
    const file = document.getElementById("invoicePhoto").files[0]
    if (file) {
        photo = await compressImage(file)
        filename = generateFilename("invoice")
    }
    const params = {
        action: editingInvoiceId ? "updateInvoice" : "invoice",
        date: document.getElementById("invoiceDate").value || today(),
        desc,
        category: document.getElementById("invoiceCategory").value,
        amount,
        photo,
        filename
    }
    if (editingInvoiceId) params.id = editingInvoiceId
    try {
        await postData(params)
        showToast(editingInvoiceId ? "✓ Expense updated" : "✓ Expense saved")
        cancelInvoiceEdit()
        await loadInvoicesFromServer()
    } catch (err) {
        console.error(err)
        showToast("Error saving expense")
    }
}

function cancelInvoiceEdit() {
    editingInvoiceId = null
    document.getElementById("invoiceDesc").value = ""
    document.getElementById("invoiceAmount").value = ""
    document.getElementById("invoicePhoto").value = ""
    document.getElementById("invoiceDate").value = ""
    document.getElementById("invoiceCategory").value = "Fuel"
    document.getElementById("saveInvoiceBtn").textContent = "Add expense"
    document.getElementById("cancelInvoiceBtn").style.display = "none"
}

function renderInvoices() {
    const list = document.getElementById("invoiceList")
    if (!list) return
    const invoices = JSON.parse(localStorage.getItem("invoices") || "[]")
    list.innerHTML = ""
    if (!invoices.length) {
        list.innerHTML = `<p class="empty">No expenses yet</p>`
        return
    }
    const total = invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
    const totalDiv = document.createElement("div")
    totalDiv.className = "invoice-total"
    totalDiv.innerHTML = `
        <span class="invoice-total-label">Total spent</span>
        <span class="invoice-total-amount">€${total.toFixed(2)}</span>
    `
    list.appendChild(totalDiv)
    invoices.forEach(inv => {
        const div = document.createElement("div")
        div.className = "trip"
        div.innerHTML = `
            <p class="trip-title">${inv.desc}</p>
            <p class="trip-meta">${inv.date || ""} &nbsp;·&nbsp; ${inv.category || "Other"}</p>
            <span class="tag">€${parseFloat(inv.amount || 0).toFixed(2)}</span>
            ${inv.photo ? `<img src="${inv.photo}" alt="Receipt">` : ""}
            <div class="trip-actions">
                <button class="btn-secondary" onclick="editInvoice('${inv.id}')">Edit</button>
                <button class="btn-secondary" onclick="deleteInvoice('${inv.id}')">Delete</button>
            </div>
        `
        list.appendChild(div)
    })
}

function editInvoice(id) {
    const invoices = JSON.parse(localStorage.getItem("invoices") || "[]")
    const inv = invoices.find(x => String(x.id) === String(id))
    if (!inv) return
    editingInvoiceId = id
    document.getElementById("invoiceDesc").value = inv.desc || ""
    document.getElementById("invoiceAmount").value = inv.amount || ""
    document.getElementById("invoiceCategory").value = inv.category || "Other"
    document.getElementById("invoiceDate").value = inv.date || ""
    document.getElementById("saveInvoiceBtn").textContent = "Update expense"
    document.getElementById("cancelInvoiceBtn").style.display = "inline-flex"
    window.scrollTo({ top: 0, behavior: "smooth" })
}

async function deleteInvoice(id) {
    if (!confirm("Delete this expense?")) return
    const invoices = JSON.parse(localStorage.getItem("invoices") || "[]")
    localStorage.setItem("invoices", JSON.stringify(invoices.filter(i => String(i.id) !== String(id))))
    renderInvoices()
    showToast("Expense deleted")
    try {
        await postData({ action: "deleteInvoice", id })
    } catch (err) {
        console.warn("Server delete failed", err)
    }
}


// ========================================
// ===== INIT =====
// ========================================
window.addEventListener("DOMContentLoaded", () => {
    // Set active nav for initial page
    document.getElementById("navLog")?.classList.add("active")

    setDefaultLogValues()

    loadTripsFromServer()
    loadNotesFromServer()
    loadInvoicesFromServer()
    initWarningsMap()
})



// ========================================
// ===== WARNINGS =====
// ========================================

const ARCGIS_BASE = "https://gis.transpordiamet.ee/arcgis/rest/services/navigatsioonihoiatused/nav_hoiatused_avalik/MapServer"

const AREA_LABELS = {
    soo: "Soome laht",
    vai: "Väinameri",
    lii: "Liivi laht",
    laa: "Läänemeri",
    sis: "Siseveed",
    ran: "Eesti rannikumeri"
}

const OUTPUT_LABELS = {
    0: "Koduleht",
    1: "Koduleht / Tallinn raadio",
    2: "Koduleht / Tallinn raadio / NAVTEX"
}

function initWarningsMap() {
    loadWarnings()
    setInterval(loadWarnings, 5 * 60 * 1000)
}

async function loadWarnings() {
    const list    = document.getElementById("warningsList")
    const countEl = document.getElementById("warningsCount")
    if (!list) return

    list.innerHTML = `<p class="empty">Laen…</p>`

    try {
        const res = await fetch(
            `${ARCGIS_BASE}/4/query?where=status%3D2&outFields=*&f=json`
        )
        if (!res.ok) throw new Error("HTTP " + res.status)
        const data = await res.json()
        if (data.error) throw new Error(data.error.message)

        renderWarnings(data.features || [])

    } catch (err) {
        console.error("Hoiatuste laadimine ebaõnnestus:", err)
        list.innerHTML = `<p class="empty">Hoiatuste laadimine ebaõnnestus.<br><small>${err.message}</small></p>`
        if (countEl) countEl.textContent = ""
    }
}

function renderWarnings(warnings) {
    const list    = document.getElementById("warningsList")
    const countEl = document.getElementById("warningsCount")

    if (countEl) countEl.textContent = warnings.length
        ? `${warnings.length} kehtivat hoiatust`
        : ""

    if (!warnings.length) {
        list.innerHTML = `<p class="empty">Kehtivaid hoiatusi ei ole</p>`
        return
    }

    list.innerHTML = ""

    warnings.sort((a, b) => (b.attributes.warning_number || 0) - (a.attributes.warning_number || 0))

    warnings.forEach((w, idx) => {
        const a = w.attributes

        const number   = a.warning_number || ""
        const title    = a.ntfct_title_est || "Hoiatus " + (number || idx + 1)
        const text     = a.ntfct_text_est  || a.comments || ""
        const area     = AREA_LABELS[a.area_est] || ""
        const output   = OUTPUT_LABELS[a.warning_output] ?? ""
        const docUrl   = a.document_url || ""
        const charts   = a.charts || ""
        const dateFrom = a.date_from ? new Date(a.date_from) : null
        const dateTo   = a.date_to   ? new Date(a.date_to)   : null
        const dateFrom_str = dateFrom ? dateFrom.toLocaleDateString("et-EE", { day: "numeric", month: "short", year: "numeric" }) : ""
        const dateRange    = formatDateRange(dateFrom, dateTo)
        const id           = String(a.globalid || idx).replace(/[{}]/g, "")

        const card = document.createElement("div")
        card.className = "trip warning-card"
        card.id = "warning-" + id
        card.style.cursor = "pointer"
        card.onclick = () => toggleWarning(id)

        card.innerHTML = `
            <p class="trip-title">${number ? `#${number} — ` : ""}${title}</p>
            <p class="trip-meta">${dateFrom_str ? "Alates " + dateFrom_str : "—"}</p>
            <div class="warning-body">
                ${text ? `<p class="warning-desc">${text}</p>` : ""}
                <div class="warning-detail-row">
                    <span class="detail-key">Kehtib</span>
                    <span class="detail-val">${dateRange || "—"}</span>
                </div>
                ${area ? `<div class="warning-detail-row">
                    <span class="detail-key">Piirkond</span>
                    <span class="detail-val">${area}</span>
                </div>` : ""}
                ${output ? `<div class="warning-detail-row">
                    <span class="detail-key">Väljund</span>
                    <span class="detail-val">${output}</span>
                </div>` : ""}
                ${charts ? `<div class="warning-detail-row">
                    <span class="detail-key">Kaardid</span>
                    <span class="detail-val">${charts}</span>
                </div>` : ""}
                ${docUrl ? `<div class="warning-actions">
                    <a href="${docUrl}" target="_blank" class="btn-secondary" onclick="event.stopPropagation()" style="text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;border-radius:50px;font-size:12px;font-weight:700;border:1.5px solid var(--border);color:var(--text);margin-top:12px;">Dokument ↗</a>
                </div>` : ""}
            </div>
        `

        list.appendChild(card)
    })
}

function toggleWarning(id) {
    const card = document.getElementById("warning-" + id)
    if (!card) return
    const isOpen = card.classList.contains("open")
    document.querySelectorAll(".warning-card.open").forEach(c => c.classList.remove("open"))
    if (!isOpen) card.classList.add("open")
}

function formatDateRange(from, to) {
    const fmt = d => {
        if (!d) return ""
        return d.toLocaleDateString("et-EE", { day: "numeric", month: "short", year: "numeric" })
    }
    const f = fmt(from), t = fmt(to)
    if (f && t) return f + " – " + t
    if (f)      return "Alates " + f
    if (t)      return "Kuni " + t
    return ""
}
