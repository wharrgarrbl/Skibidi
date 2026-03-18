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
        const res = await fetch(API_URL + "?action=notes")
        const data = await res.json()
        const notes = Array.isArray(data) ? data : []
        localStorage.setItem("notes", JSON.stringify(notes))
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
        const short = (n.text || "").length > 80 ? n.text.substring(0, 80) + "…" : n.text
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
    showToast("Deleting…")
    try {
        await postData({ action: "deleteNote", id })
        await loadNotesFromServer()
        showToast("Note deleted")
    } catch (err) {
        showToast("Error deleting note")
    }
}


// ========================================
// ===== INVOICES / EXPENSES =====
// ========================================
let editingInvoiceId = null

async function loadInvoicesFromServer() {
    try {
        const res = await fetch(API_URL + "?action=invoices")
        const data = await res.json()
        const invoices = Array.isArray(data) ? data : []
        localStorage.setItem("invoices", JSON.stringify(invoices))
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
    showToast("Deleting…")
    try {
        await postData({ action: "deleteInvoice", id })
        await loadInvoicesFromServer()
        showToast("Expense deleted")
    } catch (err) {
        showToast("Error deleting expense")
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

// Area code → human readable label
const AREA_LABELS = {
    soo: "Gulf of Finland",
    vai: "Väinameri",
    lii: "Gulf of Riga",
    laa: "Northern Baltic Sea",
    sis: "Inland waters",
    ran: "Estonian coastal waters"
}

// Output channel labels
const OUTPUT_LABELS = {
    0: "Website",
    1: "Website / Tallinn Radio",
    2: "Website / Tallinn Radio / NAVTEX"
}

const ESTONIA_CENTER = [59.2, 23.5]
const ESTONIA_ZOOM   = 6

let warningsMap         = null
let warningsMarkerLayer = null
let warningsGeoLayer    = null
// globalid → L.layer for zoom-to
let warningsGeoIndex    = {}

function initWarningsMap() {
    if (warningsMap) return

    warningsMap = L.map("warningsMap", {
        center: ESTONIA_CENTER,
        zoom: ESTONIA_ZOOM,
        zoomControl: false,
        attributionControl: false
    })

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19
    }).addTo(warningsMap)

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19, pane: "shadowPane"
    }).addTo(warningsMap)

    L.control.zoom({ position: "bottomright" }).addTo(warningsMap)

    warningsMarkerLayer = L.layerGroup().addTo(warningsMap)
    warningsGeoLayer    = L.layerGroup().addTo(warningsMap)

    loadWarnings()
    setInterval(loadWarnings, 5 * 60 * 1000)
}

async function loadWarnings() {
    const list    = document.getElementById("warningsList")
    const countEl = document.getElementById("warningsCount")
    if (!list) return

    list.innerHTML = `<p class="empty">Loading…</p>`

    try {
        // 1. Fetch active warning records from the data table (status=2 → "Kehtivad")
        const tableRes = await fetch(
            `${ARCGIS_BASE}/4/query?where=status%3D2&outFields=*&f=json`
        )
        if (!tableRes.ok) throw new Error("Table fetch failed: " + tableRes.status)
        const tableData = await tableRes.json()

        if (tableData.error) throw new Error(tableData.error.message)

        const warnings = tableData.features || []

        // 2. Fetch geometry from all three layers in parallel (points, lines, polygons)
        const [pts, lns, pols] = await Promise.all(
            [0, 1, 2].map(id =>
                fetch(`${ARCGIS_BASE}/${id}/query?where=1%3D1&outFields=warn_globalid&returnGeometry=true&f=geojson`)
                    .then(r => r.json())
                    .catch(() => ({ features: [] }))
            )
        )

        // 3. Build globalid → GeoJSON feature map
        const geoByGlobalId = {}
        for (const fc of [pts, lns, pols]) {
            for (const f of (fc.features || [])) {
                const gid = f.properties?.warn_globalid
                if (gid) geoByGlobalId[gid] = f
            }
        }

        renderWarnings(warnings, geoByGlobalId)

    } catch (err) {
        console.error("Failed to load warnings:", err)
        list.innerHTML = `<p class="empty">Could not load warnings.<br><small>${err.message}</small></p>`
        if (countEl) countEl.textContent = "—"
    }
}

function renderWarnings(warnings, geoByGlobalId) {
    const list    = document.getElementById("warningsList")
    const countEl = document.getElementById("warningsCount")

    if (countEl) countEl.textContent = warnings.length

    warningsMarkerLayer.clearLayers()
    warningsGeoLayer.clearLayers()
    warningsGeoIndex = {}

    if (!warnings.length) {
        list.innerHTML = `<p class="empty">No active warnings</p>`
        return
    }

    list.innerHTML = ""

    // Sort by warning_number descending (newest first)
    warnings.sort((a, b) => (b.attributes.warning_number || 0) - (a.attributes.warning_number || 0))

    warnings.forEach((w, idx) => {
        const a  = w.attributes
        const id = a.globalid || idx

        const title    = a.ntfct_title_eng || a.ntfct_title_est || "Warning " + (a.warning_number || idx + 1)
        const textEng  = a.ntfct_text_eng  || ""
        const textEst  = a.ntfct_text_est  || ""
        const number   = a.warning_number  || ""
        const area     = AREA_LABELS[a.area_eng] || AREA_LABELS[a.area_est] || ""
        const output   = OUTPUT_LABELS[a.warning_output] || ""
        const docUrl   = a.document_url    || ""
        const charts   = a.charts          || ""
        const dateFrom = a.date_from ? new Date(a.date_from) : null
        const dateTo   = a.date_to   ? new Date(a.date_to)   : null
        const dateRange = formatDateRange(dateFrom, dateTo)

        // Place geometry on map
        const geo = geoByGlobalId[id]
        if (geo) {
            try {
                const geomType = geo.geometry?.type || ""

                if (geomType === "Point") {
                    const [lng, lat] = geo.geometry.coordinates
                    const dot = L.divIcon({
                        className: "",
                        html: `<div class="warning-map-dot"></div>`,
                        iconSize: [12, 12], iconAnchor: [6, 6]
                    })
                    const marker = L.marker([lat, lng], { icon: dot })
                    marker.on("click", () => toggleWarning(id))
                    warningsMarkerLayer.addLayer(marker)
                    warningsGeoIndex[id] = marker
                } else {
                    // Line or polygon
                    const layer = L.geoJSON(geo, {
                        style: {
                            color: "#a7ff67",
                            weight: 2,
                            fillColor: "#a7ff67",
                            fillOpacity: 0.15,
                            opacity: 0.8
                        }
                    })
                    layer.on("click", () => toggleWarning(id))
                    warningsGeoLayer.addLayer(layer)
                    warningsGeoIndex[id] = layer
                }
            } catch (e) { console.warn("Geo error:", e) }
        }

        // Build card
        const card = document.createElement("div")
        card.className = "warning-card"
        card.id = "warning-" + id.replace(/[{}]/g, "")

        card.innerHTML = `
            <div class="warning-header" onclick="toggleWarning('${id}')">
                <div class="warning-header-main">
                    ${number ? `<span class="warning-number">#${number}</span>` : ""}
                    <span class="warning-title">${title}</span>
                </div>
                <div class="warning-header-meta">
                    ${area ? `<span class="tag">${area}</span>` : ""}
                    ${dateRange ? `<span class="warning-date">${dateRange}</span>` : ""}
                    <span class="warning-chevron">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </span>
                </div>
            </div>
            <div class="warning-body">
                ${textEng ? `<p class="warning-desc">${textEng}</p>` : ""}
                ${textEst && textEst !== textEng ? `<p class="warning-desc" style="font-size:13px;opacity:0.7">${textEst}</p>` : ""}
                <div class="warning-detail-row">
                    <span class="detail-key">Valid</span>
                    <span class="detail-val">${dateRange || "—"}</span>
                </div>
                ${area ? `<div class="warning-detail-row">
                    <span class="detail-key">Area</span>
                    <span class="detail-val">${area}</span>
                </div>` : ""}
                ${output ? `<div class="warning-detail-row">
                    <span class="detail-key">Channel</span>
                    <span class="detail-val">${output}</span>
                </div>` : ""}
                ${charts ? `<div class="warning-detail-row">
                    <span class="detail-key">Charts</span>
                    <span class="detail-val">${charts}</span>
                </div>` : ""}
                <div class="warning-actions">
                    ${geo ? `<button class="btn-secondary" onclick="zoomToWarning('${id}')">Show on map ↑</button>` : ""}
                    ${docUrl ? `<a href="${docUrl}" target="_blank" class="btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;border-radius:50px;font-size:12px;font-weight:700;border:1.5px solid var(--border);color:var(--text);margin-top:12px;">Document ↗</a>` : ""}
                </div>
            </div>
        `

        list.appendChild(card)
    })
}

function toggleWarning(rawId) {
    const id   = String(rawId).replace(/[{}]/g, "")
    const card = document.getElementById("warning-" + id)
    if (!card) return

    const isOpen = card.classList.contains("open")
    document.querySelectorAll(".warning-card.open").forEach(c => c.classList.remove("open"))
    if (!isOpen) card.classList.add("open")
}

function zoomToWarning(rawId) {
    const layer = warningsGeoIndex[rawId]
    if (!layer) return

    try {
        if (layer.getLatLng) {
            warningsMap.setView(layer.getLatLng(), 11, { animate: true })
        } else {
            warningsMap.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [40, 40], animate: true })
        }
    } catch (e) {}

    document.getElementById("warningsMapWrap").scrollIntoView({ behavior: "smooth" })
}

function formatDateRange(from, to) {
    const fmt = d => {
        if (!d) return ""
        return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    }
    const f = fmt(from), t = fmt(to)
    if (f && t) return f + " – " + t
    if (f)      return "From " + f
    if (t)      return "Until " + t
    return ""
}
