let qr = null;

function generateCustomQR() {
  const text = document.getElementById("urlInput").value;
  const qrcodeDiv = document.getElementById("qrcode");
  const dotColor = document.getElementById("dotColor").value;
  const bgColor = document.getElementById("bgColor").value;
  const qrSize = document.getElementById("qrSize").value;

  if (!text) {
    alert("Please enter a URL or text!");
    return;
  }

  qrcodeDiv.innerHTML = "";

  qr = new QRCode(qrcodeDiv, {
    text: text,
    width: qrSize,
    height: qrSize,
    colorDark: dotColor,
    colorLight: bgColor,
    correctLevel: QRCode.CorrectLevel.H,
    // For different dot shapes (experimental):
    /*
                drawType: 'round', // 'square' (default), 'round', 'image'
                */
  });

  // Update size display
  document.getElementById("sizeValue").textContent = `${qrSize}px`;

  setTimeout(() => {
    document.getElementById("downloadBtn").style.display = "inline-block";
    // Additional customizations for SVG elements
    customizeQRAppearance();
  }, 100);
}

function customizeQRAppearance() {
  // Example: Add custom styling to QR code modules
  const qrModules = document.querySelectorAll("#qrcode rect");
  qrModules.forEach((module) => {
    // Example: Add subtle rounding to square modules
    module.setAttribute("rx", "3");
    module.setAttribute("ry", "3");
  });
}

function downloadQR() {
  const canvas = document.querySelector("#qrcode canvas");
  const url = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `custom-qr-${Date.now()}.png`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Update size display when slider moves
document.getElementById("qrSize").addEventListener("input", (e) => {
  document.getElementById("sizeValue").textContent = `${e.target.value}px`;
});
