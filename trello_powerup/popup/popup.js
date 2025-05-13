const t = TrelloPowerUp.iframe();

window.onload = function () {
  const submitBtn = document.getElementById('submit');

  submitBtn.addEventListener('click', async function () {
    const driveLink = document.getElementById('driveLink').value;
    const videoName = document.getElementById('videoName').value;
    const flow = document.getElementById('flow').value;

    const card = await t.card('name', 'id');
    const board = await t.board('name');

    const payload = {
      cardName: card.name,
      cardId: card.id,
      boardName: board.name,
      driveLink,
      videoName,
      flow,
      triggeredBy: "trello_powerup"
    };

    // 🔄 Gửi tới Google Apps Script
    const scriptURL = "https://script.google.com/macros/s/AKfycbzGNRldKyM4k73MSWaaeL0mPhjzLNF5REvYXmeNyi-MxuCRkxoi4z16SHBPxOa6bXw/exec";

    try {
      const response = await fetch(scriptURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log("✅ Script response:", result);
    } catch (err) {
      console.error("❌ Failed to call Apps Script:", err);
      alert("Something went wrong. Please try again.");
    }

    // ✅ Lưu lại vào card
    await t.set("card", "shared", {
      driveLink,
      videoName,
      flow
    });

    t.closePopup();
  });

  // 🔁 Khi popup mở → tự điền lại dữ liệu đã lưu
  t.render(async function () {
    const saved = await t.get("card", "shared");

    if (saved.driveLink) document.getElementById('driveLink').value = saved.driveLink;
    if (saved.videoName) document.getElementById('videoName').value = saved.videoName;
    if (saved.flow) document.getElementById('flow').value = saved.flow;

    t.sizeTo("body").done();
  });
};
