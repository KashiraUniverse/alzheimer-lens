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

$("#scanBtn").onclick = () => {
  const scanner = $("#scanner"), result = $("#recognitionResult"), btn = $("#scanBtn");
  scanner.classList.add("scanning");
  btn.disabled = true;
  btn.textContent = "SCANNING…";
  result.classList.add("hidden");

  setTimeout(() => {
    scanner.classList.remove("scanning");
    btn.disabled = false;
    btn.textContent = "SCAN AGAIN";

    const p = people[0] || {name:"Maria", relationship:"Caregiver"};
    result.innerHTML = `
      <span class="pill green">✓ PERSON DETECTED</span>
      <h2>${escapeHtml(p.name)}</h2>
      <p class="muted">${escapeHtml(p.relationship)}</p>
      <div class="confidence">94% confidence</div>
      <p class="muted">Just now · ${currentLocation ? currentLocation.lat.toFixed(4)+", "+currentLocation.lng.toFixed(4) : "Demo location"}</p>
      <button id="saveMemory" class="big-btn">SAVE TO MEMORIES</button>
    `;
    result.classList.remove("hidden");

    $("#saveMemory").onclick = () => {
      memories.unshift({
        type:"People",
        title:`${p.name} detected`,
        desc:p.relationship,
        time:new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}),
        location:currentLocation ? "Current location" : "Demo location"
      });
      save();
      renderMemories();
      toast("Recognition saved to Memories");
    };
  }, 1800);
};

function getGPS() {
  if (!navigator.geolocation) {
    setDemoGPS();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      currentLocation = {lat:pos.coords.latitude, lng:pos.coords.longitude};
      updateGPSUI();
      toast("GPS location updated");
    },
    () => {
      setDemoGPS();
      toast("GPS unavailable — using Demo Location");
    },
    {enableHighAccuracy:true, timeout:8000}
  );
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

$("#sosBtn").onclick = () => {
  if (!confirm("Activate Emergency SOS? Demo Mode will not send a real SMS or call.")) return;

  const finish = () => {
    const c = currentLocation
      ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
      : "Demo location";
    toast("SOS alert simulated successfully");
    alert(`SOS ACTIVATED\n\nPrimary contact: Maria\nLocation: ${c}\n\nDemo Mode: no real SMS or call was sent.`);
  };

  if (currentLocation) finish();
  else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => {
        currentLocation = {lat:p.coords.latitude, lng:p.coords.longitude};
        updateGPSUI();
        finish();
      },
      () => { setDemoGPS(); finish(); },
      {timeout:5000}
    );
  } else {
    setDemoGPS();
    finish();
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

if (new URLSearchParams(window.location.search).get("connect") === "true") {
  startDeviceSession();
}
