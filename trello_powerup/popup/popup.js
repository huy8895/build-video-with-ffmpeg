const t = TrelloPowerUp.iframe();

window.onload = function () {
  const submitBtn = document.getElementById('submit');
  const statusDiv = document.getElementById('status');

  submitBtn.addEventListener('click', async function () {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span>Sending...`;
    statusDiv.textContent = "";

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

    try {
      await fetch("https://flat-smoke-939b.huytvdev22.workers.dev/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      console.log("✅ Workflow triggered via Cloudflare Worker");

      await t.set("card", "shared", {
        driveLink,
        videoName,
        flow
      });

      // ✅ Show success message and prevent accidental retry
      submitBtn.innerHTML = "✅ Sent!";
      statusDiv.textContent = "Workflow triggered successfully!";

      // Optional: close popup after short delay
      setTimeout(() => t.closePopup(), 1000);

    } catch (err) {
      console.error("❌ Failed to call Worker:", err);
      alert("Something went wrong. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  t.render(async function () {
    const saved = await t.get("card", "shared");

    if (saved.driveLink) document.getElementById('driveLink').value = saved.driveLink;
    if (saved.videoName) document.getElementById('videoName').value = saved.videoName;
    if (saved.flow) document.getElementById('flow').value = saved.flow;

    t.sizeTo("body").done();
  });
};
