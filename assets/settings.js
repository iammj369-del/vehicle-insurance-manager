import {
  logout,
  loadAdminAvatar,
  requireSession,
  showSetupNotice,
  supabase,
} from "./supabaseClient.js";

const setupNotice = document.querySelector("#setupNotice");
const logoutBtn = document.querySelector("#logoutBtn");
const form = document.querySelector("#settingsForm");
const message = document.querySelector("#settingsMessage");
const profilePreview = document.querySelector("#profilePreview");
const profilePreviewFallback = document.querySelector("#profilePreviewFallback");
const profilePhotoInput = document.querySelector("#profilePhoto");
const viewProfilePhotoBtn = document.querySelector("#viewProfilePhotoBtn");
const profilePhotoDialog = document.querySelector("#profilePhotoDialog");
const profilePhotoLarge = document.querySelector("#profilePhotoLarge");
const closeProfilePhotoBtn = document.querySelector("#closeProfilePhotoBtn");

let session = null;
let currentProfile = null;
let useMetadataFallback = false;
let localProfilePreviewUrl = "";

showSetupNotice(setupNotice);
logoutBtn.addEventListener("click", logout);
session = await requireSession();
await loadSettings();
await loadAdminAvatar(session);

viewProfilePhotoBtn.addEventListener("click", () => {
  if (!profilePreview.src) return;
  profilePhotoLarge.src = profilePreview.src;
  profilePhotoDialog.showModal();
});

closeProfilePhotoBtn.addEventListener("click", () => profilePhotoDialog.close());

profilePhotoInput.addEventListener("change", () => {
  const file = profilePhotoInput.files[0];
  message.textContent = "";

  if (!file) return;

  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
    message.textContent = "Profile photo must be JPG, PNG or WebP.";
    profilePhotoInput.value = "";
    return;
  }

  if (localProfilePreviewUrl) {
    URL.revokeObjectURL(localProfilePreviewUrl);
  }

  localProfilePreviewUrl = URL.createObjectURL(file);
  showProfilePhoto(localProfilePreviewUrl);
  updateTopAvatar(localProfilePreviewUrl);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  if (!supabase || !session) {
    message.textContent = "Supabase setup is required before saving settings.";
    return;
  }

  const photoFile = document.querySelector("#profilePhoto").files[0];

  if (photoFile && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(photoFile.type)) {
    message.textContent = "Profile photo must be JPG, PNG or WebP.";
    return;
  }

  try {
    let photoUploadSkipped = false;
    let photoUrl = currentProfile?.profile_photo_url || session.user.user_metadata?.profile_photo_url || null;

    if (photoFile) {
      try {
        photoUrl = await uploadFile("admin-profiles", `${session.user.id}/${Date.now()}-${photoFile.name}`, photoFile);
      } catch (error) {
        if (!isMissingBucket(error) && !isRlsError(error)) throw error;
        photoUploadSkipped = true;
        photoUrl = await fileToProfileDataUrl(photoFile);
      }
    }

    const payload = {
      manager_id: session.user.id,
      name: document.querySelector("#adminName").value.trim(),
      mobile: document.querySelector("#adminMobile").value.trim(),
      email: document.querySelector("#adminEmail").value.trim() || session.user.email,
      business_name: document.querySelector("#businessName").value.trim(),
      business_mobile: document.querySelector("#businessMobile").value.trim(),
      business_address: document.querySelector("#businessAddress").value.trim(),
      profile_photo_url: photoUrl,
    };

    if (useMetadataFallback) {
      await saveToUserMetadata(payload);
      currentProfile = payload;
      renderProfile(payload);
      await loadAdminAvatar(session);
      if (photoUploadSkipped && localProfilePreviewUrl) {
        showProfilePhoto(localProfilePreviewUrl);
        updateTopAvatar(localProfilePreviewUrl);
      }
      document.querySelector("#profilePhoto").value = "";
      message.textContent = "Settings saved.";
      return;
    }

    const { data, error } = await supabase
      .from("admin_profiles")
      .upsert(payload, { onConflict: "manager_id" })
      .select("*")
      .single();

    if (isMissingProfileTable(error) || isRlsError(error)) {
      useMetadataFallback = true;
      await saveToUserMetadata(payload);
      currentProfile = payload;
      renderProfile(payload);
      await loadAdminAvatar(session);
      if (photoUploadSkipped && localProfilePreviewUrl) {
        showProfilePhoto(localProfilePreviewUrl);
        updateTopAvatar(localProfilePreviewUrl);
      }
      document.querySelector("#profilePhoto").value = "";
      message.textContent = "Settings saved.";
      return;
    }

    if (error) throw error;

    currentProfile = data;
    renderProfile(data);
    await loadAdminAvatar(session);
    if (photoUploadSkipped && localProfilePreviewUrl) {
      showProfilePhoto(localProfilePreviewUrl);
      updateTopAvatar(localProfilePreviewUrl);
    }
    document.querySelector("#profilePhoto").value = "";
    message.textContent = "Settings saved.";
  } catch (error) {
    message.textContent = error.message;
  }
});

async function loadSettings() {
  if (!supabase || !session) return;

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("manager_id", session.user.id)
    .maybeSingle();

  if (error) {
    if (isMissingProfileTable(error)) {
      useMetadataFallback = true;
      currentProfile = metadataToProfile();
      renderProfile(currentProfile);
      return;
    }

    message.textContent = error.message;
    return;
  }

  currentProfile = data;
  renderProfile(data);
}

function renderProfile(profile) {
  const displayName = profile?.name || session?.user?.user_metadata?.name || "";
  document.querySelector("#adminName").value = displayName;
  document.querySelector("#adminMobile").value = profile?.mobile || session?.user?.user_metadata?.mobile || "";
  document.querySelector("#adminEmail").value = profile?.email || session?.user?.email || "";
  document.querySelector("#businessName").value = profile?.business_name || "";
  document.querySelector("#businessMobile").value = profile?.business_mobile || "";
  document.querySelector("#businessAddress").value = profile?.business_address || "";
  profilePreviewFallback.textContent = initialsFromName(displayName || profile?.email || session?.user?.email || "Admin");

  showProfilePhoto(profile?.profile_photo_url || "");
}

function showProfilePhoto(url) {
  if (url) {
    profilePreview.src = url;
    profilePreview.classList.remove("hidden");
    profilePreviewFallback.classList.add("hidden");
    viewProfilePhotoBtn.disabled = false;
    return;
  }

  profilePreview.removeAttribute("src");
  profilePreview.classList.add("hidden");
  profilePreviewFallback.classList.remove("hidden");
  viewProfilePhotoBtn.disabled = true;
}

function updateTopAvatar(url) {
  const avatarImage = document.querySelector("#adminAvatarImg");
  const avatarFallback = document.querySelector("#adminAvatarFallback");
  if (!avatarImage || !avatarFallback) return;

  if (url) {
    avatarImage.src = url;
    avatarImage.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
    return;
  }

  avatarImage.removeAttribute("src");
  avatarImage.classList.add("hidden");
  avatarFallback.classList.remove("hidden");
}

async function saveToUserMetadata(profile) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      name: profile.name,
      mobile: profile.mobile,
      business_name: profile.business_name,
      business_mobile: profile.business_mobile,
      business_address: profile.business_address,
      profile_photo_url: profile.profile_photo_url,
    },
  });

  if (error) throw error;
  session = { ...session, user: data.user };
}

async function fileToProfileDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 220;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  const shortestSide = Math.min(bitmap.width, bitmap.height);
  const sourceX = (bitmap.width - shortestSide) / 2;
  const sourceY = (bitmap.height - shortestSide) / 2;

  context.drawImage(bitmap, sourceX, sourceY, shortestSide, shortestSide, 0, 0, size, size);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", 0.76);
}

function metadataToProfile() {
  const metadata = session?.user?.user_metadata || {};
  return {
    manager_id: session?.user?.id,
    name: metadata.name || "",
    mobile: metadata.mobile || "",
    email: session?.user?.email || "",
    business_name: metadata.business_name || "",
    business_mobile: metadata.business_mobile || "",
    business_address: metadata.business_address || "",
    profile_photo_url: metadata.profile_photo_url || null,
  };
}

function isMissingProfileTable(error) {
  return Boolean(
    error &&
      (error.code === "PGRST205" ||
        error.code === "42P01" ||
        String(error.message || "").includes("admin_profiles") ||
        String(error.message || "").includes("schema cache")),
  );
}

function isMissingBucket(error) {
  return Boolean(
    error &&
      (String(error.message || "").includes("Bucket not found") ||
        String(error.message || "").includes("admin-profiles storage bucket")),
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

function initialsFromName(value) {
  const parts = String(value || "Admin")
    .replace(/@.*/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts[0]?.[0] || "A").toUpperCase() + (parts[1]?.[0] || "D").toUpperCase();
}

async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
