const form = document.getElementById("form");
const messageTag = document.getElementById("message");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirm-password");
const notification = document.getElementById("notification");
const submitBtn = document.getElementById("submit");

form.style.display = "none";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

let id, token;

window.addEventListener("DOMContentLoaded", async () => {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => {
      return searchParams.get(prop);
    },
  });

  console.log(params);

  id = params.id;
  token = params.token;

  console.log("ID:", id);
  console.log("Token:", token);

  const res = await fetch("/auth/verify-pass-reset-token", {
    method: "POST",
    body: JSON.stringify({ token, id }),
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
  });

  if (!res.ok) {
    const { message } = await res.json();
    messageTag.innerText = message;
    messageTag.classList.add("error");
    return;
  }

  messageTag.style.display = "none";
  form.style.display = "block";
});

const displayNotification = (message, type) => {
  notification.style.display = "block";
  notification.innerText = message;
  notification.classList.add(type);
};

const handleSubmit = async (evt) => {
  evt.preventDefault();

  if (!password.value.trim()) {
    return displayNotification("Mật khẩu không được để trống!", "error");
  } else {
    if (!passwordRegex.test(password.value)) {
      return displayNotification(
        "Mật khẩu nên có chữ, số, kí tự đặt biệt!",
        "error"
      );
    }
    if (password.value !== confirmPassword.value) {
      return displayNotification("Mật khẩu không trùng khớp!", "error");
    }
  }
  submitBtn.disabled = true;
  submitBtn.innerText = "Hãy đợi...";

  const res = await fetch("/auth/reset-pass", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify({ id, token, password: password.value }),
  });

  submitBtn.disabled = false;
  submitBtn.innerText = "Cập nhật mật khẩu";

  if (!res.ok) {
    const { message } = await res.json();
    return displayNotification(message, "error");
  }

  messageTag.style.display = "block";
  messageTag.innerText = "Mật khẩu của bạn đã cập nhật thành công!";
  form.style.display = "none";
};
form.addEventListener("submit", handleSubmit);
