const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* Supabase configuration.
   Paste the same Supabase URL + publishable key you used in your previous working copy.
   Never put a secret/service-role key here. */
const SUPABASE_URL = "https://jikiymnrbbxmkltukqfh.supabase.co";
const SUPABASE_KEY = "sb_publishable_aPLOfYb-c9uiaMLdFw6r1Q_2nLcKt5N";
async function startDeviceSession() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/device_command?id=eq.1`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          start_session: true,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      console.error("Gagal memulai device session:", response.status);
      return;
    }

    console.log("✓ Device session started");

  } catch (error) {
    console.error("Device session error:", error);
  }
}
const defaultPeople = [
  {id:"P001", name:"Maria", relationship:"Caregiver", phone:"+62 812-0000-0000", sync:"Synced", photo:"", date:"Today"},
  {id:"P002", name:"John", relationship:"Family", phone:"+62 813-0000-0000", sync:"Synced", photo:"", date:"Yesterday"}
];

const defaultMemories = [
  {type:"People", title:"Maria detected", desc:"Caregiver", time:"10:42 AM", location:"Living room"},
  {type:"Places", title:"Living room recognized", desc:"Familiar place", time:"11:15 AM", location:"Home"},
  {type:"Objects", title:"Medicine detected", desc:"Reminder item", time:"12:03 PM", location:"Kitchen"}
];

let people = JSON.parse(localStorage.getItem("alzheimerPeople") || "null") || defaultPeople;
let memories = JSON.parse(localStorage.getItem("alzheimerMemories") || "null") || defaultMemories;
let currentLocation = null;

function save() {
  localStorage.setItem("alzheimerPeople", JSON.stringify(people));
  localStorage.setItem("alzheimerMemories", JSON.stringify(memories));
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function showPage(id) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === id));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === id));
  window.scrollTo({top:0, behavior:"smooth"});
}

$$("[data-page]").forEach(el => el.addEventListener("click", () => showPage(el.dataset.page)));

async function uploadPhotoToSupabase(file) {
  if (!file || !SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) return null;

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/people-photos/${fileName}`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Content-Type": file.type
        },
        body: file
      }
    );

    if (!response.ok) {
      console.error("Photo upload error:", await response.text());
      return null;
    }

    return fileName;
  } catch (error) {
    console.error("Photo upload error:", error);
    return null;
  }
}

async function getPhotoUrl(path) {
  if (!path || !SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) return null;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/people-photos/${encodeURIComponent(path)}`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ expiresIn: 3600 })
      }
    );

    if (!response.ok) {
      console.error("Gagal membuat signed URL");
      return null;
    }

    const data = await response.json();

    return data.signedURL.startsWith("http")
      ? data.signedURL
      : SUPABASE_URL + "/storage/v1" + data.signedURL;
  } catch (error) {
    console.error("Signed URL error:", error);
    return null;
  }
}

async function renderPeople() {
  const list = $("#peopleList");

  const peopleWithPhotos = await Promise.all(
    people.map(async p => ({
      ...p,
      photoUrl: await getPhotoUrl(p.photo)
    }))
  );

  list.innerHTML = peopleWithPhotos.map(p => `
    <div class="person">
      ${
        p.photoUrl
          ? `<img class="avatar" src="${p.photoUrl}" alt="${escapeHtml(p.name)}">`
          : `<div class="avatar">${escapeHtml((p.name || "?")[0])}</div>`
      }
      <div class="person-info">
        <b>${escapeHtml(p.name)}</b>
        <small>${escapeHtml(p.relationship)} ${p.phone ? "• " + escapeHtml(p.phone) : ""}</small>
        <span class="sync">✓ ${escapeHtml(p.sync || "Synced")}</span>
      </div>
    </div>
  `).join("");
}

async function savePersonToSupabase(person) {
  if (!SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) return false;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/people`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        name: person.name,
        relation: person.relationship,
        phone: person.phone,
        photo_url: person.photo
      })
    });

    if (!response.ok) {
      console.error("Supabase save error:", await response.text());
      return false;
    }

    console.log("Person saved to Supabase");
    return true;
  } catch (error) {
    console.error("Supabase save error:", error);
    return false;
  }
}

async function loadPeopleFromSupabase() {
  if (!SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) return;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/people?select=*`, {
      headers: { "apikey": SUPABASE_KEY }
    });

    if (!response.ok) {
      console.error("Gagal mengambil data Supabase");
      return;
    }

    const data = await response.json();

    people = data.map(p => ({
  id: "P" + p.id,
  name: p.name,
  relationship: p.relation,
  phone: p.phone || "",
  telegramChatId: p.telegram_chat_id || "",
  photo: p.photo_url || null,
  sync: "Synced"
}));

    save();
    await renderPeople();
    console.log("People from Supabase:", people);
  } catch (error) {
    console.error("Supabase load error:", error);
  }
}

async function loadDeviceStatus() {
  if (!SUPABASE_KEY || SUPABASE_KEY.includes("PASTE_YOUR")) return;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/device_status?id=eq.1&select=*`,
      { headers: { "apikey": SUPABASE_KEY } }
    );

    if (!response.ok) {
      console.error("Gagal mengambil device status");
      return;
    }

    const data = await response.json();
    if (!data.length) return;

    const device = data[0];

    $("#piStatus").textContent = device.pi_online ? "Connected" : "Offline";
    $("#cameraStatus").textContent = device.camera_active ? "Active" : "Inactive";
    $("#batteryStatus").textContent =
      device.battery !== null ? `${device.battery}%` : "--";
    $("#glassesStatus").textContent =
      device.pi_online ? "Connected" : "Waiting for device";
  } catch (error) {
    console.error("Device status error:", error);
  }
}

function renderMemories(filter="All") {
  const list = $("#memoryList");
  const items = filter === "All" ? memories : memories.filter(m => m.type === filter);

  list.innerHTML = items.map(m => `
    <div class="timeline-item">
      <b>${escapeHtml(m.title)}</b>
      <span>${escapeHtml(m.desc)}</span>
      <small>${escapeHtml(m.time)} · ${escapeHtml(m.location || "Unknown location")}</small>
    </div>
  `).join("") || `<div class="feature-card"><span class="muted">No memories in this category yet.</span></div>`;

  $("#homeActivity").innerHTML = memories.slice(0,3).map(m =>
    `<div class="timeline-item"><b>${escapeHtml(m.title)}</b><span>${escapeHtml(m.time)} · ${escapeHtml(m.location || "Unknown location")}</span></div>`
  ).join("");
}

function renderLatest() {
  const p = people[0] || {name:"No person registered", relationship:"Register a familiar person first"};
  $("#latestRecognition").innerHTML =
    `<span class="pill green">● Latest result</span><b>${escapeHtml(p.name)} detected</b><small>${escapeHtml(p.relationship)} · 94% confidence · just now</small>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

$("#addPersonBtn").onclick = () => $("#personForm").classList.remove("hidden");
$("#closePerson").onclick = () => $("#personForm").classList.add("hidden");

$("#personPhoto").onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $("#photoPreview").src = reader.result;
    $("#photoPreview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
};

$("#registerForm").onsubmit = async e => {
  e.preventDefault();

  const photoFile = $("#personPhoto").files[0];
  const photoPath = photoFile ? await uploadPhotoToSupabase(photoFile) : null;

  const data = {
    id: "P" + Date.now().toString().slice(-6),
    name: $("#personName").value,
    relationship: $("#personRelation").value,
    phone: $("#personPhone").value,
    photo: photoPath,
    sync: "Syncing...",
    date: new Date().toLocaleDateString()
  };

  people.unshift(data);
  save();
  await renderPeople();

  const progress = $("#syncProgress");
  progress.classList.remove("hidden");
  progress.textContent = "Registering face...";

  const saved = await savePersonToSupabase(data);

  if (saved) {
    data.sync = "Synced";
    save();
    await renderPeople();
    progress.textContent = "Face registered & saved to database.";
  } else {
    progress.textContent = "Saved locally, but database failed.";
  }

  setTimeout(() => {
    $("#personForm").classList.add("hidden");
    e.target.reset();
    $("#photoPreview").classList.add("hidden");
    progress.classList.add("hidden");
  }, 1200);
};

async function getRecognitionResult() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/device_status?id=eq.1&select=recognized_name,recognized_relation,recognition_confidence,updated_at`,
      {
        headers: {
          "apikey": SUPABASE_KEY
        }
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.length) return null;

    return data[0];
  } catch (error) {
    console.error("Recognition fetch error:", error);
    return null;
  }
}

async function waitForRecognition(maxAttempts = 8, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    const data = await getRecognitionResult();

    if (data && data.recognized_name) {
      return data;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return null;
}

$("#scanBtn").onclick = async () => {
  const scanner = $("#scanner");
  const result = $("#recognitionResult");
  const btn = $("#scanBtn");

  scanner.classList.add("scanning");
  btn.disabled = true;
  btn.textContent = "STARTING CAMERA…";
  result.classList.add("hidden");

  // Kirim command ke Raspberry Pi
  await startDeviceSession();

  btn.textContent = "CONNECTING…";

  await new Promise(resolve => setTimeout(resolve, 1200));

  btn.textContent = "SCANNING…";

  // Tunggu hasil recognition dari Raspberry Pi
  const recognition = await waitForRecognition(8, 1000);

  scanner.classList.remove("scanning");
  btn.disabled = false;
  btn.textContent = "SCAN AGAIN";

  if (recognition && recognition.recognized_name) {

    const confidence =
      recognition.recognition_confidence != null
        ? Math.round(recognition.recognition_confidence * 100)
        : 0;

    result.innerHTML = `
      <span class="pill green">✓ PERSON DETECTED</span>
      <h2>${escapeHtml(recognition.recognized_name)}</h2>
      <p class="muted">
        ${escapeHtml(recognition.recognized_relation || "Familiar person")}
      </p>
      <div class="confidence">${confidence}% confidence</div>
      <p class="muted">
        Just now · ${
          currentLocation
            ? currentLocation.lat.toFixed(4) + ", " + currentLocation.lng.toFixed(4)
            : "Location unavailable"
        }
      </p>
      <button id="saveMemory" class="big-btn">SAVE TO MEMORIES</button>
    `;

    result.classList.remove("hidden");

    $("#saveMemory").onclick = () => {
      memories.unshift({
        type: "People",
        title: `${recognition.recognized_name} detected`,
        desc: recognition.recognized_relation || "Familiar person",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        }),
        location: currentLocation
          ? "Current location"
          : "Location unavailable"
      });

      save();
      renderMemories();
      toast("Recognition saved to Memories");
    };

  } else {

    result.innerHTML = `
      <span class="pill">NO MATCH</span>
      <h2>Person not recognized</h2>
      <p class="muted">
        The person could not be matched with a registered face.
      </p>
    `;

    result.classList.remove("hidden");
  }
};
async function getGPS() {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/gps_status?id=eq.1&select=*`,
      {
        headers: {
          "apikey": SUPABASE_KEY
        }
      }
    );

    if (!response.ok) {
      console.error("Gagal mengambil GPS Raspberry Pi");
      return;
    }

    const data = await response.json();

    if (!data.length || !data[0].valid) {
      console.error("GPS Raspberry Pi belum valid");
      return;
    }

    const gps = data[0];

    currentLocation = {
      lat: Number(gps.lat),
      lng: Number(gps.lng)
    };

    updateGPSUI();

    console.log(
      "✓ GPS Raspberry Pi:",
      currentLocation.lat,
      currentLocation.lng
    );

  } catch (error) {
    console.error("GPS Raspberry Pi error:", error);
  }
}

function setDemoGPS() {
  currentLocation = {lat:-6.2088, lng:106.8456};
  updateGPSUI(true);
}

function updateGPSUI(demo=false) {
  const text = demo ? "Demo Location" : "Current location";
  const c = `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`;
  $("#locationText").textContent = text;
  $("#coords").textContent = c + (demo ? " · Demo coordinates" : " · Browser GPS");
  $("#safetyLocation").textContent = text;
  $("#safetyCoords").textContent = c + (demo ? " · Demo coordinates" : " · Browser GPS");
}

$("#refreshGps").onclick = getGPS;
$("#safetyGpsBtn").onclick = getGPS;

$$(".filter").forEach(b => b.onclick = () => {
  $$(".filter").forEach(x => x.classList.remove("active"));
  b.classList.add("active");
  renderMemories(b.dataset.filter);
});

$("#testConnection").onclick = () => {
  $("#lastSync").textContent = "Syncing…";
  setTimeout(() => {
    $("#lastSync").textContent = "Just now";
    toast("Raspberry Pi connection OK (Demo)");
  }, 900);
};

$("#sosBtn").onclick = async () => {
  if (!confirm("Activate Emergency SOS?")) {
    return;
  }

  // Ambil GPS terbaru dari Raspberry Pi
  await getGPS();

  if (!currentLocation) {
    alert("GPS Raspberry Pi belum tersedia.");
    return;
  }

  // Nelson adalah kontak utama SOS
  const contact = people.find(
    p => p.name === "Nelson" && p.telegramChatId
  );

  if (!contact) {
    alert("Kontak Telegram Nelson belum tersedia.");
    return;
  }

  const lat = currentLocation.lat;
  const lng = currentLocation.lng;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-sos`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY
        },
        body: JSON.stringify({
          chat_id: contact.telegramChatId,
          name: contact.name,
          lat: lat,
          lng: lng
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("SOS Telegram error:", data);
      alert("SOS gagal dikirim ke Telegram.");
      return;
    }

    toast(`SOS sent to ${contact.name}`);

    alert(
      `SOS SENT\n\n` +
      `Recipient: ${contact.name}\n` +
      `Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}\n\n` +
      `Source: Raspberry Pi GPS\n` +
      `Telegram message sent successfully.`
    );

  } catch (error) {
    console.error("SOS request error:", error);
    alert("Gagal terhubung ke SOS server.");
  }
};

$("#editContact").onclick = () => {
  const name = prompt("Emergency contact name:", "Maria");
  if (name) $("#primaryContactName").textContent = name;
  const phone = prompt("Phone number:", "+62 812-0000-0000");
  if (phone) $("#primaryContactInfo").textContent = `Caregiver · ${phone}`;
  toast("Emergency contact updated");
};

renderPeople();
renderMemories();
renderLatest();
loadPeopleFromSupabase();
loadDeviceStatus();
setInterval(loadDeviceStatus, 5000);

loadDeviceStatus();
setInterval(loadDeviceStatus, 5000);

if (new URLSearchParams(window.location.search).get("connect") === "true") {
  startDeviceSession();
}
