import {
  daysUntil,
  logout,
  loadAdminAvatar,
  normalizeRegNo,
  requireSession,
  showSetupNotice,
  supabase,
  whatsappIcon,
  whatsappUrl,
} from "./supabaseClient.js";

const setupNotice = document.querySelector("#setupNotice");
const logoutBtn = document.querySelector("#logoutBtn");
const table = document.querySelector("#customerTable");
const recordCount = document.querySelector("#recordCount");
const searchInput = document.querySelector("#searchInput");
const vehicleFilter = document.querySelector("#vehicleFilter");
const statusFilter = document.querySelector("#statusFilter");
const refreshBtn = document.querySelector("#refreshBtn");
const dialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const editMessage = document.querySelector("#editMessage");
const closeDialogBtn = document.querySelector("#closeDialogBtn");
const deleteRecordBtn = document.querySelector("#deleteRecordBtn");
const detailDialog = document.querySelector("#detailDialog");
const detailContent = document.querySelector("#detailContent");
const closeDetailDialogBtn = document.querySelector("#closeDetailDialogBtn");

let records = [];
let selectedRecord = null;
let detailRecord = null;

showSetupNotice(setupNotice);
logoutBtn.addEventListener("click", logout);
const session = await requireSession();
await loadAdminAvatar(session);
await loadCustomers();

[searchInput, vehicleFilter, statusFilter].forEach((control) => {
  control.addEventListener("input", renderCustomers);
});
refreshBtn.addEventListener("click", loadCustomers);
closeDialogBtn.addEventListener("click", () => dialog.close());
closeDetailDialogBtn.addEventListener("click", () => detailDialog.close());

detailContent.addEventListener("change", async (event) => {
  const input = event.target.closest("[data-detail-upload]");
  if (!input || !detailRecord) return;

  const message = document.querySelector("#detailUploadMessage");
  const files = [...input.files];
  if (!files.length) return;

  message.textContent = "";

  try {
    await uploadDetailFiles(input.dataset.detailUpload, files);
    input.value = "";
  } catch (error) {
    message.textContent = error.message;
  }
});

detailContent.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-detail-remove]");
  if (!button || !detailRecord) return;

  const message = document.querySelector("#detailUploadMessage");
  message.textContent = "";

  try {
    await removeDetailFile(button.dataset.detailRemove, Number(button.dataset.index));
  } catch (error) {
    message.textContent = error.message;
  }
});

table.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const record = records.find((item) => item.id === button.dataset.id);
  if (!record) return;

  if (button.dataset.action === "edit") openEditor(record);
  if (button.dataset.action === "paid") markPaid(record);
  if (button.dataset.action === "details") openDetails(record);
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  editMessage.textContent = "";

  if (!selectedRecord) return;

  const customerPhotoFile = document.querySelector("#editCustomerPhoto").files[0];
  const billFile = document.querySelector("#editBillPdf").files[0];
  const proofFiles = [...document.querySelector("#editVehicleProofs").files];
  const vehicleRegNo = normalizeRegNo(document.querySelector("#editRegNo").value);

  if (billFile && billFile.size > 10 * 1024 * 1024) {
    editMessage.textContent = "Bill PDF must be 10MB or smaller.";
    return;
  }

  if (customerPhotoFile && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(customerPhotoFile.type)) {
    editMessage.textContent = "Customer photo must be JPG, PNG or WebP.";
    return;
  }

  if (proofFiles.some((file) => !["image/jpeg", "image/jpg"].includes(file.type))) {
    editMessage.textContent = "Vehicle proofs must be JPEG files.";
    return;
  }

  let customerPhotoUrl = selectedRecord.customer_photo_url || null;
  let hasNewCustomerPhoto = false;
  let billPdfUrl = selectedRecord.bill_pdf_url || null;
  const vehicleProofUrls = Array.isArray(selectedRecord.vehicle_proof_urls) ? [...selectedRecord.vehicle_proof_urls] : [];

  try {
    if (customerPhotoFile) {
      customerPhotoUrl = await uploadFile("customer-photos", `${vehicleRegNo}/${Date.now()}-${customerPhotoFile.name}`, customerPhotoFile);
      hasNewCustomerPhoto = true;
    }

    if (billFile) {
      billPdfUrl = await uploadFile("insurance-bills", `${vehicleRegNo}/${Date.now()}-${billFile.name}`, billFile);
    }

    for (const file of proofFiles) {
      const url = await uploadFile("vehicle-proofs", `${vehicleRegNo}/${Date.now()}-${file.name}`, file);
      vehicleProofUrls.push(url);
    }
  } catch (error) {
    editMessage.textContent = error.message;
    return;
  }

  const payload = {
    owner_name: document.querySelector("#editOwnerName").value.trim(),
    owner_mobile: document.querySelector("#editOwnerMobile").value.trim(),
    vehicle_type: document.querySelector("#editVehicleType").value,
    vehicle_reg_no: vehicleRegNo,
    loan_details: document.querySelector("#editLoanDetails").value.trim(),
    claimed_amount: Number(document.querySelector("#editClaimedAmount").value || 0),
    payment_due_date: document.querySelector("#editDueDate").value,
    paid_date: document.querySelector("#editPaidDate").value || null,
    payment_status: document.querySelector("#editPaymentStatus").value,
    bill_pdf_url: billPdfUrl,
    vehicle_proof_urls: vehicleProofUrls,
  };

  if (hasNewCustomerPhoto || "customer_photo_url" in selectedRecord) {
    payload.customer_photo_url = customerPhotoUrl;
  }

  const { error } = await supabase.from("vehicle_insurances").update(payload).eq("id", selectedRecord.id);

  if (isMissingColumn(error, "customer_photo_url")) {
    delete payload.customer_photo_url;
    const retry = await supabase.from("vehicle_insurances").update(payload).eq("id", selectedRecord.id);
    if (retry.error) {
      editMessage.textContent = retry.error.message;
      return;
    }

    dialog.close();
    await loadCustomers();
    window.alert("Customer saved. To store customer photos permanently, run the latest supabase/schema.sql in Supabase SQL Editor.");
    return;
  }

  if (error) {
    editMessage.textContent = error.message;
    return;
  }

  dialog.close();
  await loadCustomers();
});

deleteRecordBtn.addEventListener("click", async () => {
  if (!selectedRecord) return;
  const confirmed = window.confirm(`Delete ${selectedRecord.vehicle_reg_no} from customer records?`);
  if (!confirmed) return;

  const { error } = await supabase.from("vehicle_insurances").delete().eq("id", selectedRecord.id);

  if (error) {
    editMessage.textContent = error.message;
    return;
  }

  dialog.close();
  await loadCustomers();
});

async function loadCustomers() {
  table.innerHTML = "<div class='empty-state'>Loading customer records...</div>";

  if (!supabase) {
    table.innerHTML = "<div class='empty-state'>Connect Supabase to load customer records.</div>";
    recordCount.textContent = "0 records";
    return;
  }

  const { data, error } = await supabase
    .from("vehicle_insurances")
    .select("*")
    .order("payment_due_date", { ascending: true });

  if (error) {
    table.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
    return;
  }

  records = data || [];
  renderCustomers();
}

function renderCustomers() {
  const query = searchInput.value.trim().toLowerCase();
  const vehicle = vehicleFilter.value;
  const status = statusFilter.value;

  const filtered = records.filter((record) => {
    const searchable = [record.owner_name, record.owner_mobile, record.vehicle_reg_no, record.loan_details]
      .join(" ")
      .toLowerCase();

    return (
      (!query || searchable.includes(query)) &&
      (!vehicle || record.vehicle_type === vehicle) &&
      (!status || record.payment_status === status)
    );
  });

  recordCount.textContent = `${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;

  if (!filtered.length) {
    table.innerHTML = "<div class='empty-state'>No customer records match these filters.</div>";
    return;
  }

  table.innerHTML = `
    <table class="records-table">
      <thead>
        <tr>
          <th>Owner</th>
          <th>Vehicle</th>
          <th>Due Date</th>
          <th>Status</th>
          <th>Amount</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${filtered.map(renderRow).join("")}</tbody>
    </table>
  `;
}

function renderRow(record) {
  const days = daysUntil(record.payment_due_date);
  const dueLabel = days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`;
  const dueClass = days < 0 || days <= 7 ? "urgent-text" : days <= 30 ? "warning-text" : "";
  const paidButton =
    record.payment_status === "paid"
      ? ""
      : `<button class="button small" data-action="paid" data-id="${record.id}" type="button">Mark Paid</button>`;

  return `
    <tr>
      <td>
        <button class="name-button" data-action="details" data-id="${record.id}" type="button">${escapeHtml(record.owner_name)}</button>
        <a class="mobile-link" href="${whatsappUrl(record.owner_mobile)}" target="_blank">${escapeHtml(record.owner_mobile)}${whatsappIcon()}</a>
      </td>
      <td>
        <strong>${escapeHtml(record.vehicle_reg_no)}</strong>
        <span>${formatVehicle(record.vehicle_type)}</span>
      </td>
      <td>
        <strong class="${dueClass}">${dueLabel}</strong>
        <span>${formatDate(record.payment_due_date)}</span>
      </td>
      <td><span class="status ${record.payment_status}">${record.payment_status}</span></td>
      <td>Rs. ${Number(record.claimed_amount || 0).toLocaleString("en-IN")}</td>
      <td class="row-actions">
        ${paidButton}
        <button class="button secondary small" data-action="edit" data-id="${record.id}" type="button">Edit</button>
      </td>
    </tr>
  `;
}

function openEditor(record) {
  selectedRecord = record;
  editMessage.textContent = "";

  document.querySelector("#editId").value = record.id;
  document.querySelector("#editOwnerName").value = record.owner_name || "";
  document.querySelector("#editOwnerMobile").value = record.owner_mobile || "";
  document.querySelector("#editVehicleType").value = record.vehicle_type || "car";
  document.querySelector("#editRegNo").value = record.vehicle_reg_no || "";
  document.querySelector("#editLoanDetails").value = record.loan_details || "";
  document.querySelector("#editClaimedAmount").value = record.claimed_amount || 0;
  document.querySelector("#editDueDate").value = record.payment_due_date || "";
  document.querySelector("#editPaidDate").value = record.paid_date || "";
  document.querySelector("#editPaymentStatus").value = record.payment_status || "pending";
  document.querySelector("#editCustomerPhoto").value = "";
  document.querySelector("#editBillPdf").value = "";
  document.querySelector("#editVehicleProofs").value = "";

  dialog.showModal();
}

function openDetails(record) {
  detailRecord = record;
  const billLink = record.bill_pdf_url
    ? `<a class="button secondary small" href="${escapeAttribute(record.bill_pdf_url)}" target="_blank">View Bill PDF</a>`
    : `<span class="missing-file">Bill not uploaded</span>`;
  const billRemoveButton = record.bill_pdf_url
    ? `<button class="inline-remove-button" data-detail-remove="bill-pdf" type="button" title="Remove bill PDF">Remove</button>`
    : "";
  const proofUrls = Array.isArray(record.vehicle_proof_urls) ? record.vehicle_proof_urls : [];
  const proofGallery = proofUrls.length
    ? proofUrls
        .map(
          (url, index) => `
            <div class="proof-thumb-wrap">
              <a class="proof-thumb" href="${escapeAttribute(url)}" target="_blank">
                <img src="${escapeAttribute(url)}" alt="Vehicle proof ${index + 1}" />
                <span>Proof ${index + 1}</span>
              </a>
              <button class="proof-remove-button" data-detail-remove="vehicle-proof" data-index="${index}" type="button" title="Remove proof ${index + 1}">X</button>
            </div>
          `,
        )
        .join("")
    : `<span class="missing-file">No vehicle proof photos uploaded</span>`;
  const customerPhoto = record.customer_photo_url
    ? `<img class="customer-photo" src="${escapeAttribute(record.customer_photo_url)}" alt="${escapeAttribute(record.owner_name)}" />`
    : `<div class="customer-photo placeholder">No Photo</div>`;

  detailContent.innerHTML = `
    <div class="customer-detail-head">
      <div class="photo-upload-wrap">
        ${customerPhoto}
        <label class="inline-upload-button" title="Add customer photo">
          +
          <input data-detail-upload="customer-photo" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" />
        </label>
        ${
          record.customer_photo_url
            ? `<button class="photo-remove-button" data-detail-remove="customer-photo" type="button" title="Remove customer photo">X</button>`
            : ""
        }
      </div>
      <div>
        <p class="eyebrow">${formatVehicle(record.vehicle_type)}</p>
        <h2>${escapeHtml(record.owner_name)}</h2>
        <a class="whatsapp-link" href="${whatsappUrl(record.owner_mobile)}" target="_blank">${escapeHtml(record.owner_mobile)}${whatsappIcon()}</a>
      </div>
      <span class="status ${record.payment_status}">${record.payment_status}</span>
    </div>
    <dl class="info-grid">
      <div><dt>Vehicle Reg No</dt><dd>${escapeHtml(record.vehicle_reg_no)}</dd></div>
      <div><dt>Claimed Amount</dt><dd>Rs. ${Number(record.claimed_amount || 0).toLocaleString("en-IN")}</dd></div>
      <div><dt>Payment Due Date</dt><dd>${formatDate(record.payment_due_date)}</dd></div>
      <div><dt>Fee Paid Date</dt><dd>${formatDate(record.paid_date)}</dd></div>
      <div><dt>Loan Details</dt><dd>${escapeHtml(record.loan_details || "No loan details added")}</dd></div>
      <div>
        <dt>Bill PDF</dt>
        <dd class="detail-file-row">
          ${billLink}
          <label class="inline-upload-button" title="Add bill PDF">
            +
            <input data-detail-upload="bill-pdf" type="file" accept="application/pdf" />
          </label>
          ${billRemoveButton}
        </dd>
      </div>
    </dl>
    <section class="proof-section">
      <div class="section-title-row">
        <h2>Vehicle Proof Photos</h2>
        <label class="inline-upload-button" title="Add vehicle proof photos">
          +
          <input data-detail-upload="vehicle-proofs" type="file" accept="image/jpeg,image/jpg" multiple />
        </label>
      </div>
      <div class="proof-gallery">${proofGallery}</div>
    </section>
    <p id="detailUploadMessage" class="form-message"></p>
  `;

  if (!detailDialog.open) {
    detailDialog.showModal();
  }
}

async function uploadDetailFiles(kind, files) {
  if (!detailRecord) return;

  const vehicleRegNo = normalizeRegNo(detailRecord.vehicle_reg_no);
  const payload = {};

  if (kind === "customer-photo") {
    const [file] = files;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Customer photo must be JPG, PNG or WebP.");
    }
    payload.customer_photo_url = await uploadFile("customer-photos", `${vehicleRegNo}/${Date.now()}-${file.name}`, file);
  }

  if (kind === "bill-pdf") {
    const [file] = files;
    if (file.type !== "application/pdf") {
      throw new Error("Bill must be a PDF file.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Bill PDF must be 10MB or smaller.");
    }
    payload.bill_pdf_url = await uploadFile("insurance-bills", `${vehicleRegNo}/${Date.now()}-${file.name}`, file);
  }

  if (kind === "vehicle-proofs") {
    if (files.some((file) => !["image/jpeg", "image/jpg"].includes(file.type))) {
      throw new Error("Vehicle proofs must be JPEG files.");
    }

    const vehicleProofUrls = Array.isArray(detailRecord.vehicle_proof_urls) ? [...detailRecord.vehicle_proof_urls] : [];
    for (const file of files) {
      const url = await uploadFile("vehicle-proofs", `${vehicleRegNo}/${Date.now()}-${file.name}`, file);
      vehicleProofUrls.push(url);
    }
    payload.vehicle_proof_urls = vehicleProofUrls;
  }

  const { data, error } = await supabase
    .from("vehicle_insurances")
    .update(payload)
    .eq("id", detailRecord.id)
    .select("*")
    .single();

  if (isMissingColumn(error, "customer_photo_url")) {
    throw new Error("Customer photo column is missing. Run the latest supabase/schema.sql in Supabase SQL Editor, then upload the photo again.");
  }

  if (error) throw error;

  records = records.map((record) => (record.id === data.id ? data : record));
  renderCustomers();
  openDetails(data);
  document.querySelector("#detailUploadMessage").textContent = "File uploaded successfully.";
}

async function removeDetailFile(kind, index) {
  if (!detailRecord) return;

  const payload = {};

  if (kind === "customer-photo") {
    payload.customer_photo_url = null;
  }

  if (kind === "bill-pdf") {
    payload.bill_pdf_url = null;
  }

  if (kind === "vehicle-proof") {
    const vehicleProofUrls = Array.isArray(detailRecord.vehicle_proof_urls) ? [...detailRecord.vehicle_proof_urls] : [];
    if (!Number.isInteger(index) || index < 0 || index >= vehicleProofUrls.length) {
      throw new Error("Vehicle proof photo was not found.");
    }
    vehicleProofUrls.splice(index, 1);
    payload.vehicle_proof_urls = vehicleProofUrls;
  }

  const { data, error } = await supabase
    .from("vehicle_insurances")
    .update(payload)
    .eq("id", detailRecord.id)
    .select("*")
    .single();

  if (isMissingColumn(error, "customer_photo_url")) {
    throw new Error("Customer photo column is missing. Run supabase/customer_photo_setup.sql in Supabase SQL Editor, then try again.");
  }

  if (error) throw error;

  records = records.map((record) => (record.id === data.id ? data : record));
  renderCustomers();
  openDetails(data);
  document.querySelector("#detailUploadMessage").textContent = "File removed successfully.";
}

async function markPaid(record) {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("vehicle_insurances")
    .update({ payment_status: "paid", paid_date: record.paid_date || today })
    .eq("id", record.id);

  if (error) {
    table.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
    return;
  }

  await loadCustomers();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "Not set";
}

function formatVehicle(value) {
  return escapeHtml(String(value || "").replace("_", " "));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

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
