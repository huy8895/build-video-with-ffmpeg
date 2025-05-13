

const t = TrelloPowerUp.iframe();

window.onload = function () {
  const submitBtn = document.getElementById('submit');

  submitBtn.addEventListener('click', async function () {
    const driveLink = document.getElementById('driveLink').value;
    const videoName = document.getElementById('videoName').value;
    const flow = document.getElementById('flow').value;

    const card = await t.card('name', 'id');
    const board = await t.board('name');

    // Gửi đi webhook
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
        flow,
        triggeredBy: "trello_powerup"
      })
    });

    t.closePopup();
  });

  // Giúp popup vừa khít theo nội dung
  t.render(() => {
    t.sizeTo("body").done();
  });
};