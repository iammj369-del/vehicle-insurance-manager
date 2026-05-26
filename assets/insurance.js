import {
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
const form = document.querySelector("#searchForm");
const resultPanel = document.querySelector("#resultPanel");
const logoutBtn = document.querySelector("#logoutBtn");
let activeRecord = null;

showSetupNotice(setupNotice);
logoutBtn.addEventListener("click", logout);
const session = await requireSession();
await loadAdminAvatar(session);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  resultPanel.classList.remove("hidden");
  resultPanel.innerHTML = "<div class='panel'>Searching...</div>";

  if (!supabase) {
    resultPanel.innerHTML = "<div class='panel empty-state'>Supabase setup is required before searching live records.</div>";
    return;
  }

  const vehicleType = document.querySelector("#vehicleType").value;
  const regNo = normalizeRegNo(document.querySelector("#regNo").value);

  let query = supabase
    .from("vehicle_insurances")
    .select("*")
    .eq("vehicle_reg_no", regNo)
    .order("payment_due_date", { ascending: true });

  if (vehicleType) {
    query = query.eq("vehicle_type", vehicleType);
  }

  const { data, error } = await query;

  if (error) {
    resultPanel.innerHTML = `<div class="panel error-state">${error.message}</div>`;
    return;
  }

  if (!data || !data.length) {
    resultPanel.innerHTML = "<div class='panel empty-state'>No insurance record found for this vehicle.</div>";
    return;
  }

  if (data.length > 1) {
    renderResultList(data);
    return;
  }

  renderResult(data[0]);
});

resultPanel.addEventListener("submit", async (event) => {
  if (!event.target.matches("#updatePaymentForm")) return;
  event.preventDefault();

  const message = document.querySelector("#updateMessage");
  message.textContent = "";

  try {
    const billFile = document.querySelector("#updateBillPdf").files[0];
    const proofFiles = [...document.querySelector("#updateVehicleProofs").files];

    if (billFile && billFile.size > 10 * 1024 * 1024) {
      message.textContent = "Bill PDF must be 10MB or smaller.";
      return;
    }

    if (proofFiles.some((file) => !["image/jpeg", "image/jpg"].includes(file.type))) {
      message.textContent = "Vehicle proofs must be JPEG files.";
      return;
    }

    const billPdfUrl = billFile
      ? await uploadFile("insurance-bills", `${activeRecord.vehicle_reg_no}/${Date.now()}-${billFile.name}`, billFile)
      : activeRecord.bill_pdf_url;

    const vehicleProofUrls = Array.isArray(activeRecord.vehicle_proof_urls) ? [...activeRecord.vehicle_proof_urls] : [];
    for (const file of proofFiles) {
      const url = await uploadFile("vehicle-proofs", `${activeRecord.vehicle_reg_no}/${Date.now()}-${file.name}`, file);
      vehicleProofUrls.push(url);
    }

    const payload = {
      payment_status: document.querySelector("#updatePaymentStatus").value,
      paid_date: document.querySelector("#updatePaidDate").value || null,
      bill_pdf_url: billPdfUrl,
      vehicle_proof_urls: vehicleProofUrls,
    };

    const { data, error } = await supabase
      .from("vehicle_insurances")
      .update(payload)
      .eq("id", activeRecord.id)
      .select("*")
      .single();

    if (error) throw error;

    renderResult(data, "Insurance payment and proof files updated.");
  } catch (error) {
    message.textContent = error.message;
  }
});

function renderResult(record, notice = "") {
  activeRecord = record;
  const paidText = record.payment_status === "paid" ? "Paid" : "Pending";
  const paidDate = record.paid_date ? new Date(record.paid_date).toLocaleDateString("en-IN") : "Not paid yet";
  const billLink = record.bill_pdf_url ? `<a href="${record.bill_pdf_url}" target="_blank">View bill PDF</a>` : "Bill not uploaded";
  const proofLinks = Array.isArray(record.vehicle_proof_urls)
    ? record.vehicle_proof_urls.map((url, index) => `<a href="${url}" target="_blank">Proof ${index + 1}</a>`).join("")
    : "No vehicle proofs uploaded";

  resultPanel.innerHTML = `
    <article class="panel detail-card">
      <div class="record-header">
        <div>
          <p class="eyebrow">${record.vehicle_type.replace("_", " ")}</p>
          <h2>${record.vehicle_reg_no}</h2>
        </div>
        <span class="status ${record.payment_status}">${paidText}</span>
      </div>
      <dl class="info-grid">
        <div><dt>Vehicle Owner</dt><dd>${record.owner_name}</dd></div>
        <div><dt>Mobile Number</dt><dd><a class="whatsapp-link" href="${whatsappUrl(record.owner_mobile)}" target="_blank">${record.owner_mobile}${whatsappIcon()}</a></dd></div>
        <div><dt>Claimed Amount</dt><dd>Rs. ${Number(record.claimed_amount || 0).toLocaleString("en-IN")}</dd></div>
        <div><dt>Fee Paid Date</dt><dd>${paidDate}</dd></div>
        <div><dt>Payment Due Date</dt><dd>${new Date(record.payment_due_date).toLocaleDateString("en-IN")}</dd></div>
        <div><dt>Loan Details</dt><dd>${record.loan_details || "No loan details added"}</dd></div>
        <div><dt>Bill PDF</dt><dd>${billLink}</dd></div>
        <div><dt>Vehicle Proof</dt><dd class="link-list">${proofLinks}</dd></div>
      </dl>
      <form id="updatePaymentForm" class="stacked-form compact update-box">
        <h2>Update Payment Proof</h2>
        <div class="form-row">
          <label>Fee Paid Date <input id="updatePaidDate" type="date" value="${record.paid_date || ""}" /></label>
          <label>Payment Status
            <select id="updatePaymentStatus">
              <option value="pending" ${record.payment_status === "pending" ? "selected" : ""}>Pending</option>
              <option value="paid" ${record.payment_status === "paid" ? "selected" : ""}>Paid</option>
            </select>
          </label>
        </div>
        <label class="upload-tile">
          <span>+</span>
          Upload bill PDF, max 10MB
          <input id="updateBillPdf" type="file" accept="application/pdf" />
        </label>
        <label class="upload-tile">
          <span>+</span>
          Upload vehicle proof JPEG
          <input id="updateVehicleProofs" type="file" accept="image/jpeg,image/jpg" multiple />
        </label>
        <button class="button primary" type="submit">Update Record</button>
        <p id="updateMessage" class="form-message">${notice}</p>
      </form>
    </article>
  `;
}

function renderResultList(records) {
  resultPanel.innerHTML = `
    <article class="panel">
      <div class="panel-title">
        <div>
          <p class="eyebrow">Multiple Records Found</p>
          <h2>Select the matching customer</h2>
        </div>
      </div>
      <div class="due-list">
        ${records
          .map(
            (record) => `
              <button class="record-option" type="button" data-id="${record.id}">
                <span>
                  <strong>${record.owner_name}</strong>
                  ${record.vehicle_reg_no} - ${record.vehicle_type.replace("_", " ")}
                </span>
                <span class="status ${record.payment_status}">${record.payment_status}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;

  resultPanel.querySelectorAll(".record-option").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = records.find((record) => record.id === button.dataset.id);
      if (selected) renderResult(selected);
    });
  });
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
