import Swal from "sweetalert2";

// success alert
export const showSuccess = (title, text = "") => {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "ตกลง",
    confirmButtonColor: "#198754",
  });
};

// warning alert
export const showWarning = (title, text = "") => {
  return Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText: "เข้าใจแล้ว",
  });
};

// error alert
export const showError = (title, text = "") => {
  return Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonText: "ปิด",
  });
};

// confirm alert
export const showConfirm = (title, text = "") => {
  return Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "ตกลง",
    cancelButtonText: "ยกเลิก",
  });
};
