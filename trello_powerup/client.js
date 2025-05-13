window.TrelloPowerUp.initialize({
  'card-buttons': function (t, options) {
    return [{
      icon: './icon.png',
      text: '🎞 Build video',
      callback: function (t) {
        return t.popup({
          title: "Build video",
          url: "popup.html", 
          height: 200
        });
      }
    }];
  }
});
