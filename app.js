const API_URL = "https://script.google.com/macros/s/AKfycbzi4YazrywLy7VUsL-fuoaUCr8xq-hrBp33HjHsExZfJwqkXdh5VQeNGJrPElp6cG-rOg/exec"

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
    noteDetail: "navNotes"
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
            <strong>${t.date}</strong> &nbsp;<span class="muted">${t.departure || ""}${t.arrival ? " – " + t.arrival : ""}</span><br>
            ${t.captain} · ${t.route || "—"}<br>
            <span class="tag">${t.miles || 0} mi</span>
            <span class="tag">${t.fuel || 0} L</span>
            ${t.photo ? '<span class="tag">📷</span>' : ""}
            <div class="trip-actions">
                <button onclick="viewTrip('${t.id}')">View</button>
                <button onclick="editTrip('${t.id}')">Edit</button>
                <button onclick="deleteTrip('${t.id}')">Delete</button>
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
        <p><strong>Date:</strong> ${t.date}</p>
        <p><strong>Departure:</strong> ${t.departure} &nbsp; <strong>Arrival:</strong> ${t.arrival}</p>
        <p><strong>Captain:</strong> ${t.captain}</p>
        <p><strong>Participants:</strong> ${t.participants || "—"}</p>
        <p><strong>Route:</strong> ${t.route || "—"}</p>
        <p><strong>Miles:</strong> ${t.miles} &nbsp; <strong>Fuel:</strong> ${t.fuel} L</p>
        <p><strong>Engine hours:</strong> ${t.engineStart} → ${t.engineEnd}</p>
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
            <strong>${n.date}</strong><br>
            <span class="muted">${short}</span><br>
            ${n.photo ? '<span class="tag">📷</span>' : ""}
            ${(n.lat && n.lng) ? '<span class="tag">📍</span>' : ""}
            <div class="trip-actions">
                <button onclick="viewNote('${n.id}')">View</button>
                <button onclick="editNote('${n.id}')">Edit</button>
                <button onclick="deleteNote('${n.id}')">Delete</button>
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
    totalDiv.innerHTML = `Total: <strong>€${total.toFixed(2)}</strong> &nbsp;<span class="muted">(${invoices.length} expense${invoices.length !== 1 ? "s" : ""})</span>`
    list.appendChild(totalDiv)
    invoices.forEach(inv => {
        const div = document.createElement("div")
        div.className = "trip"
        div.innerHTML = `
            <strong>${inv.desc}</strong> &nbsp; <strong>€${parseFloat(inv.amount || 0).toFixed(2)}</strong><br>
            <span class="tag">${inv.category || "Other"}</span>
            <span class="muted">${inv.date || ""}</span><br>
            ${inv.photo ? `<img src="${inv.photo}" alt="Receipt">` : ""}
            <div class="trip-actions">
                <button onclick="editInvoice('${inv.id}')">Edit</button>
                <button onclick="deleteInvoice('${inv.id}')">Delete</button>
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
})

