import {
  daysUntil,
  logout,
  loadAdminAvatar,
  normalizeRegNo,
  requireSession,
  showSetupNotice,
  supabase,
} from "./supabaseClient.js";

const setupNotice = document.querySelector("#setupNotice");
const logoutBtn = document.querySelector("#logoutBtn");
const form = document.querySelector("#customerForm");
const formMessage = document.querySelector("#formMessage");
const dueList = document.querySelector("#dueList");

showSetupNotice(setupNotice);
logoutBtn.addEventListener("click", logout);
const session = await requireSession();
await loadAdminAvatar(session);
await loadDashboard();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  if (!supabase || !session) {
    formMessage.textContent = "Supabase setup is required before saving records.";
    return;
  }

  const billFile = document.querySelector("#billPdf").files[0];
  const customerPhotoFile = document.querySelector("#customerPhoto").files[0];
  const proofFiles = [...document.querySelector("#vehicleProofs").files];

  if (billFile && billFile.size > 10 * 1024 * 1024) {
    formMessage.textContent = "Bill PDF must be 10MB or smaller.";
    return;
  }

  if (proofFiles.some((file) => !["image/jpeg", "image/jpg"].includes(file.type))) {
    formMessage.textContent = "Vehicle proofs must be JPEG files.";
    return;
  }

  if (customerPhotoFile && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(customerPhotoFile.type)) {
    formMessage.textContent = "Customer photo must be JPG, PNG or WebP.";
    return;
  }

  try {
    const vehicleRegNo = normalizeRegNo(document.querySelector("#regNo").value);
    let customerPhotoUrl = customerPhotoFile
      ? await uploadFile("customer-photos", `${vehicleRegNo}/${Date.now()}-${customerPhotoFile.name}`, customerPhotoFile)
      : null;
    const billPdfUrl = billFile ? await uploadFile("insurance-bills", `${vehicleRegNo}/${Date.now()}-${billFile.name}`, billFile) : null;
    const vehicleProofUrls = [];

    for (const file of proofFiles) {
      const url = await uploadFile("vehicle-proofs", `${vehicleRegNo}/${Date.now()}-${file.name}`, file);
      vehicleProofUrls.push(url);
    }

    const payload = {
      manager_id: session.user.id,
      owner_name: document.querySelector("#ownerName").value.trim(),
      owner_mobile: document.querySelector("#ownerMobile").value.trim(),
      vehicle_type: document.querySelector("#vehicleType").value,
      vehicle_reg_no: vehicleRegNo,
      loan_details: document.querySelector("#loanDetails").value.trim(),
      claimed_amount: Number(document.querySelector("#claimedAmount").value || 0),
      payment_due_date: document.querySelector("#dueDate").value,
      paid_date: document.querySelector("#paidDate").value || null,
      payment_status: document.querySelector("#paymentStatus").value,
      bill_pdf_url: billPdfUrl,
      vehicle_proof_urls: vehicleProofUrls,
    };

    if (customerPhotoUrl) {
      payload.customer_photo_url = customerPhotoUrl;
    }

    const { error } = await supabase.from("vehicle_insurances").upsert(payload, {
      onConflict: "vehicle_type,vehicle_reg_no",
    });

    if (isMissingColumn(error, "customer_photo_url")) {
      delete payload.customer_photo_url;
      customerPhotoUrl = null;
      const retry = await supabase.from("vehicle_insurances").upsert(payload, {
        onConflict: "vehicle_type,vehicle_reg_no",
      });
      if (retry.error) throw retry.error;

      form.reset();
      formMessage.textContent = "Customer record saved. To store customer photos, run the latest supabase/schema.sql in Supabase SQL Editor.";
      await loadDashboard();
      return;
    }

    if (error) throw error;

    form.reset();
    formMessage.textContent = "Customer insurance record saved.";
    await loadDashboard();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    throw new Error(
      isRlsError(error)
        ? `Storage permission is blocked for ${bucket}. Run the storage policies from supabase/schema.sql in Supabase SQL Editor.`
        : isMissingBucket(error)
          ? `Storage bucket missing: ${bucket}. Run the bucket setup SQL from supabase/schema.sql in Supabase SQL Editor.`
        : error.message,
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function isMissingColumn(error, columnName) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.code === "42703" ||
        String(error.message || "").includes(columnName) ||
        String(error.message || "").includes("schema cache")),
  );
}

function isRlsError(error) {
  return Boolean(
    error &&
      (error.code === "42501" ||
        String(error.message || "").toLowerCase().includes("row-level security") ||
        String(error.message || "").toLowerCase().includes("violates row-level security policy")),
  );
}

function isMissingBucket(error) {
  return Boolean(error && String(error.message || "").toLowerCase().includes("bucket not found"));
}

async function loadDashboard() {
  if (!supabase) {
    dueList.innerHTML = "<div class='empty-state'>Connect Supabase to load ending-date notifications.</div>";
    return;
  }

  const { data, error } = await supabase
    .from("vehicle_insurances")
    .select("*")
    .order("payment_due_date", { ascending: true });

  if (error) {
    dueList.innerHTML = `<div class="error-state">${error.message}</div>`;
    return;
  }

  const records = data || [];
  const pending = records.filter((record) => record.payment_status !== "paid");
  const dueWeek = pending.filter((record) => daysUntil(record.payment_due_date) <= 7);
  const dueMonth = pending.filter((record) => daysUntil(record.payment_due_date) <= 30);

  document.querySelector("#dueWeekCount").textContent = dueWeek.length;
  document.querySelector("#dueMonthCount").textContent = dueMonth.length;
  document.querySelector("#activeCount").textContent = records.length;

  if (!pending.length) {
    dueList.innerHTML = "<div class='empty-state'>No pending insurance payment endings.</div>";
    return;
  }

  dueList.innerHTML = pending
    .map((record) => {
      const days = daysUntil(record.payment_due_date);
      const label = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`;
      return `
        <article class="due-item">
          <div>
            <strong>${record.owner_name}</strong>
            <span>${record.vehicle_reg_no} - ${record.vehicle_type.replace("_", " ")}</span>
          </div>
          <div>
            <strong>${label}</strong>
            <span>${new Date(record.payment_due_date).toLocaleDateString("en-IN")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}
