

window.onload = function () {
  const iframe = TrelloPowerUp.iframe();

  document.getElementById('submit').addEventListener('click', async function() {
    const driveLink = document.getElementById('driveLink').value;
    const videoName = document.getElementById('videoName').value;
    const flow = document.getElementById('flow').value;

    const card = await iframe.card('name', 'id');
    const board = await iframe.board('name');

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

    iframe.closePopup();
  });
};

