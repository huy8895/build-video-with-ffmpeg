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

    // ✅ Gọi tới Cloudflare Worker
    try {
      await fetch("https://flat-smoke-939b.huytvdev22.workers.dev/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      console.log("✅ Workflow triggered via Cloudflare Worker");

    } catch (err) {
      console.error("❌ Failed to call Worker:", err);
      alert("Something went wrong. Please try again.");
    }

    // ✅ Lưu vào Trello card
    await t.set("card", "shared", {
      driveLink,
      videoName,
      flow
    });

    t.closePopup();
  });

  // Tự động điền lại nếu đã lưu từ trước
  t.render(async function () {
    const saved = await t.get("card", "shared");

    if (saved.driveLink) document.getElementById('driveLink').value = saved.driveLink;
    if (saved.videoName) document.getElementById('videoName').value = saved.videoName;
    if (saved.flow) document.getElementById('flow').value = saved.flow;

    t.sizeTo("body").done();
  });
};
