window.TrelloPowerUp.initialize({
  'card-buttons': function (t, options) {
    return [{
      icon: './icon.png',
      text: '🎞 Build video',
      callback: function (t) {
        return t.popup({
          title: "Build video",
          url: "popup/popup.html", 
          height: 200
        });
      }
    }];
  },
  'card-badges': function (t, options) {
    return t.get('card', 'shared', 'flow')
      .then(function (flow) {
        return [{
          text: flow ? '✔️ ' + flow : 'Waiting for build',
          color: flow ? 'green' : 'orange', // hoặc 'green', 'red', 'purple', 'sky', 'orange'
        }];
      });
  },

  'card-detail-badges': function (t, options) {
    return t.get('card', 'shared')
      .then(function (data) {
        if (!data || !data.flow) return [];

        return [{
          title: 'Build Video status',
          text: data.flow ? '✔️ ' + data.flow : 'Waiting for build',
          callback: function (t) {
            return t.popup({
              title: 'Build Progress',
              url: 'popup/popup.html', // hoặc popup khác nếu bạn có
              height: 200
            });
          }
        }];
      });
  },
});
