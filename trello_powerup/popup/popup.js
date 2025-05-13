const t = TrelloPowerUp.iframe();

window.onload = function () {
  const submitBtn = document.getElementById('submit');

  submitBtn.addEventListener('click', async function () {
    // Disable button to prevent duplicate clicks
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      const driveLink = document.getElementById('driveLink').value;
      const videoName = document.getElementById('videoName').value;
      const flow = document.getElementById('flow').value;

      console.log("📤 Submitting:", { driveLink, videoName, flow });

      const card = await t.card('name', 'id');
      const board = await t.board('name');

      console.log("📝 Card:", card);
      console.log("📋 Board:", board);

      const response = await fetch("https://eo92jfgk4r4masz.m.pipedream.net", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cardName: card.name,
          cardId: card.id,
          boardName: board.name,
          driveLink,
          videoName,
          flow,
          triggeredBy: "trello_powerup"
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("❌ API error:", errText);
        alert("Failed to send data to GitHub: " + errText);
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
        return;
      }

      console.log("✅ Webhook sent successfully.");
      t.closePopup();
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      alert("Unexpected error: " + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit";
    }
  });

  // Adjust popup size after render
  t.render(() => {
    t.sizeTo("body").done();
  });
};
