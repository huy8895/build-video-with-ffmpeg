const t = TrelloPowerUp.iframe();

window.onload = function () {
  const submitBtn = document.getElementById('submit');

  submitBtn.addEventListener('click', async function () {
    const driveLink = document.getElementById('driveLink').value;
    const videoName = document.getElementById('videoName').value;
    const flow = document.getElementById('flow').value;

    const card = await t.card('name', 'id');
    const board = await t.board('name');

    // Gửi tới webhook
    await fetch("https://eo92jfgk4r4masz.m.pipedream.net", {
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
        flow
      })
    });

    // Lưu lại vào card
    await t.set("card", "shared", {
      driveLink,
      videoName,
      flow
    });

    t.closePopup();
  });

  // Khi popup render lần đầu → tự điền lại dữ liệu
  t.render(async function () {
    const saved = await t.get("card", "shared");

    if (saved.driveLink) document.getElementById('driveLink').value = saved.driveLink;
    if (saved.videoName) document.getElementById('videoName').value = saved.videoName;
    if (saved.flow) document.getElementById('flow').value = saved.flow;

    t.sizeTo("body").done();
  });
};
